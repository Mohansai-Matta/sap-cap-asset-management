using CatalogService as service from '../../srv/cat-service';

annotate service.DepartmentSrv with @(
    UI.HeaderInfo        : {
        TypeName      : '{i18n>Department}',
        TypeNamePlural: '{i18n>Departments}',
        Title         : { Value: name },
        Description   : { Value: cost_center }
    },
    UI.SelectionFields   : [
        name,
        cost_center
    ],
    UI.LineItem          : [
        { Value: name },
        { Value: cost_center }
    ],
    UI.FieldGroup #General: {
        Data: [
            { Value: name },
            { Value: cost_center }
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
            ID    : 'EmployeesFacet',
            Label : '{i18n>Employees}',
            Target: 'employees/@UI.LineItem#Embedded'
        },
        {
            $Type : 'UI.ReferenceFacet',
            ID    : 'ManagersFacet',
            Label : '{i18n>Managers}',
            Target: 'manager/@UI.LineItem#Embedded'
        }
    ]
);

annotate service.EmployeeSrv with @(
    UI.LineItem #Embedded: [
        { Value: full_name },
        { Value: email },
        { Value: location },
        { Value: status }
    ]
);

annotate service.ManagerSrv with @(
    UI.LineItem #Embedded: [
        { Value: full_name },
        { Value: email },
        { Value: phone }
    ]
);
