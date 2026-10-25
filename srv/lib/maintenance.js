const { db, today, assertDateOrder } = require('./common');
const { notifyEmployees } = require('./notify');
const { audit } = require('./audit');
const { describe } = require('./ownership');

/**
 * Updates the status of a maintenance record and keeps the asset (and a linked issue report) in sync.
 */
const updateStatus = async (req, { maintenance_id, status, completed_date, outcome, cost }) => {
    const { MaintenanceRecords, Assets, AssetRequests } = db();
    if (!maintenance_id) req.reject(400, "Parameter 'maintenance_id' is required");
    const allowed = ['Open', 'InProgress', 'Completed', 'Cancelled'];
    if (!allowed.includes(status)) req.reject(400, `Status must be one of: ${allowed.join(', ')}`);
    if (cost !== undefined && cost !== null && cost < 0) req.reject(400, 'Cost must not be negative');

    const record = await SELECT.one.from(MaintenanceRecords).where({ maintenance_id });
    if (!record) req.reject(404, `Maintenance record '${maintenance_id}' not found`);

    const changes = { status };
    if (status === 'Completed') changes.completed_date = completed_date || today();
    if (outcome !== undefined && outcome !== null) changes.outcome = outcome;
    if (cost !== undefined && cost !== null) changes.cost = cost;
    assertDateOrder(req, record.reported_date, changes.completed_date, 'Completed date must not be before the reported date');
    await UPDATE(MaintenanceRecords).set(changes).where({ maintenance_id });

    const asset = await SELECT.one.from(Assets).where({ asset_id: record.asset_asset_id });
    if (asset) {
        if (status === 'InProgress' && ['Assigned', 'Available'].includes(asset.status)) {
            await UPDATE(Assets).set({ status: 'InRepair' }).where({ asset_id: asset.asset_id });
        }
        if (['Completed', 'Cancelled'].includes(status) && asset.status === 'InRepair') {
            await UPDATE(Assets).set({ status: asset.current_holder_employee_id ? 'Assigned' : 'Available' })
                .where({ asset_id: asset.asset_id });
        }
        await notifyEmployees([asset.current_holder_employee_id], {
            title: 'Maintenance update',
            message: `Maintenance "${record.type || ''}" for ${describe(asset)} is now ${status}`,
            type: 'Maintenance', entity: 'MaintenanceRecords', id: maintenance_id
        });
    }

    if (status === 'Completed') {
        const issues = await SELECT.from(AssetRequests).where({ maintenance_maintenance_id: maintenance_id, status: 'InProgress' });
        for (const issue of issues) {
            await UPDATE(AssetRequests).set({ status: 'Resolved', decision_note: outcome || 'Maintenance completed' })
                .where({ request_id: issue.request_id });
            await notifyEmployees([issue.requested_by_employee_id], {
                title: 'Issue resolved', message: 'The maintenance for your reported issue has been completed',
                type: 'Request', entity: 'AssetRequests', id: issue.request_id
            });
        }
    }
    await audit('MAINTENANCE_STATUS', 'MaintenanceRecords', maintenance_id, `Status ${record.status} → ${status}`);
    return SELECT.one.from(MaintenanceRecords).where({ maintenance_id });
};

/** Notifies the asset holder about a newly created maintenance record */
const afterCreate = async (record) => {
    const asset = await SELECT.one.from(db().Assets).where({ asset_id: record.asset_asset_id });
    if (!asset) return;
    if (record.status === 'InProgress' && ['Assigned', 'Available'].includes(asset.status)) {
        await UPDATE(db().Assets).set({ status: 'InRepair' }).where({ asset_id: asset.asset_id });
    }
    await notifyEmployees([asset.current_holder_employee_id], {
        title: 'Maintenance scheduled',
        message: `Maintenance "${record.type || ''}" was recorded for ${describe(asset)}${record.next_due_date ? `, next service on ${record.next_due_date}` : ''}`,
        type: 'Maintenance', entity: 'MaintenanceRecords', id: record.maintenance_id
    });
};

module.exports = { updateStatus, afterCreate };
