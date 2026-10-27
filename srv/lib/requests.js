const cds = require('@sap/cds');
const { db, today } = require('./common');
const { notifyEmployees } = require('./notify');
const { audit } = require('./audit');
const ownership = require('./ownership');

const loadRequest = async (req, request_id) => {
    if (!request_id) req.reject(400, "Parameter 'request_id' is required");
    const request = await SELECT.one.from(db().AssetRequests).where({ request_id });
    if (!request) req.reject(404, `Request '${request_id}' not found`);
    return request;
};

const requesterName = async (employeeId) =>
    (await SELECT.one.from(db().Employees).columns('full_name').where({ employee_id: employeeId }))?.full_name;

/** The active manager assigned to an employee - asset requests are sent to this manager */
const assignedManager = async (employeeId) => {
    const { Employees, Managers } = db();
    const employee = await SELECT.one.from(Employees).columns('manager_manager_id').where({ employee_id: employeeId });
    if (!employee?.manager_manager_id) return null;
    return SELECT.one.from(Managers).columns('manager_id', 'full_name', 'email', 'employee_employee_id')
        .where({ manager_id: employee.manager_manager_id, active: true });
};

/**
 * Creates a request of an employee: New (asset), Return or Issue.
 * The request is sent to the employee's assigned manager.
 */
const create = async (req, { type, employee_id, asset_id, category_id, issue_type, reason, needed_by }) => {
    const { AssetRequests, Assets, AssetCategories } = db();
    let asset, category;

    const manager = await assignedManager(employee_id);
    if (!manager) req.reject(400, 'No manager is assigned to you. Please ask the administrator to assign your manager, then send the request again.');

    if (type === 'New') {
        if (!category_id) req.reject(400, 'Please select an asset category');
        category = await SELECT.one.from(AssetCategories).where({ asset_category_id: category_id });
        if (!category) req.reject(400, 'Asset category does not exist');
        if (needed_by && needed_by < today()) req.reject(400, "'Needed by' must not be in the past");
    } else {
        if (!asset_id) req.reject(400, 'Please select an asset');
        asset = await SELECT.one.from(Assets).where({ asset_id });
        if (!asset || asset.current_holder_employee_id !== employee_id) {
            req.reject(403, 'You can only raise requests for assets that are assigned to you');
        }
        const open = await SELECT.one.from(AssetRequests).columns('request_id').where({
            asset_asset_id: asset_id, type, status: { in: ['Pending', 'InProgress'] }
        });
        if (open) req.reject(409, `There is already an open ${type === 'Issue' ? 'issue report' : 'return request'} for this asset`);
        if (type === 'Issue' && !issue_type) req.reject(400, 'Please select the issue type');
        if (!reason) req.reject(400, type === 'Issue' ? 'Please describe the issue' : 'Please enter a reason');
    }

    const row = {
        request_id: cds.utils.uuid(),
        type,
        requested_by_employee_id: employee_id,
        asset_asset_id: asset_id,
        category_asset_category_id: category_id,
        issue_type: type === 'Issue' ? issue_type : null,
        reason,
        needed_by,
        status: 'Pending'
    };
    await INSERT.into(AssetRequests).entries(row);

    const who = await requesterName(employee_id);
    const what = type === 'New' ? `a new ${category.name}`
        : type === 'Return' ? `to return ${ownership.describe(asset)}`
        : `an issue (${issue_type}) for ${ownership.describe(asset)}`;
    await notifyEmployees([manager.employee_employee_id], {
        title: type === 'Issue' ? 'Asset issue reported' : type === 'Return' ? 'Asset return request' : 'New asset request',
        message: `${who} ${type === 'Issue' ? 'reported' : 'requested'} ${what}`,
        type: 'Request', entity: 'AssetRequests', id: row.request_id
    });
    await audit('CREATE_REQUEST', 'AssetRequests', row.request_id, `${type} request by ${who} to ${manager.full_name}`);
    return SELECT.one.from(AssetRequests).where({ request_id: row.request_id });
};

const decide = async (request, changes, message) => {
    const { AssetRequests } = db();
    await UPDATE(AssetRequests).set({
        ...changes,
        decided_by: cds.context.user.id,
        decided_at: new Date().toISOString()
    }).where({ request_id: request.request_id });
    await notifyEmployees([request.requested_by_employee_id], {
        title: `Request ${changes.status === 'InProgress' ? 'in progress' : changes.status.toLowerCase()}`,
        message, type: 'Request', entity: 'AssetRequests', id: request.request_id
    });
    await audit(`REQUEST_${changes.status.toUpperCase()}`, 'AssetRequests', request.request_id, message);
    return SELECT.one.from(AssetRequests).where({ request_id: request.request_id });
};

/**
 * Approves a pending request and performs the follow-up:
 * - New:    assigns the selected available asset to the requester
 * - Return: records the return of the asset
 * - Issue:  Lost → asset marked lost; otherwise a maintenance record is opened
 */
const approve = async (req, { request_id, asset_id, note, recorded_by }) => {
    const { MaintenanceRecords, Assets } = db();
    const request = await loadRequest(req, request_id);
    if (request.status !== 'Pending') req.reject(409, `Only pending requests can be approved (status: ${request.status})`);

    if (request.type === 'New') {
        if (!asset_id) req.reject(400, 'Select an available asset to allocate for this request');
        const asset = await SELECT.one.from(Assets).columns('category_asset_category_id').where({ asset_id });
        if (asset && request.category_asset_category_id && asset.category_asset_category_id !== request.category_asset_category_id) {
            req.reject(400, 'The selected asset does not belong to the requested category');
        }
        await ownership.assign(req, {
            asset_id, employee_id: request.requested_by_employee_id, notes: note || 'Allocated on request', recorded_by
        });
        return decide(request, { status: 'Approved', asset_asset_id: asset_id, decision_note: note }, 'Your asset request has been approved and the asset was allocated to you');
    }

    if (request.type === 'Return') {
        const asset = await SELECT.one.from(Assets).columns('current_holder_employee_id').where({ asset_id: request.asset_asset_id });
        if (asset?.current_holder_employee_id !== request.requested_by_employee_id) {
            req.reject(409, 'The asset is no longer assigned to the requester - reject or cancel this request');
        }
        await ownership.returnAsset(req, { asset_id: request.asset_asset_id, notes: note || request.reason, recorded_by });
        return decide(request, { status: 'Approved', decision_note: note }, 'Your asset return has been approved and recorded');
    }

    // Issue
    if (request.issue_type === 'Lost') {
        await ownership.returnAsset(req, {
            asset_id: request.asset_asset_id, notes: `Reported lost: ${request.reason}`, recorded_by, status: 'Lost'
        });
        return decide(request, { status: 'Resolved', decision_note: note }, 'Your lost asset report has been processed');
    }
    const maintenance_id = cds.utils.uuid();
    await INSERT.into(MaintenanceRecords).entries({
        maintenance_id,
        asset_asset_id: request.asset_asset_id,
        type: request.issue_type,
        reported_by_manager_id: recorded_by,
        reported_date: today(),
        status: 'Open',
        description: request.reason
    });
    await UPDATE(Assets).set({ status: 'InRepair' }).where({ asset_id: request.asset_asset_id });
    await audit('CREATE', 'MaintenanceRecords', maintenance_id, `Opened for issue report ${request.request_id}`);
    return decide(request, { status: 'InProgress', decision_note: note, maintenance_maintenance_id: maintenance_id },
        'Your issue report was accepted and a maintenance record has been opened');
};

const reject = async (req, { request_id, note }) => {
    const request = await loadRequest(req, request_id);
    if (request.status !== 'Pending') req.reject(409, `Only pending requests can be rejected (status: ${request.status})`);
    if (!note) req.reject(400, 'Please enter a reason for the rejection');
    return decide(request, { status: 'Rejected', decision_note: note }, `Your request was rejected: ${note}`);
};

const resolve = async (req, { request_id, note }) => {
    const request = await loadRequest(req, request_id);
    if (request.type !== 'Issue' || !['Pending', 'InProgress'].includes(request.status)) {
        req.reject(409, 'Only open issue reports can be resolved');
    }
    return decide(request, { status: 'Resolved', decision_note: note }, `Your reported issue has been resolved${note ? `: ${note}` : ''}`);
};

const cancel = async (req, { request_id, employee_id }) => {
    const request = await loadRequest(req, request_id);
    if (request.requested_by_employee_id !== employee_id) req.reject(403, 'You can only cancel your own requests');
    if (request.status !== 'Pending') req.reject(409, 'Only pending requests can be cancelled');
    await UPDATE(db().AssetRequests).set({ status: 'Cancelled' }).where({ request_id });
    await audit('REQUEST_CANCELLED', 'AssetRequests', request_id);
    return SELECT.one.from(db().AssetRequests).where({ request_id });
};

module.exports = { create, approve, reject, resolve, cancel, loadRequest, assignedManager };
