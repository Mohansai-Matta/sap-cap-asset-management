using { asset.management as db } from '../db/schema';
using { asset.management.common as common } from '../db/common';

/**
 * Service of the SAP Fiori elements apps (Assets, Employees, Managers, Departments)
 * and of the CRUD actions. Administrators only - see xs-security.json.
 */
@path    : '/odata/v4/catalog'
@requires: 'Admin'
service CatalogService {

    @odata.draft.enabled
    entity DepartmentSrv        as projection on db.Departments;

    @odata.draft.enabled
    entity EmployeeSrv          as projection on db.Employees;

    @odata.draft.enabled
    entity ManagerSrv           as projection on db.Managers;

    @odata.draft.enabled
    entity AssetSrv             as projection on db.Assets;

    entity AssetCategorySrv     as projection on db.AssetCategories;
    entity VendorSrv            as projection on db.Vendors;
    entity OwnershipLedgerSrv   as projection on db.AssetAssignmentHistory;
    entity MaintenanceRecordSrv as projection on db.MaintenanceRecords;
    entity ArchiveRecordSrv     as projection on db.ArchiveRecords;

/* Department Actions */

    action CreateDepartment(
        dept_id     : common.Identifier,
        name        : String(100),
        cost_center : String(50)
    ) returns array of DepartmentSrv;

    action UpdateDepartment(
        dept_id     : common.Identifier,
        name        : String(100),
        cost_center : String(50)
    ) returns String;

    action DeleteDepartment(
        dept_id     : common.Identifier
    ) returns String;

/* Employee Actions */

action CreateEmployee(
    employee_id : common.Identifier,
    full_name   : String(100),
    email       : String(100),
    phone       : String(20),
    location    : String(100),
    status      : String(30),
    dept_id     : common.Identifier,
    designation : String(100),
    manager_id  : common.Identifier
) returns array of EmployeeSrv;

action UpdateEmployee(
    employee_id : common.Identifier,
    full_name   : String(100),
    email       : String(100),
    phone       : String(20),
    location    : String(100),
    status      : String(30),
    dept_id     : common.Identifier,
    designation : String(100),
    manager_id  : common.Identifier
) returns String;

action DeleteEmployee(
    employee_id : common.Identifier
) returns String;

/// manager 

action CreateManager(
    manager_id  : common.Identifier,
    full_name   : String(100),
    email       : String(100),
    phone       : String(20),
    employee_id : common.Identifier,
    dept_id     : common.Identifier
) returns array of ManagerSrv;

action UpdateManager(
    manager_id  : common.Identifier,
    full_name   : String(100),
    email       : String(100),
    phone       : String(20),
    employee_id : common.Identifier,
    dept_id     : common.Identifier
) returns String;

action DeleteManager(
    manager_id : common.Identifier
) returns String;


/* Vendor Actions */

action CreateVendor(
    vendor_id  : common.Identifier,
    manager_id : common.Identifier,
    name       : String(100),
    email      : String(100)
) returns array of VendorSrv;

action UpdateVendor(
    vendor_id  : common.Identifier,
    manager_id : common.Identifier,
    name       : String(100),
    email      : String(100)
) returns String;

action DeleteVendor(
    vendor_id : common.Identifier
) returns String;


/* =========================
   Asset Actions
========================= */
action CreateAsset(
    asset_id                : common.Identifier,
    asset_tag               : String(50),
    name                    : String(100),
    serial_number           : String(100),
    category_id             : common.Identifier,
    vendor_id               : common.Identifier,
    manager_id              : common.Identifier,
    model                   : String(100),
    purchase_date           : Date,
    purchase_cost           : Decimal(15,2),
    currency                : String(3), // ISO 4217 code, e.g. INR
    warranty_expiry         : Date,
    first_distribution_date : Date,
    status                  : String(30),
    employee_id             : common.Identifier,
    condition               : String(20),
    location                : String(100)
) returns array of AssetSrv;

action UpdateAsset(
    asset_id                : common.Identifier,
    asset_tag               : String(50),
    name                    : String(100),
    serial_number           : String(100),
    category_id             : common.Identifier,
    vendor_id               : common.Identifier,
    manager_id              : common.Identifier,
    model                   : String(100),
    purchase_date           : Date,
    purchase_cost           : Decimal(15,2),
    currency                : String(3), // ISO 4217 code, e.g. INR
    warranty_expiry         : Date,
    first_distribution_date : Date,
    status                  : String(30),
    employee_id             : common.Identifier,
    condition               : String(20),
    location                : String(100)
) returns String;

action DeleteAsset(
    asset_id : common.Identifier
) returns String;

// AssertCategory

action CreateAssetCategory(
    asset_category_id : common.Identifier,
    name              : String(100),
    lifespan_months   : Integer
) returns array of AssetCategorySrv;

action UpdateAssetCategory(
    asset_category_id : common.Identifier,
    name              : String(100),
    lifespan_months   : Integer
) returns String;

action DeleteAssetCategory(
    asset_category_id : common.Identifier
) returns String;


// owner ship ledger

action CreateOwnershipLedger(
    ledger_id         : common.Identifier,
    asset_id          : common.Identifier,
    from_employee_id  : common.Identifier,
    to_employee_id    : common.Identifier,
    action            : String(30),
    transition_date   : Date,
    manager_id        : common.Identifier,
    notes             : String(500),
    created_at        : Timestamp
) returns array of OwnershipLedgerSrv;

action UpdateOwnershipLedger(
    ledger_id         : common.Identifier,
    asset_id          : common.Identifier,
    from_employee_id  : common.Identifier,
    to_employee_id    : common.Identifier,
    action            : String(30),
    transition_date   : Date,
    manager_id        : common.Identifier,
    notes             : String(500),
    created_at        : Timestamp
) returns String;

action DeleteOwnershipLedger(
    ledger_id : common.Identifier
) returns String;

}

// the holder of an asset is changed through the ownership logic only
annotate CatalogService.AssetSrv with {
    current_holder @readonly;
};
