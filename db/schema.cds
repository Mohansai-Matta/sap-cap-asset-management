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
        designation : String(100);
        status      : common.EmployeeStatus default 'Active';

        department  : Association to Departments @assert.target;

        /** the manager this employee reports to */
        manager     : Association to Managers @assert.target;

        asset       : Association to many Assets
                          on asset.current_holder = $self;

        /** set if this employee is also a manager */
        manager_profile : Association to one Managers
                          on manager_profile.employee = $self;

        user        : Association to one Users
                          on user.employee = $self;
}

/* Manager */
entity Managers : managed {
    key manager_id       : common.Identifier @Core.Computed;
        full_name        : String(100) @mandatory;
        email            : common.Email @mandatory;
        phone            : common.Phone;
        active           : Boolean default true;

        employee         : Association to Employees @assert.target;
        department       : Association to Departments @assert.target;

        team             : Association to many Employees
                               on team.manager = $self;

        managed_assets   : Association to many Assets
                               on managed_assets.manager = $self;
        vendors          : Association to many Vendors
                               on vendors.manager = $self;
        ownership_logs   : Association to many AssetAssignmentHistory
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
        name                    : String(100);
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

        condition               : common.AssetCondition default 'New';
        location                : String(100);

        status                  : common.AssetStatus default 'Available';

        current_holder          : Association to Employees @assert.target;

        /** maintained via the assign / transfer / return operations only */
        ownerships              : Association to many AssetOwnerships
                                      on ownerships.asset = $self;
        ownership_history       : Association to many AssetAssignmentHistory
                                      on ownership_history.asset = $self;
        requests                : Association to many AssetRequests
                                      on requests.asset = $self;
        maintenance_records     : Composition of many MaintenanceRecords
                                      on maintenance_records.asset = $self;
        archive_records         : Composition of many ArchiveRecords
                                      on archive_records.asset = $self;
}

/* Asset Assignment History (every assign / transfer / return / ownership change) */
entity AssetAssignmentHistory : managed {
    key ledger_id       : common.Identifier @Core.Computed;
        asset           : Association to Assets;
        ownership       : Association to AssetOwnerships;

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

/* Role (code list, maintained by the admin) */
entity Roles {
    key code        : common.UserRole;
        name        : String(50) @mandatory;
        description : String(500);
}

/*
 * Application user: maps a login (the user ID provided by the identity provider,
 * usually the e-mail address) to a role and to the employee record.
 * Authorization itself is enforced by the XSUAA role collections Admin / Manager / Employee.
 */
entity Users : managed {
    key user_id   : String(255);
        full_name : String(100) @mandatory;
        email     : common.Email;
        role      : Association to Roles @assert.target @mandatory;
        employee  : Association to Employees @assert.target;
        active    : Boolean default true;
}

/* Asset Ownership: who holds an asset from when to when */
entity AssetOwnerships : managed {
    key ownership_id         : common.Identifier @Core.Computed;
        asset                : Association to Assets @assert.target @mandatory;
        owner                : Association to Employees @assert.target @mandatory;
        start_date           : Date @mandatory;
        end_date             : Date;
        expected_return_date : Date;
        is_current           : Boolean default true;
        overdue_notified     : Boolean default false;
        notes                : String(500);
        transfers            : Association to many AssetAssignmentHistory
                                   on transfers.ownership = $self;
}

/* Asset Request: new asset, asset return or issue report raised by an employee */
entity AssetRequests : managed {
    key request_id    : common.Identifier @Core.Computed;
        type          : common.RequestType @mandatory;
        requested_by  : Association to Employees @assert.target @mandatory;
        asset         : Association to Assets @assert.target;
        category      : Association to AssetCategories @assert.target;
        issue_type    : common.IssueType;
        reason        : String(1000);
        needed_by     : Date;
        status        : common.RequestStatus default 'Pending';
        decided_by    : String(255);
        decided_at    : Timestamp;
        decision_note : String(500);
        maintenance   : Association to MaintenanceRecords;
}

/* Notification for one user */
entity Notifications : managed {
    key notification_id : common.Identifier @Core.Computed;
        recipient       : Association to Users;
        title           : String(200) @mandatory;
        message         : String(1000);
        type            : common.NotificationType default 'Info';
        is_read         : Boolean default false;
        related_entity  : String(50);
        related_id      : String(36);
}

/* Audit Log: who did what and when (written by the services, read-only) */
entity AuditLogs {
    key log_id     : common.Identifier;
        timestamp  : Timestamp @cds.on.insert: $now;
        user_id    : String(255) @cds.on.insert: $user;
        action     : String(30);
        entity     : String(100);
        entity_key : String(100);
        details    : String(2000);
}
