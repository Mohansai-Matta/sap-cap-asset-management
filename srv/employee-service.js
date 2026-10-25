const cds = require('@sap/cds');
const { db, inList, today } = require('./lib/common');
const { requireEmployee } = require('./lib/context');
const requests = require('./lib/requests');
const { markRead } = require('./lib/notify');
const { addAssignedOn } = require('./lib/enrich');

module.exports = class EmployeeService extends cds.ApplicationService {

    init() {

        const {
            MyProfile, MyAssets, MyOwnerships, MyAssignmentHistory, MyMaintenance, MyRequests, Notifications
        } = this.entities;

        const me = async (req) => (await requireEmployee(req)).employee.employee_id;
        const myAssetIds = async (req) =>
            (await SELECT.from(db().Assets).columns('asset_id').where({ current_holder_employee_id: await me(req) }))
                .map((a) => a.asset_id);

        this.before('*', async (req) => { await requireEmployee(req); });

        /* =========================
           Only own records
        ========================= */

        this.before('READ', MyProfile, async (req) => { req.query.where({ employee_id: await me(req) }); });
        this.before('READ', MyAssets, async (req) => { req.query.where({ holder_id: await me(req) }); });
        this.after('READ', MyAssets, addAssignedOn);
        this.before('READ', MyOwnerships, async (req) => { req.query.where({ owner_id: await me(req) }); });
        this.before('READ', MyAssignmentHistory, async (req) => {
            const id = await me(req);
            req.query.where('(from_employee_id =', id, 'or to_employee_id =', id, ')');
        });
        this.before('READ', MyMaintenance, async (req) => {
            req.query.where({ asset_id: inList(await myAssetIds(req)) });
        });
        this.before('READ', MyRequests, async (req) => { req.query.where({ requested_by_id: await me(req) }); });
        this.before('READ', Notifications, (req) => { req.query.where({ recipient_user_id: req.user.id }); });

        /* =========================
           Actions
        ========================= */

        const asMyRequest = (row) => SELECT.one.from(MyRequests).where({ request_id: row.request_id });

        this.on('requestAsset', async (req) => asMyRequest(await requests.create(req, {
            type: 'New', employee_id: await me(req),
            category_id: req.data.category_id, reason: req.data.reason, needed_by: req.data.needed_by
        })));

        this.on('requestReturn', async (req) => asMyRequest(await requests.create(req, {
            type: 'Return', employee_id: await me(req), asset_id: req.data.asset_id, reason: req.data.reason
        })));

        this.on('reportIssue', async (req) => {
            const allowed = ['Damaged', 'Lost', 'Malfunction'];
            if (!allowed.includes(req.data.issue_type)) req.reject(400, `Issue type must be one of: ${allowed.join(', ')}`);
            return asMyRequest(await requests.create(req, {
                type: 'Issue', employee_id: await me(req), asset_id: req.data.asset_id,
                issue_type: req.data.issue_type, reason: req.data.description
            }));
        });

        this.on('cancelRequest', async (req) => asMyRequest(
            await requests.cancel(req, { request_id: req.data.request_id, employee_id: await me(req) })
        ));

        this.on('markNotificationRead', (req) => markRead(req.user.id, req.data.notification_id).then(() => {}));
        this.on('markAllNotificationsRead', (req) => markRead(req.user.id).then(() => {}));

        this.on('getStats', async (req) => {
            const { AssetRequests, MaintenanceRecords, AssetOwnerships, Notifications: N } = db();
            const id = await me(req);
            const assetIds = await myAssetIds(req);
            const count = async (entity, where) => Number((await SELECT.one.from(entity).columns('count(1) as n').where(where))?.n ?? 0);
            const in30 = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
            return {
                assignedAssets: assetIds.length,
                pendingRequests: await count(AssetRequests, { requested_by_employee_id: id, status: 'Pending' }),
                approvedRequests: await count(AssetRequests, { requested_by_employee_id: id, status: 'Approved' }),
                rejectedRequests: await count(AssetRequests, { requested_by_employee_id: id, status: 'Rejected' }),
                openIssues: await count(AssetRequests, { requested_by_employee_id: id, type: 'Issue', status: { in: ['Pending', 'InProgress'] } }),
                openMaintenance: await count(MaintenanceRecords, { asset_asset_id: inList(assetIds), status: { in: ['Open', 'InProgress'] } }),
                upcomingMaintenance: await count(MaintenanceRecords, { asset_asset_id: inList(assetIds), next_due_date: { between: today(), and: in30 } }),
                upcomingReturns: await count(AssetOwnerships, { owner_employee_id: id, is_current: true, expected_return_date: { between: today(), and: in30 } }),
                overdueReturns: await count(AssetOwnerships, { owner_employee_id: id, is_current: true, expected_return_date: { '<': today() } }),
                unreadNotifications: await count(N, { recipient_user_id: req.user.id, is_read: false })
            };
        });

        return super.init();
    }
};
