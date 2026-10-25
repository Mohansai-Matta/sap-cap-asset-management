using CatalogService as service from '../../srv/cat-service';

annotate service.AssetSrv with @(
    UI.HeaderInfo          : {
        TypeName      : '{i18n>Asset}',
        TypeNamePlural: '{i18n>Assets}',
        Title         : { Value: asset_tag },
        Description   : { Value: name }
    },
    UI.SelectionFields     : [
        asset_tag,
        category_asset_category_id,
        status,
        current_holder_employee_id,
        vendor_vendor_id
    ],
    UI.LineItem            : [
        { Value: asset_tag },
        { Value: name },
        { Value: serial_number },
        { Value: model },
        { Value: category_asset_category_id },
        { Value: current_holder_employee_id },
        { Value: status },
        { Value: warranty_expiry }
    ],
    UI.HeaderFacets        : [{
        $Type : 'UI.ReferenceFacet',
        Target: '@UI.FieldGroup#Status'
    }],
    UI.FieldGroup #Status  : {
        Data: [
            { Value: status },
            { Value: current_holder_employee_id }
        ]
    },
    UI.FieldGroup #General : {
        Data: [
            { Value: asset_tag },
            { Value: name },
            { Value: serial_number },
            { Value: model },
            { Value: condition },
            { Value: location },
            { Value: category_asset_category_id },
            { Value: status }
        ]
    },
    UI.FieldGroup #Assignment: {
        Data: [
            { Value: current_holder_employee_id },
            { Value: manager_manager_id },
            { Value: first_distribution_date }
        ]
    },
    UI.FieldGroup #Purchase: {
        Data: [
            { Value: vendor_vendor_id },
            { Value: purchase_date },
            { Value: purchase_cost },
            { Value: warranty_expiry }
        ]
    },
    UI.Facets              : [
        {
            $Type : 'UI.CollectionFacet',
            ID    : 'DetailsFacet',
            Label : '{i18n>GeneralInformation}',
            Facets: [
                { $Type: 'UI.ReferenceFacet', ID: 'GeneralFacet', Label: '{i18n>GeneralInformation}', Target: '@UI.FieldGroup#General' },
                { $Type: 'UI.ReferenceFacet', ID: 'AssignmentFacet', Label: '{i18n>Assignment}', Target: '@UI.FieldGroup#Assignment' },
                { $Type: 'UI.ReferenceFacet', ID: 'PurchaseFacet', Label: '{i18n>Purchase}', Target: '@UI.FieldGroup#Purchase' }
            ]
        },
        { $Type: 'UI.ReferenceFacet', ID: 'OwnershipFacet', Label: '{i18n>OwnershipLedger}', Target: 'ownership_history/@UI.LineItem' },
        { $Type: 'UI.ReferenceFacet', ID: 'MaintenanceFacet', Label: '{i18n>MaintenanceRecord}', Target: 'maintenance_records/@UI.LineItem' },
        { $Type: 'UI.ReferenceFacet', ID: 'ArchiveFacet', Label: '{i18n>ArchiveRecord}', Target: 'archive_records/@UI.LineItem' }
    ]
);

annotate service.OwnershipLedgerSrv with @(
    UI.HeaderInfo: {
        TypeName      : '{i18n>OwnershipLedger}',
        TypeNamePlural: '{i18n>OwnershipLedger}',
        Title         : { Value: action }
    },
    UI.LineItem  : [
        { Value: transition_date },
        { Value: action },
        { Value: from_employee_employee_id },
        { Value: to_employee_employee_id },
        { Value: recorded_by_manager_id },
        { Value: notes }
    ],
    UI.FieldGroup #General: {
        Data: [
            { Value: action },
            { Value: transition_date },
            { Value: from_employee_employee_id },
            { Value: to_employee_employee_id },
            { Value: recorded_by_manager_id },
            { Value: notes }
        ]
    },
    UI.Facets    : [{ $Type: 'UI.ReferenceFacet', ID: 'GeneralFacet', Label: '{i18n>GeneralInformation}', Target: '@UI.FieldGroup#General' }]
);

annotate service.MaintenanceRecordSrv with @(
    UI.HeaderInfo: {
        TypeName      : '{i18n>MaintenanceRecord}',
        TypeNamePlural: '{i18n>MaintenanceRecord}',
        Title         : { Value: type }
    },
    UI.LineItem  : [
        { Value: type },
        { Value: reported_date },
        { Value: completed_date },
        { Value: status },
        { Value: service_vendor_vendor_id },
        { Value: cost },
        { Value: covered_by_warranty }
    ],
    UI.FieldGroup #General: {
        Data: [
            { Value: type },
            { Value: status },
            { Value: reported_by_manager_id },
            { Value: service_vendor_vendor_id },
            { Value: reported_date },
            { Value: completed_date },
            { Value: next_due_date },
            { Value: cost },
            { Value: covered_by_warranty },
            { Value: outcome },
            { Value: description }
        ]
    },
    UI.Facets    : [{ $Type: 'UI.ReferenceFacet', ID: 'GeneralFacet', Label: '{i18n>GeneralInformation}', Target: '@UI.FieldGroup#General' }]
);

annotate service.ArchiveRecordSrv with @(
    UI.HeaderInfo: {
        TypeName      : '{i18n>ArchiveRecord}',
        TypeNamePlural: '{i18n>ArchiveRecord}',
        Title         : { Value: reason }
    },
    UI.LineItem  : [
        { Value: archived_at },
        { Value: archived_by_manager_id },
        { Value: reason },
        { Value: disposal_method },
        { Value: disposal_cert_no }
    ],
    UI.FieldGroup #General: {
        Data: [
            { Value: archived_at },
            { Value: archived_by_manager_id },
            { Value: reason },
            { Value: disposal_method },
            { Value: disposal_cert_no }
        ]
    },
    UI.Facets    : [{ $Type: 'UI.ReferenceFacet', ID: 'GeneralFacet', Label: '{i18n>GeneralInformation}', Target: '@UI.FieldGroup#General' }]
);
