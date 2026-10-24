using CatalogService as service from '../../srv/cat-service';
annotate service.EmployeeSrv with @(
    UI.FieldGroup #GeneratedGroup : {
        $Type : 'UI.FieldGroupType',
        Data : [
            {
                $Type : 'UI.DataField',
                Label : 'full_name',
                Value : full_name,
            },
            {
                $Type : 'UI.DataField',
                Label : 'email',
                Value : email,
            },
            {
                $Type : 'UI.DataField',
                Label : 'phone',
                Value : phone,
            },
            {
                $Type : 'UI.DataField',
                Label : 'location',
                Value : location,
            },
            {
                $Type : 'UI.DataField',
                Label : 'status',
                Value : status,
            },
        ],
    },
    UI.Facets : [
        {
            $Type : 'UI.ReferenceFacet',
            ID : 'GeneratedFacet1',
            Label : 'General Information',
            Target : '@UI.FieldGroup#GeneratedGroup',
        },
    ],
    UI.LineItem : [
        {
            $Type : 'UI.DataField',
            Label : 'full_name',
            Value : full_name,
        },
        {
            $Type : 'UI.DataField',
            Label : 'email',
            Value : email,
        },
        {
            $Type : 'UI.DataField',
            Label : 'phone',
            Value : phone,
        },
        {
            $Type : 'UI.DataField',
            Label : 'location',
            Value : location,
        },
        {
            $Type : 'UI.DataField',
            Label : 'status',
            Value : status,
        },
    ],
);

annotate service.EmployeeSrv with {
    department @Common.ValueList : {
        $Type : 'Common.ValueListType',
        CollectionPath : 'DepartmentSrv',
        Parameters : [
            {
                $Type : 'Common.ValueListParameterInOut',
                LocalDataProperty : department_dept_id,
                ValueListProperty : 'dept_id',
            },
            {
                $Type : 'Common.ValueListParameterDisplayOnly',
                ValueListProperty : 'name',
            },
            {
                $Type : 'Common.ValueListParameterDisplayOnly',
                ValueListProperty : 'cost_center',
            },
        ],
    }
};

