const cds = require('@sap/cds');

const db = () => cds.entities('asset.management');

const today = () => new Date().toISOString().slice(0, 10);

// Removes undefined values so that UPDATE only touches the fields that were sent
const defined = (obj) => Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined)
);

// IN-list condition that also works for empty lists
const inList = (ids) => ({ in: ids.length ? ids : ['00000000-0000-0000-0000-000000000000'] });

const assertDateOrder = (req, from, to, message) => {
    if (from && to && new Date(to) < new Date(from)) req.reject(400, message);
};

// Rejects the request if a referenced record does not exist
const assertExists = async (req, entity, key, value, label) => {
    if (value === undefined || value === null) return null;
    const found = await SELECT.one.from(entity).where({ [key]: value });
    if (!found) req.reject(400, `${label} '${value}' does not exist`);
    return found;
};

// Rejects the request if other records still point to the record to be deleted
const assertNoDependents = async (req, dependents, value, label) => {
    for (const { entity, fk, what } of dependents) {
        const used = await SELECT.one.from(entity).columns('1 as x').where({ [fk]: value });
        if (used) req.reject(409, `${label} cannot be deleted because it is still referenced by ${what}`);
    }
};

/**
 * Records that must not exist when a record is deleted (by db entity name).
 * Shared by all services so that the rules are the same everywhere.
 */
const dependentsOf = (name) => {
    const e = db();
    return {
        Departments: [
            { entity: e.Employees, fk: 'department_dept_id', what: 'employees' },
            { entity: e.Managers, fk: 'department_dept_id', what: 'managers' }
        ],
        Employees: [
            { entity: e.Assets, fk: 'current_holder_employee_id', what: 'assets currently assigned to the employee' },
            { entity: e.Managers, fk: 'employee_employee_id', what: 'a manager record' },
            { entity: e.AssetOwnerships, fk: 'owner_employee_id', what: 'asset ownership records' },
            { entity: e.AssetRequests, fk: 'requested_by_employee_id', what: 'asset requests' }
        ],
        Managers: [
            { entity: e.Vendors, fk: 'manager_manager_id', what: 'vendors' },
            { entity: e.Assets, fk: 'manager_manager_id', what: 'assets' },
            { entity: e.Employees, fk: 'manager_manager_id', what: 'employees reporting to the manager' }
        ],
        Vendors: [
            { entity: e.Assets, fk: 'vendor_vendor_id', what: 'assets' },
            { entity: e.MaintenanceRecords, fk: 'service_vendor_vendor_id', what: 'maintenance records' }
        ],
        AssetCategories: [
            { entity: e.Assets, fk: 'category_asset_category_id', what: 'assets' },
            { entity: e.AssetRequests, fk: 'category_asset_category_id', what: 'asset requests' }
        ],
        Roles: [
            { entity: e.Users, fk: 'role_code', what: 'users' }
        ]
    }[name] || [];
};

// An asset that is assigned to someone must be returned before it can be deleted
const assertAssetDeletable = async (req, assetId) => {
    const asset = await SELECT.one.from(db().Assets).columns('current_holder_employee_id').where({ asset_id: assetId });
    if (asset?.current_holder_employee_id) {
        req.reject(409, 'Asset is currently assigned to an employee. Return the asset before deleting it');
    }
};

// Removes records that belong to an asset (history, ownership, maintenance, requests, archive)
const deleteAssetChildren = async (assetId) => {
    const e = db();
    await DELETE.from(e.AssetRequests).where({ asset_asset_id: assetId });
    await DELETE.from(e.AssetAssignmentHistory).where({ asset_asset_id: assetId });
    await DELETE.from(e.AssetOwnerships).where({ asset_asset_id: assetId });
    await DELETE.from(e.MaintenanceRecords).where({ asset_asset_id: assetId });
    await DELETE.from(e.ArchiveRecords).where({ asset_asset_id: assetId });
};

const validateAsset = (req, asset) => {
    assertDateOrder(req, asset.purchase_date, asset.warranty_expiry,
        'Warranty expiry must not be before the purchase date');
    assertDateOrder(req, asset.purchase_date, asset.first_distribution_date,
        'First distribution date must not be before the purchase date');
};

const validateMaintenance = (req, record) => {
    assertDateOrder(req, record.reported_date, record.completed_date,
        'Completed date must not be before the reported date');
};

const assertUniqueAssetTag = async (req, asset) => {
    if (!asset.asset_tag) return;
    const other = await SELECT.one.from(db().Assets).columns('asset_id').where({ asset_tag: asset.asset_tag });
    if (other && other.asset_id !== asset.asset_id) {
        req.reject(409, `Asset tag '${asset.asset_tag}' is already used by another asset`);
    }
};

module.exports = {
    db,
    today,
    defined,
    inList,
    assertDateOrder,
    assertExists,
    assertNoDependents,
    dependentsOf,
    assertAssetDeletable,
    deleteAssetChildren,
    validateAsset,
    validateMaintenance,
    assertUniqueAssetTag
};
