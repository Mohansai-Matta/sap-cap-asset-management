const cds = require('@sap/cds');
const { isMissingTable, OUTDATED } = require('./lib/schema-check');
const { db, inList, today, validateMaintenance } = require('./lib/common');
const { requireManager, managerScope } = require('./lib/context');
const ownership = require('./lib/ownership');
const requests = require('./lib/requests');
const maintenance = require('./lib/maintenance');
const stats = require('./lib/stats');
const { markRead } = require('./lib/notify');
const { registerAudit } = require('./lib/audit');
const { addAssignedOn } = require('./lib/enrich');

const EMPLOYEE_FIELDS_MANAGER_MAY_CHANGE = ['phone', 'location', 'designation', 'status'];
const PROFILE_FIELDS = ['full_name', 'email', 'phone'];

module.exports = class ManagerService extends cds.ApplicationService {

    init() {

        const {
            Employees, Assets, AssetOwnerships, AssignmentHistory, MaintenanceRecords,
            AssetRequests, MyProfile, Notifications
        } = this.entities;

        // every request needs an active manager record
        this.before('*', async (req) => { await requireManager(req); });

        const scope = async (req) => managerScope((await requireManager(req)).manager);

        /* =========================
           Row-level restrictions for READ
        ========================= */

        this.before('READ', Employees, async (req) => {
            req.query.where({ employee_id: inList((await scope(req)).employeeIds) });
        });
        this.before('READ', Assets, async (req) => {
            req.query.where({ asset_id: inList((await scope(req)).assetIds) });
        });
        this.after('READ', Assets, addAssignedOn);
        this.before('READ', AssetOwnerships, async (req) => {
            req.query.where({ asset_asset_id: inList((await scope(req)).teamAssetIds) });
        });
        this.before('READ', AssignmentHistory, async (req) => {
            req.query.where({ asset_asset_id: inList((await scope(req)).teamAssetIds) });
        });
        this.before('READ', MaintenanceRecords, async (req) => {
            req.query.where({ asset_asset_id: inList((await scope(req)).teamAssetIds) });
        });
        this.before('READ', AssetRequests, async (req) => {
            req.query.where({ requested_by_employee_id: inList((await scope(req)).employeeIds) });
        });
        this.before('READ', MyProfile, async (req) => {
            req.query.where({ manager_id: (await requireManager(req)).manager.manager_id });
        });
        this.before('READ', Notifications, (req) => { req.query.where({ recipient_user_id: req.user.id }); });

        /* =========================
           Writes
        ========================= */

        this.before('UPDATE', Employees, async (req) => {
            const { employeeIds } = await scope(req);
            if (!employeeIds.includes(req.data.employee_id)) req.reject(403, 'This employee is not in your team');
            const notAllowed = Object.keys(req.data)
                .filter((k) => k !== 'employee_id' && !EMPLOYEE_FIELDS_MANAGER_MAY_CHANGE.includes(k));
            if (notAllowed.length) req.reject(403, `Managers may not change: ${notAllowed.join(', ')}`);
        });

        this.before('UPDATE', MyProfile, async (req) => {
            const { manager } = await requireManager(req);
            if (req.data.manager_id !== manager.manager_id) req.reject(403, 'You can only update your own profile');
            const notAllowed = Object.keys(req.data).filter((k) => k !== 'manager_id' && !PROFILE_FIELDS.includes(k));
            if (notAllowed.length) req.reject(403, `You may not change: ${notAllowed.join(', ')}`);
        });

        const assertTeamAsset = async (req, assetId) => {
            if (!(await scope(req)).teamAssetIds.includes(assetId)) req.reject(403, 'This asset is not managed by your team');
        };

        this.before('CREATE', MaintenanceRecords, async (req) => {
            if (!req.data.asset_asset_id) req.reject(400, 'Please select an asset');
            await assertTeamAsset(req, req.data.asset_asset_id);
            req.data.reported_by_manager_id = (await requireManager(req)).manager.manager_id;
            req.data.reported_date ??= today();
            validateMaintenance(req, req.data);
        });

        this.before('UPDATE', MaintenanceRecords, async (req) => {
            const before = await SELECT.one.from(db().MaintenanceRecords).where({ maintenance_id: req.data.maintenance_id });
            if (!before) req.reject(404, 'Maintenance record not found');
            await assertTeamAsset(req, before.asset_asset_id);
            if (req.data.asset_asset_id && req.data.asset_asset_id !== before.asset_asset_id) {
                await assertTeamAsset(req, req.data.asset_asset_id);
            }
            delete req.data.reported_by_manager_id;
            validateMaintenance(req, { ...before, ...req.data });
        });

        this.after('CREATE', MaintenanceRecords, async (_, req) => { await maintenance.afterCreate(req.data); });

        /* =========================
           Actions (all checked against the manager's scope)
        ========================= */

        const managerId = async (req) => (await requireManager(req)).manager.manager_id;
        const assertTeamEmployee = async (req, employeeId) => {
            if (employeeId && !(await scope(req)).employeeIds.includes(employeeId)) req.reject(403, 'This employee is not in your team');
        };

        this.on('assignAsset', async (req) => {
            const s = await scope(req);
            if (!s.assignableAssetIds.includes(req.data.asset_id)) req.reject(403, 'This asset is not available for your team');
            await assertTeamEmployee(req, req.data.employee_id);
            return ownership.assign(req, { ...req.data, recorded_by: await managerId(req) });
        });

        this.on('transferAsset', async (req) => {
            await assertTeamAsset(req, req.data.asset_id);
            await assertTeamEmployee(req, req.data.to_employee_id);
            return ownership.transfer(req, { ...req.data, recorded_by: await managerId(req) });
        });

        this.on('returnAsset', async (req) => {
            await assertTeamAsset(req, req.data.asset_id);
            return ownership.returnAsset(req, { ...req.data, recorded_by: await managerId(req) });
        });

        this.on('updateOwnership', async (req) => {
            const o = await SELECT.one.from(db().AssetOwnerships).where({ ownership_id: req.data.ownership_id });
            if (!o) req.reject(404, 'Ownership record not found');
            await assertTeamAsset(req, o.asset_asset_id);
            return ownership.updateOwnership(req, { ...req.data, recorded_by: await managerId(req) });
        });

        const assertTeamRequest = async (req) => {
            const request = await requests.loadRequest(req, req.data.request_id);
            const { employee } = await requireManager(req);
            if (request.requested_by_employee_id === employee.employee_id) {
                req.reject(403, 'You cannot decide on your own request - it is handled by the administrator');
            }
            await assertTeamEmployee(req, request.requested_by_employee_id);
            return request;
        };

        this.on('approveRequest', async (req) => {
            const request = await assertTeamRequest(req);
            if (request.type === 'New') {
                if (req.data.asset_id && !(await scope(req)).assignableAssetIds.includes(req.data.asset_id)) {
                    req.reject(403, 'This asset is not available for your team');
                }
            }
            return requests.approve(req, { ...req.data, recorded_by: await managerId(req) });
        });

        this.on('rejectRequest', async (req) => {
            await assertTeamRequest(req);
            return requests.reject(req, req.data);
        });

        this.on('resolveRequest', async (req) => {
            await assertTeamRequest(req);
            return requests.resolve(req, req.data);
        });

        this.on('updateMaintenanceStatus', async (req) => {
            const record = await SELECT.one.from(db().MaintenanceRecords).where({ maintenance_id: req.data.maintenance_id });
            if (!record) req.reject(404, 'Maintenance record not found');
            await assertTeamAsset(req, record.asset_asset_id);
            return maintenance.updateStatus(req, req.data);
        });

        this.on('markNotificationRead', (req) => markRead(req.user.id, req.data.notification_id).then(() => {}));
        this.on('markAllNotificationsRead', (req) => markRead(req.user.id).then(() => {}));

        this.on('getStats', async (req) => {
            const s = await scope(req);
            await ownership.checkOverdue(s.employeeIds);
            return stats.getStats({ employeeIds: s.employeeIds, assetIds: s.teamAssetIds, userId: req.user.id });
        });

        this.on('getReport', async (req) => {
            const s = await scope(req);
            return stats.getReport(req, req.data.report, { employeeIds: s.employeeIds, assetIds: s.teamAssetIds });
        });

        registerAudit(this);
        // explain errors caused by an outdated database schema
        this.on('error', (error) => {
            if (isMissingTable(error)) {
                error.message = OUTDATED;
                error.code = 503;
                error.status = 503;
            }
        });

        return super.init();
    }
};
