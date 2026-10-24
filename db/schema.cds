namespace asset.management;

using { Currency } from '@sap/cds/common';
using { asset.management.common as common } from './common';

/* Department */
entity Departments {

    key dept_id    : common.Identifier;

    name           : String(100);
    cost_center    : String(50);

    employees      : Association to many Employees
                        on employees.department = $self;
    manager : Association to many Managers on manager.department = $self;

}

/* Employee */
entity Employees {

    key employee_id : common.Identifier;

    full_name       : String(100);
    email           : String(100);
    phone           : String(20);
    location        : String(100);
    status          : String(30);

    department      : Association to Departments;
    
    asset           : Association to many Assets on asset.current_holder = $self;

    manager         : Association to Managers on manager.employee = $self;

}

/* Manager */

entity Managers {

    key manager_id  : common.Identifier;

    full_name       : String(100);
    email           : String(100);
    phone           : String(20);

    employee        : Association to Employees;

    department      : Association to Departments;

    managed_assets  : Association to many Assets
                        on managed_assets.manager = $self;

    vendors         : Association to many Vendors
                        on vendors.manager = $self;

    ownership_logs  : Association to many OwnershipLedgers
                        on ownership_logs.recorded_by = $self;

    maintenance_logs : Association to many MaintenanceRecords
                        on maintenance_logs.reported_by = $self;

    archive_records : Association to many ArchiveRecords
                        on archive_records.archived_by = $self;
}



/* Asset Category */
entity AssetCategories {

    key asset_category_id : common.Identifier;

    name                  : String(100);
    lifespan_months       : Integer;

}

/* Vendor */
entity Vendors {

    key vendor_id    : common.Identifier;
    manager          : Association to Managers;
    name             : String(100);
    email            : String(100);
    asset            : Association to many Assets on asset.vendor = $self;
}

/* Asset */
entity Assets {

    key asset_id            : common.Identifier;

    asset_tag               : String(50);
    serial_number           : String(100);

    category                : Association to AssetCategories;
    vendor                  : Association to Vendors;
    manager                 : Association to Managers;
    model                   : String(100);

    purchase_date           : Date;
    purchase_cost           : Decimal(15,2);
    currency                : Currency;

    warranty_expiry         : Date;
    first_distribution_date : Date;

    status                  : String(30);

    current_holder          : Association to Employees;
}

/* Ownership Ledger */
entity OwnershipLedgers {

    key ledger_id        : common.Identifier;

    asset                : Association to Assets;

    from_employee        : Association to Employees;
    to_employee          : Association to Employees;


    action               : String(30);
    transition_date      : Date;

    recorded_by          : Association to Managers;

    notes                : String(500);

    created_at           : Timestamp;
}

/* Maintenance Record */
entity MaintenanceRecords {

    key maintenance_id   : common.Identifier;

    asset                : Association to Assets;

    type                 : String(50);

    reported_by          : Association to Managers;

    service_vendor       : Association to Vendors;

    reported_date        : Date;
    completed_date       : Date;

    status               : String(30);

    outcome              : String(255);

    cost                 : Decimal(15,2);
    currency             : Currency;

    covered_by_warranty  : Boolean;

    next_due_date        : Date;

    description          : String(1000);
}

/* Archive Record */
entity ArchiveRecords {

    key archive_id       : common.Identifier;

    asset                : Association to Assets;

    archived_at          : Date;

    archived_by          : Association to Managers;

    reason               : String(255);

    disposal_method      : String(100);

    disposal_cert_no     : String(50);
}
