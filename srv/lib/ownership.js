const cds = require('@sap/cds');
const { db, today, assertDateOrder } = require('./common');
const { notifyEmployees } = require('./notify');
const { audit } = require('./audit');

const describe = (asset) => `${asset.asset_tag}${asset.name ? ` (${asset.name})` : ''}`;

const loadAsset = async (req, assetId) => {
    if (!assetId) req.reject(400, "Parameter 'asset_id' is required");
    const asset = await SELECT.one.from(db().Assets).where({ asset_id: assetId });
    if (!asset) req.reject(404, `Asset '${assetId}' not found`);
    return asset;
};

const loadActiveEmployee = async (req, employeeId, param = 'employee_id') => {
    if (!employeeId) req.reject(400, `Parameter '${param}' is required`);
    const employee = await SELECT.one.from(db().Employees).where({ employee_id: employeeId });
    if (!employee) req.reject(404, `Employee '${employeeId}' not found`);
    if (employee.status === 'Inactive') req.reject(409, `Employee ${employee.full_name} is inactive`);
    return employee;
};

const currentOwnership = (assetId) =>
    SELECT.one.from(db().AssetOwnerships).where({ asset_asset_id: assetId, is_current: true });

// open return requests of the previous holder become obsolete when the asset changes hands
const closeOpenReturnRequests = (assetId, employeeId, note, status = 'Cancelled') =>
    UPDATE(db().AssetRequests).set({ status, decision_note: note })
        .where({ asset_asset_id: assetId, requested_by_employee_id: employeeId, type: 'Return', status: 'Pending' });

const addHistory = (entry) => INSERT.into(db().AssetAssignmentHistory).entries({
    ledger_id: cds.utils.uuid(),
    ...entry
});

/**
 * Assigns an available asset to an employee.
 * Creates the ownership record and the history entry and updates the asset.
 */
const assign = async (req, { asset_id, employee_id, start_date, expected_return_date, notes, recorded_by }) => {
    const { Assets, AssetOwnerships } = db();
    const asset = await loadAsset(req, asset_id);
    if (asset.status !== 'Available' || asset.current_holder_employee_id) {
        req.reject(409, `Asset ${describe(asset)} is not available (status: ${asset.status})`);
    }
    const employee = await loadActiveEmployee(req, employee_id);
    const start = start_date || today();
    assertDateOrder(req, start, expected_return_date, 'Expected return date must not be before the start date');

    const ownership = {
        ownership_id: cds.utils.uuid(),
        asset_asset_id: asset_id,
        owner_employee_id: employee_id,
        start_date: start,
        expected_return_date,
        is_current: true,
        notes
    };
    await INSERT.into(AssetOwnerships).entries(ownership);
    await UPDATE(Assets).set({
        current_holder_employee_id: employee_id,
        status: 'Assigned',
        first_distribution_date: asset.first_distribution_date || start
    }).where({ asset_id });
    await addHistory({
        asset_asset_id: asset_id,
        ownership_ownership_id: ownership.ownership_id,
        to_employee_employee_id: employee_id,
        action: 'Assign',
        transition_date: start,
        recorded_by_manager_id: recorded_by,
        notes
    });
    await notifyEmployees([employee_id], {
        title: 'Asset assigned',
        message: `${describe(asset)} has been assigned to you`,
        type: 'Ownership', entity: 'Assets', id: asset_id
    });
    await audit('ASSIGN', 'Assets', asset_id, `${describe(asset)} assigned to ${employee.full_name}`);
    return SELECT.one.from(AssetOwnerships).where({ ownership_id: ownership.ownership_id });
};

/** Transfers an assigned asset from its current holder to another employee */
const transfer = async (req, { asset_id, to_employee_id, transfer_date, expected_return_date, notes, recorded_by }) => {
    const { Assets, AssetOwnerships } = db();
    const asset = await loadAsset(req, asset_id);
    const from = asset.current_holder_employee_id;
    if (!from) req.reject(409, `Asset ${describe(asset)} is not assigned to anyone - use Assign instead`);
    if (from === to_employee_id) req.reject(409, 'The asset is already assigned to this employee');
    const employee = await loadActiveEmployee(req, to_employee_id, 'to_employee_id');
    const date = transfer_date || today();

    const current = await currentOwnership(asset_id);
    if (current) {
        assertDateOrder(req, current.start_date, date, 'Transfer date must not be before the start of the current ownership');
        await UPDATE(AssetOwnerships).set({ end_date: date, is_current: false }).where({ ownership_id: current.ownership_id });
    }
    const ownership = {
        ownership_id: cds.utils.uuid(),
        asset_asset_id: asset_id,
        owner_employee_id: to_employee_id,
        start_date: date,
        expected_return_date,
        is_current: true,
        notes
    };
    await INSERT.into(AssetOwnerships).entries(ownership);
    await UPDATE(Assets).set({ current_holder_employee_id: to_employee_id, status: 'Assigned' }).where({ asset_id });
    await closeOpenReturnRequests(asset_id, from, `Asset transferred to ${employee.full_name}`);
    await addHistory({
        asset_asset_id: asset_id,
        ownership_ownership_id: ownership.ownership_id,
        from_employee_employee_id: from,
        to_employee_employee_id: to_employee_id,
        action: 'Transfer',
        transition_date: date,
        recorded_by_manager_id: recorded_by,
        notes
    });
    await notifyEmployees([to_employee_id], {
        title: 'Asset transferred to you',
        message: `${describe(asset)} has been transferred to you`,
        type: 'Ownership', entity: 'Assets', id: asset_id
    });
    await notifyEmployees([from], {
        title: 'Asset transferred',
        message: `${describe(asset)} has been transferred to ${employee.full_name}`,
        type: 'Ownership', entity: 'Assets', id: asset_id
    });
    await audit('TRANSFER', 'Assets', asset_id, `${describe(asset)} transferred to ${employee.full_name}`);
    return SELECT.one.from(AssetOwnerships).where({ ownership_id: ownership.ownership_id });
};

/** Returns an asset: ends the current ownership and makes the asset available again */
const returnAsset = async (req, { asset_id, return_date, condition, notes, recorded_by, status = 'Available' }) => {
    const { Assets, AssetOwnerships } = db();
    const asset = await loadAsset(req, asset_id);
    const from = asset.current_holder_employee_id;
    if (!from) req.reject(409, `Asset ${describe(asset)} is not assigned to anyone`);
    const date = return_date || today();

    const current = await currentOwnership(asset_id);
    if (current) {
        assertDateOrder(req, current.start_date, date, 'Return date must not be before the start of the current ownership');
        await UPDATE(AssetOwnerships).set({ end_date: date, is_current: false }).where({ ownership_id: current.ownership_id });
    }
    const changes = { current_holder_employee_id: null, status };
    if (condition) changes.condition = condition;
    await UPDATE(Assets).set(changes).where({ asset_id });
    await closeOpenReturnRequests(asset_id, from, 'Return recorded', 'Approved');
    await addHistory({
        asset_asset_id: asset_id,
        ownership_ownership_id: current?.ownership_id,
        from_employee_employee_id: from,
        action: 'Return',
        transition_date: date,
        recorded_by_manager_id: recorded_by,
        notes
    });
    await notifyEmployees([from], {
        title: 'Asset returned',
        message: `Return of ${describe(asset)} has been recorded`,
        type: 'Ownership', entity: 'Assets', id: asset_id
    });
    await audit('RETURN', 'Assets', asset_id, `${describe(asset)} returned${notes ? `: ${notes}` : ''}`);
    return current ? SELECT.one.from(AssetOwnerships).where({ ownership_id: current.ownership_id }) : null;
};

/** Changes the details of an ownership record; the change is written to the history */
const updateOwnership = async (req, { ownership_id, start_date, expected_return_date, notes, recorded_by }) => {
    const { AssetOwnerships } = db();
    if (!ownership_id) req.reject(400, "Parameter 'ownership_id' is required");
    const ownership = await SELECT.one.from(AssetOwnerships).where({ ownership_id });
    if (!ownership) req.reject(404, `Ownership '${ownership_id}' not found`);

    const changes = {};
    if (start_date !== undefined && start_date !== null) changes.start_date = start_date;
    if (expected_return_date !== undefined) changes.expected_return_date = expected_return_date;
    if (notes !== undefined) changes.notes = notes;
    const merged = { ...ownership, ...changes };
    assertDateOrder(req, merged.start_date, merged.end_date, 'Start date must not be after the end date');
    assertDateOrder(req, merged.start_date, merged.expected_return_date, 'Expected return date must not be before the start date');
    if (changes.expected_return_date !== ownership.expected_return_date) changes.overdue_notified = false;

    await UPDATE(AssetOwnerships).set(changes).where({ ownership_id });
    const described = Object.entries(changes)
        .filter(([k]) => k !== 'overdue_notified')
        .map(([k, v]) => `${k}: ${ownership[k] ?? '-'} → ${v ?? '-'}`).join('; ');
    await addHistory({
        asset_asset_id: ownership.asset_asset_id,
        ownership_ownership_id: ownership_id,
        from_employee_employee_id: ownership.owner_employee_id,
        to_employee_employee_id: ownership.owner_employee_id,
        action: 'Update',
        transition_date: today(),
        recorded_by_manager_id: recorded_by,
        notes: described || 'No changes'
    });
    await notifyEmployees([ownership.owner_employee_id], {
        title: 'Ownership details updated',
        message: described,
        type: 'Ownership', entity: 'AssetOwnerships', id: ownership_id
    });
    await audit('UPDATE_OWNERSHIP', 'AssetOwnerships', ownership_id, described);
    return SELECT.one.from(AssetOwnerships).where({ ownership_id });
};

/**
 * Creates notifications for ownerships whose expected return date has passed
 * (once per ownership) and returns the number of overdue ownerships.
 */
const checkOverdue = async (ownerIds) => {
    const { AssetOwnerships, Assets, Employees } = db();
    const where = { is_current: true, expected_return_date: { '<': today() } };
    if (ownerIds) where.owner_employee_id = { in: ownerIds.length ? ownerIds : ['-'] };
    const overdue = await SELECT.from(AssetOwnerships).where(where);
    const { approversOf, notify, usersOfEmployees } = require('./notify');
    for (const o of overdue.filter((x) => !x.overdue_notified)) {
        const asset = await SELECT.one.from(Assets).columns('asset_tag', 'name').where({ asset_id: o.asset_asset_id });
        const owner = await SELECT.one.from(Employees).columns('full_name').where({ employee_id: o.owner_employee_id });
        const text = `${asset ? describe(asset) : 'Asset'} held by ${owner?.full_name} was due back on ${o.expected_return_date}`;
        await notify([...await approversOf(o.owner_employee_id), ...await usersOfEmployees([o.owner_employee_id])], {
            title: 'Overdue asset return', message: text, type: 'Overdue', entity: 'AssetOwnerships', id: o.ownership_id
        });
        await UPDATE(AssetOwnerships).set({ overdue_notified: true }).where({ ownership_id: o.ownership_id });
    }
    return overdue.length;
};

module.exports = { assign, transfer, returnAsset, updateOwnership, checkOverdue, currentOwnership, describe };
