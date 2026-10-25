namespace asset.management;

using {
    Currency,
    managed
} from '@sap/cds/common';
using { asset.management.common as common } from './common';
using from '@sap/cds-common-content';

/* Department */
entity Departments : managed {
    key dept_id     : common.Identifier @Core.Computed;
        name        : String(100) @mandatory;
        cost_center : String(50);

        employees   : Association to many Employees
                          on employees.department = $self;
        manager     : Association to many Managers
                          on manager.department = $self;
}

/* Employee */
entity Employees : managed {
    key employee_id : common.Identifier @Core.Computed;
        full_name   : String(100) @mandatory;
        email       : common.Email @mandatory;
        phone       : common.Phone;
        location    : String(100);
        status      : common.EmployeeStatus default 'Active';

        department  : Association to Departments @assert.target;

        asset       : Association to many Assets
                          on asset.current_holder = $self;

        manager     : Association to Managers
                          on manager.employee = $self;
}

/* Manager */
entity Managers : managed {
    key manager_id       : common.Identifier @Core.Computed;
        full_name        : String(100) @mandatory;
        email            : common.Email @mandatory;
        phone            : common.Phone;

        employee         : Association to Employees @assert.target;
        department       : Association to Departments @assert.target;

        managed_assets   : Association to many Assets
                               on managed_assets.manager = $self;
        vendors          : Association to many Vendors
                               on vendors.manager = $self;
        ownership_logs   : Association to many OwnershipLedgers
                               on ownership_logs.recorded_by = $self;
        maintenance_logs : Association to many MaintenanceRecords
                               on maintenance_logs.reported_by = $self;
        archive_records  : Association to many ArchiveRecords
                               on archive_records.archived_by = $self;
}

/* Asset Category */
entity AssetCategories : managed {
    key asset_category_id : common.Identifier @Core.Computed;
        name              : String(100) @mandatory;
        lifespan_months   : Integer @assert.range: [1, 600];
}

/* Vendor */
entity Vendors : managed {
    key vendor_id : common.Identifier @Core.Computed;
        manager   : Association to Managers @assert.target;
        name      : String(100) @mandatory;
        email     : common.Email;
        asset     : Association to many Assets
                        on asset.vendor = $self;
}

/* Asset */
@assert.unique: { asset_tag: [asset_tag] }
entity Assets : managed {
    key asset_id                : common.Identifier @Core.Computed;
        asset_tag               : String(50) @mandatory;
        serial_number           : String(100);

        category                : Association to AssetCategories @assert.target;
        vendor                  : Association to Vendors @assert.target;
        manager                 : Association to Managers @assert.target;
        model                   : String(100);

        purchase_date           : Date;
        purchase_cost           : Decimal(15, 2) @assert.range: [0, _];
        currency                : Currency;

        warranty_expiry         : Date;
        first_distribution_date : Date;

        status                  : common.AssetStatus default 'InStock';

        current_holder          : Association to Employees @assert.target;

        ownership_history       : Composition of many OwnershipLedgers
                                      on ownership_history.asset = $self;
        maintenance_records     : Composition of many MaintenanceRecords
                                      on maintenance_records.asset = $self;
        archive_records         : Composition of many ArchiveRecords
                                      on archive_records.asset = $self;
}

/* Ownership Ledger */
entity OwnershipLedgers : managed {
    key ledger_id       : common.Identifier @Core.Computed;
        asset           : Association to Assets;

        from_employee   : Association to Employees @assert.target;
        to_employee     : Association to Employees @assert.target;

        action          : common.OwnershipAction;
        transition_date : Date;

        recorded_by     : Association to Managers @assert.target;

        notes           : String(500);

        created_at      : Timestamp @cds.on.insert: $now;
}

/* Maintenance Record */
entity MaintenanceRecords : managed {
    key maintenance_id      : common.Identifier @Core.Computed;
        asset               : Association to Assets;

        type                : String(50);

        reported_by         : Association to Managers @assert.target;
        service_vendor      : Association to Vendors @assert.target;

        reported_date       : Date;
        completed_date      : Date;

        status              : common.MaintenanceStatus default 'Open';

        outcome             : String(255);

        cost                : Decimal(15, 2) @assert.range: [0, _];
        currency            : Currency;

        covered_by_warranty : Boolean default false;

        next_due_date       : Date;

        description         : String(1000);
}

/* Archive Record */
entity ArchiveRecords : managed {
    key archive_id       : common.Identifier @Core.Computed;
        asset            : Association to Assets;

        archived_at      : Date;
        archived_by      : Association to Managers @assert.target;

        reason           : String(255);
        disposal_method  : String(100);
        disposal_cert_no : String(50);
}
