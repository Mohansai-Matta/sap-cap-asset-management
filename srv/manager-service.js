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
            Employees, Assets, MaintenanceRecords, AssetRequests, MyProfile, Notifications
        } = this.entities;

        // every request needs an active manager record
        this.before('*', async (req) => { await requireManager(req); });

        const scope = async (req) => managerScope((await requireManager(req)).manager);

        /* =========================
           Row-level restrictions for READ
           (managers, employees, assets, ownership ledger and maintenance records: all records)
        ========================= */

        this.after('READ', Assets, addAssignedOn);
        // asset requests are sent to the employee's assigned manager
        this.before('READ', AssetRequests, async (req) => {
            req.query.where({ requested_by_employee_id: inList((await scope(req)).reportIds) });
        });
        this.before('READ', MyProfile, async (req) => {
            req.query.where({ manager_id: (await requireManager(req)).manager.manager_id });
        });
        this.before('READ', Notifications, (req) => { req.query.where({ recipient_user_id: req.user.id }); });

        /* =========================
           Writes
        ========================= */

        this.before('UPDATE', Employees, async (req) => {
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

        this.before('CREATE', MaintenanceRecords, async (req) => {
            if (!req.data.asset_asset_id) req.reject(400, 'Please select an asset');
            req.data.reported_by_manager_id = (await requireManager(req)).manager.manager_id;
            req.data.reported_date ??= today();
            validateMaintenance(req, req.data);
        });

        this.before('UPDATE', MaintenanceRecords, async (req) => {
            const before = await SELECT.one.from(db().MaintenanceRecords).where({ maintenance_id: req.data.maintenance_id });
            if (!before) req.reject(404, 'Maintenance record not found');
            delete req.data.reported_by_manager_id;
            validateMaintenance(req, { ...before, ...req.data });
        });

        this.after('CREATE', MaintenanceRecords, async (_, req) => { await maintenance.afterCreate(req.data); });

        /* =========================
           Actions (ownership: all assets and employees; requests: only the manager's own employees)
        ========================= */

        const managerId = async (req) => (await requireManager(req)).manager.manager_id;

        // any available asset can be allocated to any active employee (checked in lib/ownership)
        this.on('assignAsset', async (req) => ownership.assign(req, { ...req.data, recorded_by: await managerId(req) }));
        this.on('transferAsset', async (req) => ownership.transfer(req, { ...req.data, recorded_by: await managerId(req) }));
        this.on('returnAsset', async (req) => ownership.returnAsset(req, { ...req.data, recorded_by: await managerId(req) }));
        this.on('updateOwnership', async (req) => ownership.updateOwnership(req, { ...req.data, recorded_by: await managerId(req) }));

        const assertTeamRequest = async (req) => {
            const request = await requests.loadRequest(req, req.data.request_id);
            const { employee } = await requireManager(req);
            if (request.requested_by_employee_id === employee.employee_id) {
                req.reject(403, 'You cannot decide on your own request - it is handled by your own manager');
            }
            if (!(await scope(req)).reportIds.includes(request.requested_by_employee_id)) {
                req.reject(403, 'This request was sent to another manager');
            }
            return request;
        };

        this.on('approveRequest', async (req) => {
            await assertTeamRequest(req);
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
            return maintenance.updateStatus(req, req.data);
        });

        this.on('markNotificationRead', (req) => markRead(req.user.id, req.data.notification_id).then(() => {}));
        this.on('markAllNotificationsRead', (req) => markRead(req.user.id).then(() => {}));

        // all records, except asset requests: only those of the manager's own employees
        this.on('getStats', async (req) => {
            await ownership.checkOverdue(null);
            return stats.getStats({ requesterIds: (await scope(req)).reportIds, userId: req.user.id });
        });

        this.on('getReport', async (req) => stats.getReport(req, req.data.report, { requesterIds: (await scope(req)).reportIds }));

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
