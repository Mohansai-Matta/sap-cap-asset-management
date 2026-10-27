using CatalogService as service from '../../srv/cat-service';

annotate service.ManagerSrv with @(
    UI.HeaderInfo        : {
        TypeName      : '{i18n>Manager}',
        TypeNamePlural: '{i18n>Managers}',
        Title         : { Value: full_name },
        Description   : { Value: email }
    },
    UI.SelectionFields   : [
        full_name,
        department_dept_id
    ],
    UI.LineItem          : [
        { Value: full_name },
        { Value: email },
        { Value: phone },
        { Value: employee_employee_id },
        { Value: department_dept_id }
    ],
    UI.FieldGroup #General: {
        Data: [
            { Value: full_name },
            { Value: email },
            { Value: phone },
            { Value: employee_employee_id },
            { Value: department_dept_id }
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
            Target: 'managed_assets/@UI.LineItem#Embedded'
        }
    ]
);
