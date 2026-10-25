using CatalogService as service from '../../srv/cat-service';

annotate service.EmployeeSrv with @(
    UI.HeaderInfo        : {
        TypeName      : '{i18n>Employee}',
        TypeNamePlural: '{i18n>Employees}',
        Title         : { Value: full_name },
        Description   : { Value: email }
    },
    UI.SelectionFields   : [
        full_name,
        department_dept_id,
        location,
        status
    ],
    UI.LineItem          : [
        { Value: full_name },
        { Value: email },
        { Value: phone },
        { Value: location },
        { Value: department_dept_id },
        { Value: status }
    ],
    UI.FieldGroup #General: {
        Data: [
            { Value: full_name },
            { Value: email },
            { Value: phone },
            { Value: location },
            { Value: designation },
            { Value: department_dept_id },
            { Value: manager_manager_id },
            { Value: status }
        ]
    },
    UI.Facets            : [
        {
            $Type : 'UI.ReferenceFacet',
            ID    : 'GeneralFacet',
            Label : '{i18n>GeneralInformation}',
            Target: '@UI.FieldGroup#General'
        },
        {
            $Type : 'UI.ReferenceFacet',
            ID    : 'AssetsFacet',
            Label : '{i18n>Assets}',
            Target: 'asset/@UI.LineItem#Embedded'
        }
    ]
);

annotate service.AssetSrv with @(
    UI.LineItem #Embedded: [
        { Value: asset_tag },
        { Value: model },
        { Value: serial_number },
        { Value: status }
    ]
);
