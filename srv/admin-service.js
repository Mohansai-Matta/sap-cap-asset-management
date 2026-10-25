const cds = require('@sap/cds');
const { isMissingTable, OUTDATED } = require('./lib/schema-check');
const {
    db, today, assertNoDependents, dependentsOf, assertAssetDeletable, deleteAssetChildren,
    validateAsset, validateMaintenance, assertUniqueAssetTag
} = require('./lib/common');
const ownership = require('./lib/ownership');
const requests = require('./lib/requests');
const maintenance = require('./lib/maintenance');
const stats = require('./lib/stats');
const { markRead } = require('./lib/notify');
const { audit, registerAudit } = require('./lib/audit');

module.exports = class AdminService extends cds.ApplicationService {

    init() {

        const {
            Departments, Employees, Managers, Assets, AssetCategories, Vendors,
            MaintenanceRecords, Users, Roles, Notifications
        } = this.entities;

        // current state of a record in the database (for validations on UPDATE)
        const current = (dbEntity, key, value) => SELECT.one.from(db()[dbEntity]).where({ [key]: value });

        /* =========================
           Referential integrity on DELETE
        ========================= */

        for (const [entity, dbName, key, label] of [
            [Departments, 'Departments', 'dept_id', 'Department'],
            [Employees, 'Employees', 'employee_id', 'Employee'],
            [Managers, 'Managers', 'manager_id', 'Manager'],
            [Vendors, 'Vendors', 'vendor_id', 'Vendor'],
            [AssetCategories, 'AssetCategories', 'asset_category_id', 'Asset category'],
            [Roles, 'Roles', 'code', 'Role']
        ]) {
            this.before('DELETE', entity, (req) => assertNoDependents(req, dependentsOf(dbName), req.data[key], label));
        }

        this.before('DELETE', Assets, async (req) => {
            await assertAssetDeletable(req, req.data.asset_id);
            await deleteAssetChildren(req.data.asset_id);
        });

        this.before('DELETE', MaintenanceRecords, async (req) => {
            await UPDATE(db().AssetRequests).set({ maintenance_maintenance_id: null })
                .where({ maintenance_maintenance_id: req.data.maintenance_id });
        });

        this.before('DELETE', Users, (req) => {
            if (req.data.user_id === req.user.id) req.reject(409, 'You cannot delete your own user');
        });

        /* =========================
           Assets
        ========================= */

        this.before('CREATE', Assets, async (req) => {
            // the holder is maintained through the ownership operations only
            delete req.data.current_holder_employee_id;
            if (!req.data.status || req.data.status === 'Assigned') req.data.status = 'Available';
            validateAsset(req, req.data);
            await assertUniqueAssetTag(req, req.data);
        });

        this.before('UPDATE', Assets, async (req) => {
            const before = await current('Assets', 'asset_id', req.data.asset_id);
            if (!before) req.reject(404, 'Asset not found');
            if ('current_holder_employee_id' in req.data && req.data.current_holder_employee_id !== before.current_holder_employee_id) {
                req.reject(400, 'Use Assign / Transfer / Return to change the holder of an asset');
            }
            const merged = { ...before, ...req.data };
            if (merged.status === 'Assigned' && !merged.current_holder_employee_id) {
                req.reject(400, "Status 'Assigned' requires a holder - use Assign instead");
            }
            if (before.current_holder_employee_id && ['Available', 'Retired', 'Archived'].includes(merged.status)) {
                req.reject(400, 'The asset is assigned to an employee - return it first');
            }
            validateAsset(req, merged);
            await assertUniqueAssetTag(req, merged);
        });

        /* =========================
           Maintenance
        ========================= */

        this.before('CREATE', MaintenanceRecords, (req) => {
            if (!req.data.asset_asset_id) req.reject(400, 'Please select an asset');
            req.data.reported_date ??= today();
            validateMaintenance(req, req.data);
        });

        this.before('UPDATE', MaintenanceRecords, async (req) => {
            const before = await current('MaintenanceRecords', 'maintenance_id', req.data.maintenance_id);
            validateMaintenance(req, { ...before, ...req.data });
        });

        this.after('CREATE', MaintenanceRecords, async (_, req) => { await maintenance.afterCreate(req.data); });

        /* =========================
           Managers & users
        ========================= */

        this.before('CREATE', Managers, async (req) => {
            const { employee_employee_id } = req.data;
            if (!employee_employee_id) req.reject(400, 'Please select the employee who becomes manager');
            const employee = await SELECT.one.from(db().Employees).where({ employee_id: employee_employee_id });
            if (!employee) req.reject(400, 'Employee does not exist');
            const existing = await SELECT.one.from(db().Managers).columns('manager_id').where({ employee_employee_id });
            if (existing) req.reject(409, `${employee.full_name} is already a manager`);
            req.data.full_name ??= employee.full_name;
            req.data.email ??= employee.email;
            req.data.phone ??= employee.phone;
            req.data.department_dept_id ??= employee.department_dept_id;
        });

        // a new manager's login gets the Manager role
        this.after('CREATE', Managers, async (_, req) => {
            await UPDATE(db().Users).set({ role_code: 'Manager' })
                .where({ employee_employee_id: req.data.employee_employee_id, role_code: 'Employee' });
        });

        this.before(['CREATE', 'UPDATE'], Users, async (req) => {
            const employeeId = req.data.employee_employee_id;
            if (!employeeId) return;
            const other = await SELECT.one.from(db().Users).columns('user_id')
                .where({ employee_employee_id: employeeId, user_id: { '!=': req.data.user_id } });
            if (other) req.reject(409, `The employee is already linked to the login '${other.user_id}'`);
        });

        /* =========================
           Notifications: own only
        ========================= */

        this.before('READ', Notifications, (req) => { req.query.where({ recipient_user_id: req.user.id }); });
        this.on('markNotificationRead', (req) => markRead(req.user.id, req.data.notification_id).then(() => {}));
        this.on('markAllNotificationsRead', (req) => markRead(req.user.id).then(() => {}));

        /* =========================
           Actions
        ========================= */

        this.on('assignAsset', (req) => ownership.assign(req, req.data));
        this.on('transferAsset', (req) => ownership.transfer(req, req.data));
        this.on('returnAsset', (req) => ownership.returnAsset(req, req.data));
        this.on('updateOwnership', (req) => ownership.updateOwnership(req, req.data));

        this.on('approveRequest', (req) => requests.approve(req, req.data));
        this.on('rejectRequest', (req) => requests.reject(req, req.data));
        this.on('resolveRequest', (req) => requests.resolve(req, req.data));

        this.on('updateMaintenanceStatus', (req) => maintenance.updateStatus(req, req.data));

        this.on('setManagerActive', async (req) => {
            const { manager_id, active } = req.data;
            const n = await UPDATE(db().Managers).set({ active: !!active }).where({ manager_id });
            if (!n) req.reject(404, 'Manager not found');
            await audit(active ? 'ACTIVATE' : 'DEACTIVATE', 'Managers', manager_id);
            return SELECT.one.from(Managers).where({ manager_id });
        });

        this.on('setUserActive', async (req) => {
            const { user_id, active } = req.data;
            if (user_id === req.user.id && !active) req.reject(409, 'You cannot deactivate your own user');
            const n = await UPDATE(db().Users).set({ active: !!active }).where({ user_id });
            if (!n) req.reject(404, 'User not found');
            await audit(active ? 'ACTIVATE' : 'DEACTIVATE', 'Users', user_id);
            return SELECT.one.from(Users).where({ user_id });
        });

        this.on('getStats', async (req) => {
            await ownership.checkOverdue(null);
            return stats.getStats({ userId: req.user.id });
        });
        this.on('getReport', (req) => stats.getReport(req, req.data.report));

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
