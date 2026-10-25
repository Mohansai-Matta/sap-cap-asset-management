using { asset.management as db } from '../db/schema';

/* Field labels and value help used by all Fiori elements apps */

annotate db.Departments with @title: '{i18n>Department}' {
    dept_id     @title: '{i18n>DepartmentID}' @UI.Hidden;
    name        @title: '{i18n>DepartmentName}';
    cost_center @title: '{i18n>CostCenter}';
};

annotate db.Employees with @title: '{i18n>Employee}' {
    employee_id @title: '{i18n>EmployeeID}' @UI.Hidden;
    full_name   @title: '{i18n>FullName}';
    email       @title: '{i18n>Email}';
    phone       @title: '{i18n>Phone}';
    location    @title: '{i18n>Location}';
    designation @title: '{i18n>Designation}';
    status      @title: '{i18n>Status}';
    manager     @title: '{i18n>Manager}'
                @Common.Text: manager.full_name  @Common.TextArrangement: #TextOnly
                @Common.ValueList: {
                    CollectionPath: 'ManagerSrv',
                    Parameters    : [
                        { $Type: 'Common.ValueListParameterInOut', LocalDataProperty: manager_manager_id, ValueListProperty: 'manager_id' },
                        { $Type: 'Common.ValueListParameterDisplayOnly', ValueListProperty: 'full_name' }
                    ]
                };
    department  @title: '{i18n>Department}'
                @Common.Text: department.name  @Common.TextArrangement: #TextOnly
                @Common.ValueList: {
                    CollectionPath: 'DepartmentSrv',
                    Parameters    : [
                        { $Type: 'Common.ValueListParameterInOut', LocalDataProperty: department_dept_id, ValueListProperty: 'dept_id' },
                        { $Type: 'Common.ValueListParameterDisplayOnly', ValueListProperty: 'name' },
                        { $Type: 'Common.ValueListParameterDisplayOnly', ValueListProperty: 'cost_center' }
                    ]
                };
};

annotate db.Managers with @title: '{i18n>Manager}' {
    manager_id @title: '{i18n>ManagerID}' @UI.Hidden;
    full_name  @title: '{i18n>FullName}';
    email      @title: '{i18n>Email}';
    phone      @title: '{i18n>Phone}';
    active     @title: '{i18n>Active}';
    employee   @title: '{i18n>Employee}'
               @Common.Text: employee.full_name  @Common.TextArrangement: #TextOnly
               @Common.ValueList: {
                   CollectionPath: 'EmployeeSrv',
                   Parameters    : [
                       { $Type: 'Common.ValueListParameterInOut', LocalDataProperty: employee_employee_id, ValueListProperty: 'employee_id' },
                       { $Type: 'Common.ValueListParameterDisplayOnly', ValueListProperty: 'full_name' },
                       { $Type: 'Common.ValueListParameterDisplayOnly', ValueListProperty: 'email' },
                       { $Type: 'Common.ValueListParameterDisplayOnly', ValueListProperty: 'location' }
                   ]
               };
    department @title: '{i18n>Department}'
               @Common.Text: department.name  @Common.TextArrangement: #TextOnly
               @Common.ValueList: {
                   CollectionPath: 'DepartmentSrv',
                   Parameters    : [
                       { $Type: 'Common.ValueListParameterInOut', LocalDataProperty: department_dept_id, ValueListProperty: 'dept_id' },
                       { $Type: 'Common.ValueListParameterDisplayOnly', ValueListProperty: 'name' },
                       { $Type: 'Common.ValueListParameterDisplayOnly', ValueListProperty: 'cost_center' }
                   ]
               };
};

annotate db.AssetCategories with @title: '{i18n>AssetCategory}' {
    asset_category_id @title: '{i18n>AssetCategoryID}' @UI.Hidden;
    name              @title: '{i18n>CategoryName}';
    lifespan_months   @title: '{i18n>LifespanMonths}';
};

annotate db.Vendors with @title: '{i18n>Vendor}' {
    vendor_id @title: '{i18n>VendorID}' @UI.Hidden;
    name      @title: '{i18n>VendorName}';
    email     @title: '{i18n>Email}';
    manager   @title: '{i18n>Manager}'
              @Common.Text: manager.full_name  @Common.TextArrangement: #TextOnly;
};

annotate db.Assets with @title: '{i18n>Asset}' {
    asset_id                @title: '{i18n>AssetID}' @UI.Hidden;
    asset_tag               @title: '{i18n>AssetTag}';
    name                    @title: '{i18n>AssetName}';
    condition               @title: '{i18n>Condition}';
    location                @title: '{i18n>Location}';
    serial_number           @title: '{i18n>SerialNumber}';
    model                   @title: '{i18n>Model}';
    purchase_date           @title: '{i18n>PurchaseDate}';
    purchase_cost           @title: '{i18n>PurchaseCost}'  @Measures.ISOCurrency: currency_code;
    warranty_expiry         @title: '{i18n>WarrantyExpiry}';
    first_distribution_date @title: '{i18n>FirstDistributionDate}';
    status                  @title: '{i18n>Status}';
    category                @title: '{i18n>AssetCategory}'
                            @Common.Text: category.name  @Common.TextArrangement: #TextOnly
                            @Common.ValueList: {
                                CollectionPath: 'AssetCategorySrv',
                                Parameters    : [
                                    { $Type: 'Common.ValueListParameterInOut', LocalDataProperty: category_asset_category_id, ValueListProperty: 'asset_category_id' },
                                    { $Type: 'Common.ValueListParameterDisplayOnly', ValueListProperty: 'name' },
                                    { $Type: 'Common.ValueListParameterDisplayOnly', ValueListProperty: 'lifespan_months' }
                                ]
                            };
    vendor                  @title: '{i18n>Vendor}'
                            @Common.Text: vendor.name  @Common.TextArrangement: #TextOnly
                            @Common.ValueList: {
                                CollectionPath: 'VendorSrv',
                                Parameters    : [
                                    { $Type: 'Common.ValueListParameterInOut', LocalDataProperty: vendor_vendor_id, ValueListProperty: 'vendor_id' },
                                    { $Type: 'Common.ValueListParameterDisplayOnly', ValueListProperty: 'name' },
                                    { $Type: 'Common.ValueListParameterDisplayOnly', ValueListProperty: 'email' }
                                ]
                            };
    manager                 @title: '{i18n>Manager}'
                            @Common.Text: manager.full_name  @Common.TextArrangement: #TextOnly
                            @Common.ValueList: {
                                CollectionPath: 'ManagerSrv',
                                Parameters    : [
                                    { $Type: 'Common.ValueListParameterInOut', LocalDataProperty: manager_manager_id, ValueListProperty: 'manager_id' },
                                    { $Type: 'Common.ValueListParameterDisplayOnly', ValueListProperty: 'full_name' },
                                    { $Type: 'Common.ValueListParameterDisplayOnly', ValueListProperty: 'email' }
                                ]
                            };
    current_holder          @title: '{i18n>CurrentHolder}'
                            @Common.Text: current_holder.full_name  @Common.TextArrangement: #TextOnly
                            @Common.ValueList: {
                                CollectionPath: 'EmployeeSrv',
                                Parameters    : [
                                    { $Type: 'Common.ValueListParameterInOut', LocalDataProperty: current_holder_employee_id, ValueListProperty: 'employee_id' },
                                    { $Type: 'Common.ValueListParameterDisplayOnly', ValueListProperty: 'full_name' },
                                    { $Type: 'Common.ValueListParameterDisplayOnly', ValueListProperty: 'email' }
                                ]
                            };
};

annotate db.AssetAssignmentHistory with @title: '{i18n>OwnershipLedger}' {
    ledger_id       @title: '{i18n>LedgerID}' @UI.Hidden;
    action          @title: '{i18n>Action}';
    transition_date @title: '{i18n>TransitionDate}';
    notes           @title: '{i18n>Notes}'  @UI.MultiLineText;
    created_at      @title: '{i18n>CreatedAt}'  @Core.Computed;
    from_employee   @title: '{i18n>FromEmployee}'
                    @Common.Text: from_employee.full_name  @Common.TextArrangement: #TextOnly
                    @Common.ValueList: {
                        CollectionPath: 'EmployeeSrv',
                        Parameters    : [
                            { $Type: 'Common.ValueListParameterInOut', LocalDataProperty: from_employee_employee_id, ValueListProperty: 'employee_id' },
                            { $Type: 'Common.ValueListParameterDisplayOnly', ValueListProperty: 'full_name' }
                        ]
                    };
    to_employee     @title: '{i18n>ToEmployee}'
                    @Common.Text: to_employee.full_name  @Common.TextArrangement: #TextOnly
                    @Common.ValueList: {
                        CollectionPath: 'EmployeeSrv',
                        Parameters    : [
                            { $Type: 'Common.ValueListParameterInOut', LocalDataProperty: to_employee_employee_id, ValueListProperty: 'employee_id' },
                            { $Type: 'Common.ValueListParameterDisplayOnly', ValueListProperty: 'full_name' }
                        ]
                    };
    recorded_by     @title: '{i18n>RecordedBy}'
                    @Common.Text: recorded_by.full_name  @Common.TextArrangement: #TextOnly
                    @Common.ValueList: {
                        CollectionPath: 'ManagerSrv',
                        Parameters    : [
                            { $Type: 'Common.ValueListParameterInOut', LocalDataProperty: recorded_by_manager_id, ValueListProperty: 'manager_id' },
                            { $Type: 'Common.ValueListParameterDisplayOnly', ValueListProperty: 'full_name' }
                        ]
                    };
};

annotate db.MaintenanceRecords with @title: '{i18n>MaintenanceRecord}' {
    maintenance_id      @title: '{i18n>MaintenanceID}' @UI.Hidden;
    type                @title: '{i18n>MaintenanceType}';
    reported_date       @title: '{i18n>ReportedDate}';
    completed_date      @title: '{i18n>CompletedDate}';
    status              @title: '{i18n>Status}';
    outcome             @title: '{i18n>Outcome}';
    cost                @title: '{i18n>Cost}'  @Measures.ISOCurrency: currency_code;
    covered_by_warranty @title: '{i18n>CoveredByWarranty}';
    next_due_date       @title: '{i18n>NextDueDate}';
    description         @title: '{i18n>Description}'  @UI.MultiLineText;
    reported_by         @title: '{i18n>ReportedBy}'
                        @Common.Text: reported_by.full_name  @Common.TextArrangement: #TextOnly
                        @Common.ValueList: {
                            CollectionPath: 'ManagerSrv',
                            Parameters    : [
                                { $Type: 'Common.ValueListParameterInOut', LocalDataProperty: reported_by_manager_id, ValueListProperty: 'manager_id' },
                                { $Type: 'Common.ValueListParameterDisplayOnly', ValueListProperty: 'full_name' }
                            ]
                        };
    service_vendor      @title: '{i18n>ServiceVendor}'
                        @Common.Text: service_vendor.name  @Common.TextArrangement: #TextOnly
                        @Common.ValueList: {
                            CollectionPath: 'VendorSrv',
                            Parameters    : [
                                { $Type: 'Common.ValueListParameterInOut', LocalDataProperty: service_vendor_vendor_id, ValueListProperty: 'vendor_id' },
                                { $Type: 'Common.ValueListParameterDisplayOnly', ValueListProperty: 'name' }
                            ]
                        };
};

annotate db.ArchiveRecords with @title: '{i18n>ArchiveRecord}' {
    archive_id       @title: '{i18n>ArchiveID}' @UI.Hidden;
    archived_at      @title: '{i18n>ArchivedAt}';
    reason           @title: '{i18n>Reason}';
    disposal_method  @title: '{i18n>DisposalMethod}';
    disposal_cert_no @title: '{i18n>DisposalCertNo}';
    archived_by      @title: '{i18n>ArchivedBy}'
                     @Common.Text: archived_by.full_name  @Common.TextArrangement: #TextOnly
                     @Common.ValueList: {
                         CollectionPath: 'ManagerSrv',
                         Parameters    : [
                             { $Type: 'Common.ValueListParameterInOut', LocalDataProperty: archived_by_manager_id, ValueListProperty: 'manager_id' },
                             { $Type: 'Common.ValueListParameterDisplayOnly', ValueListProperty: 'full_name' }
                         ]
                     };
};

annotate db.Roles with @title: '{i18n>Role}' {
    code        @title: '{i18n>RoleCode}';
    name        @title: '{i18n>RoleName}';
    description @title: '{i18n>Description}';
};

annotate db.Users with @title: '{i18n>User}' {
    user_id   @title: '{i18n>UserID}';
    full_name @title: '{i18n>FullName}';
    email     @title: '{i18n>Email}';
    role      @title: '{i18n>Role}';
    employee  @title: '{i18n>Employee}';
    active    @title: '{i18n>Active}';
};

annotate db.AssetOwnerships with @title: '{i18n>AssetOwnership}' {
    ownership_id         @title: '{i18n>OwnershipID}' @UI.Hidden;
    asset                @title: '{i18n>Asset}';
    owner                @title: '{i18n>Owner}';
    start_date           @title: '{i18n>StartDate}';
    end_date             @title: '{i18n>EndDate}';
    expected_return_date @title: '{i18n>ExpectedReturnDate}';
    is_current           @title: '{i18n>IsCurrent}';
    notes                @title: '{i18n>Notes}';
};

annotate db.AssetRequests with @title: '{i18n>AssetRequest}' {
    request_id    @title: '{i18n>RequestID}' @UI.Hidden;
    type          @title: '{i18n>RequestType}';
    requested_by  @title: '{i18n>RequestedBy}';
    asset         @title: '{i18n>Asset}';
    category      @title: '{i18n>AssetCategory}';
    issue_type    @title: '{i18n>IssueType}';
    reason        @title: '{i18n>Reason}';
    needed_by     @title: '{i18n>NeededBy}';
    status        @title: '{i18n>Status}';
    decided_by    @title: '{i18n>DecidedBy}';
    decided_at    @title: '{i18n>DecidedAt}';
    decision_note @title: '{i18n>DecisionNote}';
};

annotate db.Notifications with @title: '{i18n>Notification}';
annotate db.AuditLogs with @title: '{i18n>AuditLog}';
