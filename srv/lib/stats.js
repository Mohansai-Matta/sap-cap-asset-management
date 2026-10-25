const { db, today, inList } = require('./common');

// Adds a where clause only if there are conditions
const whereIf = (q, where) => (where && Object.keys(where).length ? q.where(where) : q);

// COUNT is a BIGINT on SAP HANA and may be returned as a string
const count = async (entity, where) =>
    Number((await whereIf(SELECT.one.from(entity).columns('count(1) as n'), where))?.n ?? 0);

const rows = (entity, columns, ...conditions) =>
    whereIf(SELECT.from(entity).columns(...columns), Object.assign({}, ...conditions));

const inDays = (days) => new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);

/**
 * Key figures for the dashboards.
 * @param {{employeeIds?: string[], assetIds?: string[], userId?: string}} scope  - omit lists for "all records"
 */
const getStats = async (scope = {}) => {
    const { Assets, Employees, Managers, AssetRequests, MaintenanceRecords, AssetOwnerships, Notifications, Users } = db();
    const assetScope = scope.assetIds ? { asset_id: inList(scope.assetIds) } : {};
    const assetRef = scope.assetIds ? { asset_asset_id: inList(scope.assetIds) } : {};
    const empScope = scope.employeeIds ? { employee_id: inList(scope.employeeIds) } : {};
    const requesterScope = scope.employeeIds ? { requested_by_employee_id: inList(scope.employeeIds) } : {};
    const ownerScope = scope.employeeIds ? { owner_employee_id: inList(scope.employeeIds) } : {};

    const costRow = await whereIf(SELECT.one.from(MaintenanceRecords).columns('sum(cost) as total'), assetRef);

    return {
        totalAssets: await count(Assets, assetScope),
        assignedAssets: await count(Assets, { ...assetScope, status: 'Assigned' }),
        availableAssets: await count(Assets, { ...assetScope, status: 'Available' }),
        inRepairAssets: await count(Assets, { ...assetScope, status: 'InRepair' }),
        totalEmployees: await count(Employees, empScope),
        totalManagers: scope.employeeIds ? 0 : await count(Managers),
        activeManagers: scope.employeeIds ? 0 : await count(Managers, { active: true }),
        totalUsers: scope.employeeIds ? 0 : await count(Users),
        pendingRequests: await count(AssetRequests, { ...requesterScope, status: 'Pending' }),
        approvedRequests: await count(AssetRequests, { ...requesterScope, status: 'Approved' }),
        rejectedRequests: await count(AssetRequests, { ...requesterScope, status: 'Rejected' }),
        openIssues: await count(AssetRequests, { ...requesterScope, type: 'Issue', status: { in: ['Pending', 'InProgress'] } }),
        maintenanceRecords: await count(MaintenanceRecords, assetRef),
        openMaintenance: await count(MaintenanceRecords, { ...assetRef, status: { in: ['Open', 'InProgress'] } }),
        upcomingMaintenance: await count(MaintenanceRecords, { ...assetRef, next_due_date: { between: today(), and: inDays(30) } }),
        maintenanceCost: Number(costRow?.total ?? 0),
        overdueReturns: await count(AssetOwnerships, { ...ownerScope, is_current: true, expected_return_date: { '<': today() } }),
        upcomingReturns: await count(AssetOwnerships, { ...ownerScope, is_current: true, expected_return_date: { between: today(), and: inDays(30) } }),
        unreadNotifications: scope.userId ? await count(Notifications, { recipient_user_id: scope.userId, is_read: false }) : 0
    };
};

const group = (rows, labelOf, amountOf = () => 0) => {
    const map = new Map();
    for (const row of rows) {
        const label = labelOf(row) ?? '(none)';
        const entry = map.get(label) || { label, count: 0, amount: 0 };
        entry.count += 1;
        entry.amount += Number(amountOf(row) || 0);
        map.set(label, entry);
    }
    return [...map.values()]
        .map((e) => ({ ...e, amount: Math.round(e.amount * 100) / 100 }))
        .sort((a, b) => b.count - a.count || b.amount - a.amount);
};

const assigned = { current_holder_employee_id: { '!=': null } };

const REPORTS = {
    assetsByStatus: async (s) => group(await rows(db().Assets, ['status', 'purchase_cost'], s.asset), (r) => r.status, (r) => r.purchase_cost),
    assetsByCategory: async (s) => group(await rows(db().Assets, ['category.name as category', 'purchase_cost'], s.asset), (r) => r.category, (r) => r.purchase_cost),
    allocationByEmployee: async (s) => group(await rows(db().Assets, ['current_holder.full_name as holder', 'purchase_cost'], s.asset, assigned), (r) => r.holder, (r) => r.purchase_cost),
    allocationByManager: async (s) => group(await rows(db().Assets, ['manager.full_name as manager', 'purchase_cost'], s.asset), (r) => r.manager, (r) => r.purchase_cost),
    allocationByDepartment: async (s) => group(await rows(db().Assets, ['current_holder.department.name as department', 'purchase_cost'], s.asset, assigned), (r) => r.department, (r) => r.purchase_cost),
    maintenanceCostByAsset: async (s) => group(await rows(db().MaintenanceRecords, ['asset.asset_tag as tag', 'cost'], s.assetRef), (r) => r.tag, (r) => r.cost),
    maintenanceByStatus: async (s) => group(await rows(db().MaintenanceRecords, ['status', 'cost'], s.assetRef), (r) => r.status, (r) => r.cost),
    maintenanceByMonth: async (s) => group(await rows(db().MaintenanceRecords, ['reported_date', 'cost'], s.assetRef), (r) => r.reported_date?.slice(0, 7), (r) => r.cost)
        .sort((a, b) => String(a.label).localeCompare(String(b.label))),
    requestsByStatus: async (s) => group(await rows(db().AssetRequests, ['status'], s.requester), (r) => r.status),
    requestsByType: async (s) => group(await rows(db().AssetRequests, ['type'], s.requester), (r) => r.type),
    ownershipByEmployee: async (s) => group(await rows(db().AssetOwnerships, ['owner.full_name as owner'], s.owner), (r) => r.owner),
    assetHistoryByAction: async (s) => group(await rows(db().AssetAssignmentHistory, ['action'], s.assetRef), (r) => r.action)
};

const getReport = async (req, name, scope = {}) => {
    const report = REPORTS[name];
    if (!report) req.reject(400, `Unknown report '${name}'. Available: ${Object.keys(REPORTS).join(', ')}`);
    return report({
        asset: scope.assetIds ? { asset_id: inList(scope.assetIds) } : {},
        assetRef: scope.assetIds ? { asset_asset_id: inList(scope.assetIds) } : {},
        requester: scope.employeeIds ? { requested_by_employee_id: inList(scope.employeeIds) } : {},
        owner: scope.employeeIds ? { owner_employee_id: inList(scope.employeeIds) } : {}
    });
};

module.exports = { getStats, getReport, REPORT_NAMES: Object.keys(REPORTS) };
