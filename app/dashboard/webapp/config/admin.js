sap.ui.define([
    "sap/m/IconTabBar",
    "sap/m/IconTabFilter",
    "sap/m/MessageBox",
    "sap/m/MessageToast",
    "sap/m/Text",
    "sap/m/VBox",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "../util/EntityTable",
    "../util/Charts",
    "../util/Sections",
    "../util/Actions",
    "../util/api",
    "../util/format"
], function (IconTabBar, IconTabFilter, MessageBox, MessageToast, Text, VBox, Filter, FilterOperator,
    EntityTable, Charts, Sections, Actions, api, format) {
    "use strict";

    const SERVICE = "/odata/v4/admin";

    const opts = (keys) => keys.map((k) => ({ key: k, text: format.status(k) }));
    const EMPLOYEE_STATUS = opts(["Active", "Inactive", "OnLeave"]);
    const ASSET_STATUS = opts(["Available", "Assigned", "InRepair", "Lost", "Retired", "Archived"]);
    const EDITABLE_ASSET_STATUS = opts(["Available", "InRepair", "Lost", "Retired", "Archived"]);
    const REQUEST_STATUS = opts(["Pending", "Approved", "Rejected", "InProgress", "Resolved", "Cancelled"]);
    const MAINTENANCE_STATUS = opts(["Open", "InProgress", "Completed", "Cancelled"]);
    const ROLES = opts(["Admin", "Manager", "Employee"]);

    const departmentLookup = { path: "/Departments", key: "dept_id", text: "name", additional: "cost_center" };
    const managerLookup = { path: "/Managers", key: "manager_id", text: "full_name", additional: "email", filters: [new Filter("active", FilterOperator.EQ, true)] };
    const categoryLookup = { path: "/AssetCategories", key: "asset_category_id", text: "name" };
    const vendorLookup = { path: "/Vendors", key: "vendor_id", text: "name", additional: "email" };
    const currencyLookup = { path: "/Currencies", key: "code", text: "code", additional: "name" };
    const assetLookup = { path: "/Assets", key: "asset_id", text: "asset_tag", additional: "name" };

    const employeeFields = [
        { name: "full_name", label: "Full Name", required: true, maxLength: 100 },
        { name: "email", label: "E-Mail", type: "email", required: true, maxLength: 100 },
        { name: "phone", label: "Phone", type: "phone" },
        { name: "designation", label: "Designation", maxLength: 100 },
        { name: "location", label: "Location", maxLength: 100 },
        { name: "department_dept_id", label: "Department", type: "lookup", lookup: departmentLookup },
        { name: "manager_manager_id", label: "Assigned Manager", type: "lookup", lookup: managerLookup },
        { name: "status", label: "Status", type: "select", required: true, options: EMPLOYEE_STATUS, default: "Active" }
    ];

    const assetFields = [
        { name: "asset_tag", label: "Asset ID / Tag", required: true, maxLength: 50 },
        { name: "name", label: "Asset Name", maxLength: 100 },
        { name: "category_asset_category_id", label: "Category", type: "lookup", required: true, lookup: categoryLookup },
        { name: "serial_number", label: "Serial Number", maxLength: 100 },
        { name: "model", label: "Model", maxLength: 100 },
        { name: "vendor_vendor_id", label: "Vendor", type: "lookup", lookup: vendorLookup },
        { name: "manager_manager_id", label: "Responsible Manager", type: "lookup", lookup: managerLookup },
        { name: "purchase_date", label: "Purchase Date", type: "date" },
        { name: "purchase_cost", label: "Purchase Cost", type: "decimal", min: 0 },
        { name: "currency_code", label: "Currency", type: "lookup", lookup: currencyLookup, default: "INR" },
        { name: "warranty_expiry", label: "Warranty Expiry", type: "date" },
        { name: "condition", label: "Condition", type: "select", options: Actions.CONDITIONS, default: "New" },
        { name: "location", label: "Location", maxLength: 100 },
        { name: "status", label: "Availability Status", type: "select", required: true, options: EDITABLE_ASSET_STATUS, default: "Available" }
    ];
    const assetValidate = (v) => (v.purchase_date && v.warranty_expiry && v.warranty_expiry < v.purchase_date
        ? "Warranty expiry must not be before the purchase date" : null);

    const maintenanceFields = [
        { name: "asset_asset_id", label: "Asset", type: "lookup", required: true, lookup: assetLookup },
        { name: "type", label: "Maintenance Type", required: true, maxLength: 50, placeholder: "e.g. Repair, Preventive Service" },
        { name: "description", label: "Issue Description", type: "textarea", maxLength: 1000 },
        { name: "service_vendor_vendor_id", label: "Service Provider", type: "lookup", lookup: vendorLookup },
        { name: "reported_date", label: "Maintenance Date", type: "date", required: true, default: format.isoDate(0) },
        { name: "cost", label: "Cost", type: "decimal", min: 0 },
        { name: "currency_code", label: "Currency", type: "lookup", lookup: currencyLookup, default: "INR" },
        { name: "next_due_date", label: "Next Service Date", type: "date" },
        { name: "covered_by_warranty", label: "Covered by Warranty", type: "boolean" }
    ];

    /* ------------------------------------------------------------------ */

    const overview = async function (ctx) {
        const [stats, byStatus, byCategory, costByMonth, requestsByStatus, audit, pending] = await Promise.all([
            api.fn(SERVICE, "getStats"),
            api.fn(SERVICE, "getReport", { report: "assetsByStatus" }),
            api.fn(SERVICE, "getReport", { report: "assetsByCategory" }),
            api.fn(SERVICE, "getReport", { report: "maintenanceByMonth" }),
            api.fn(SERVICE, "getReport", { report: "requestsByStatus" }),
            api.get(SERVICE + "/AuditLogs?$orderby=timestamp%20desc&$top=8"),
            api.get(SERVICE + "/AssetRequests?$filter=status%20eq%20'Pending'&$orderby=createdAt%20desc&$top=6")
        ]);
        const go = (section) => () => ctx.navTo(section);
        return [
            Sections.kpis([
                Charts.kpi({ title: "Total Assets", value: stats.totalAssets, icon: "sap-icon://laptop", press: go("assets") }),
                Charts.kpi({ title: "Managers", subtitle: stats.activeManagers + " active", value: stats.totalManagers, icon: "sap-icon://manager", press: go("managers") }),
                Charts.kpi({ title: "Employees", value: stats.totalEmployees, icon: "sap-icon://employee", press: go("employees") }),
                Charts.kpi({ title: "Assigned Assets", value: stats.assignedAssets, icon: "sap-icon://add-employee", color: "Good", press: go("ownership") }),
                Charts.kpi({ title: "Available Assets", value: stats.availableAssets, icon: "sap-icon://inventory", color: "Good", press: go("assets") }),
                Charts.kpi({ title: "Pending Requests", value: stats.pendingRequests, icon: "sap-icon://inbox", color: stats.pendingRequests ? "Critical" : "Neutral", press: go("requests") }),
                Charts.kpi({ title: "Maintenance Records", subtitle: stats.openMaintenance + " open", value: stats.maintenanceRecords, icon: "sap-icon://wrench", press: go("maintenance") }),
                Charts.kpi({ title: "Overdue Returns", value: stats.overdueReturns, icon: "sap-icon://lateness", color: stats.overdueReturns ? "Error" : "Neutral", press: go("ownership") })
            ]),
            Sections.grid([
                Charts.chart({ title: "Assets by Status", type: "donut", rows: byStatus }),
                Charts.chart({ title: "Assets by Category", type: "column", rows: byCategory }),
                Charts.chart({ title: "Maintenance Expenses by Month", type: "line", rows: costByMonth, measure: "amount", measureLabel: "Cost" }),
                Charts.chart({ title: "Requests by Status", type: "bar", rows: requestsByStatus }),
                Sections.listCard("Pending Requests", pending, (r) => ({
                    title: r.requester_name + " - " + format.status(r.type) + (r.asset_tag ? " " + r.asset_tag : r.category_name ? " (" + r.category_name + ")" : ""),
                    description: r.reason,
                    info: format.date(r.createdAt),
                    infoState: "Warning",
                    icon: "sap-icon://inbox",
                    type: "Navigation",
                    press: go("requests")
                }), "No pending requests"),
                Sections.listCard("Recent Activity", audit, (a) => ({
                    title: a.action + " " + a.entity,
                    description: (a.details || a.entity_key || "") + " - " + a.user_id,
                    info: format.dateTime(a.timestamp),
                    icon: "sap-icon://history"
                }), "No activity yet")
            ])
        ];
    };

    const managers = function (ctx) {
        const table = EntityTable.create({
            title: "Managers",
            entitySet: "Managers",
            key: "manager_id",
            orderby: "full_name",
            select: ["active", "employee_employee_id"],
            columns: [
                { path: "full_name", label: "Manager", type: "title", subtitle: "email" },
                { path: "phone", label: "Phone" },
                { path: "department_name", label: "Department" },
                { path: "employee_name", label: "Employee Record" },
                { path: "active", label: "Account", type: "bool", trueText: "Active", falseText: "Inactive" }
            ],
            search: ["full_name", "email"],
            filters: [
                { path: "active", label: "Account", allText: "All accounts", options: [{ key: "true", text: "Active" }, { key: "false", text: "Inactive" }] },
                { path: "department_dept_id", label: "Department", lookup: departmentLookup }
            ],
            view: true,
            create: {
                title: "Create Manager",
                buttonText: "Create Manager",
                fields: [
                    { name: "employee_employee_id", label: "Employee", type: "lookup", required: true, lookup: Actions.employeeLookup() },
                    { name: "department_dept_id", label: "Department (default: employee's)", type: "lookup", lookup: departmentLookup },
                    { name: "phone", label: "Phone", type: "phone" }
                ],
                successText: "Manager created - the employee's login now has the Manager role"
            },
            edit: {
                title: "Edit Manager",
                fields: [
                    { name: "full_name", label: "Full Name", required: true },
                    { name: "email", label: "E-Mail", type: "email", required: true },
                    { name: "phone", label: "Phone", type: "phone" },
                    { name: "department_dept_id", label: "Department", type: "lookup", lookup: departmentLookup }
                ]
            },
            remove: { label: (r) => r.full_name },
            rowActions: [
                {
                    text: "Team & Assets", icon: "sap-icon://group",
                    press: async (row) => {
                        const [team, assets] = await Promise.all([
                            api.get(SERVICE + "/Employees?$filter=manager_manager_id%20eq%20" + row.manager_id + "%20or%20department_dept_id%20eq%20" + (row.department_dept_id || "null") + "&$orderby=full_name"),
                            api.get(SERVICE + "/Assets?$filter=manager_manager_id%20eq%20" + row.manager_id + "&$orderby=asset_tag")
                        ]);
                        Actions.showTablesDialog(ctx, row.full_name + " - Team & Assets", [
                            { heading: "Assigned Employees", rows: team, columns: [
                                { path: "full_name", label: "Employee" }, { path: "designation", label: "Designation" },
                                { path: "department_name", label: "Department" }, { path: "status", label: "Status", type: "status" }] },
                            { heading: "Managed Assets", rows: assets, columns: [
                                { path: "asset_tag", label: "Asset" }, { path: "name", label: "Name" },
                                { path: "holder_name", label: "Holder" }, { path: "status", label: "Status", type: "status" }] }
                        ]);
                    }
                },
                {
                    text: "Deactivate", icon: "sap-icon://decline",
                    visible: { paths: ["active"], test: (a) => !!a },
                    press: (row, c, t) => toggleManager(ctx, t, row, false)
                },
                {
                    text: "Activate", icon: "sap-icon://accept",
                    visible: { paths: ["active"], test: (a) => !a },
                    press: (row, c, t) => toggleManager(ctx, t, row, true)
                }
            ]
        }, ctx);
        ctx.setActiveTable(table);
        return table.control;
    };

    const toggleManager = function (ctx, table, row, active) {
        MessageBox.confirm((active ? "Activate" : "Deactivate") + " the manager account of " + row.full_name + "?", {
            onClose: async (action) => {
                if (action !== MessageBox.Action.OK) return;
                try {
                    await api.post(SERVICE + "/setManagerActive", { manager_id: row.manager_id, active: active });
                    MessageToast.show("Manager " + (active ? "activated" : "deactivated"));
                    table.refresh();
                } catch (error) {
                    MessageBox.error(error.message);
                }
            }
        });
    };

    const employees = function (ctx) {
        const table = EntityTable.create({
            title: "Employees",
            entitySet: "Employees",
            key: "employee_id",
            orderby: "full_name",
            columns: [
                { path: "full_name", label: "Employee", type: "title", subtitle: "email" },
                { path: "designation", label: "Designation" },
                { path: "department_name", label: "Department" },
                { path: "manager_name", label: "Manager" },
                { path: "location", label: "Location" },
                { path: "login_id", label: "Login" },
                { path: "status", label: "Status", type: "status" }
            ],
            search: ["full_name", "email", "designation", "location"],
            filters: [
                { path: "status", label: "Status", options: EMPLOYEE_STATUS },
                { path: "department_dept_id", label: "Department", lookup: departmentLookup }
            ],
            view: true,
            create: {
                title: "Create Employee Account",
                buttonText: "Create Employee",
                fields: employeeFields.concat([
                    { name: "login_id", label: "Login (user ID / e-mail)", placeholder: "creates the user account", maxLength: 255 }
                ]),
                prepare: (v) => {
                    const payload = Object.assign({}, v);
                    delete payload.login_id;
                    return payload;
                },
                after: async (values, created) => {
                    if (!values.login_id) return;
                    await api.post(SERVICE + "/Users", {
                        user_id: values.login_id,
                        full_name: values.full_name,
                        email: values.email,
                        role_code: "Employee",
                        employee_employee_id: created.employee_id
                    });
                },
                successText: "Employee created"
            },
            edit: { title: "Edit Employee", fields: employeeFields },
            remove: { label: (r) => r.full_name },
            rowActions: [{
                text: "Assigned Assets", icon: "sap-icon://laptop",
                press: async (row) => {
                    const assets = await api.get(SERVICE + "/Assets?$filter=current_holder_employee_id%20eq%20" + row.employee_id);
                    Actions.showTableDialog(ctx, "Assets of " + row.full_name, [
                        { path: "asset_tag", label: "Asset" }, { path: "name", label: "Name" }, { path: "serial_number", label: "Serial No." },
                        { path: "category_name", label: "Category" }, { path: "condition", label: "Condition", type: "status" }
                    ], assets);
                }
            }]
        }, ctx);
        ctx.setActiveTable(table);
        return table.control;
    };

    const assetTable = function (ctx) {
        return EntityTable.create({
            title: "Assets",
            entitySet: "Assets",
            key: "asset_id",
            orderby: "asset_tag",
            select: ["current_holder_employee_id", "currency_code", "holder_name", "condition"],
            columns: [
                { path: "asset_tag", label: "Asset", type: "title", subtitle: "name" },
                { path: "category_name", label: "Category" },
                { path: "serial_number", label: "Serial Number" },
                { path: "purchase_date", label: "Purchased", type: "date" },
                { path: "purchase_cost", label: "Cost", type: "amount", unit: "currency_code" },
                { path: "condition", label: "Condition", type: "status" },
                { path: "location", label: "Location" },
                { path: "holder_name", label: "Current Holder" },
                { path: "status", label: "Availability", type: "status" }
            ],
            details: [
                { path: "asset_tag", label: "Asset ID / Tag" }, { path: "name", label: "Name" }, { path: "category_name", label: "Category" },
                { path: "serial_number", label: "Serial Number" }, { path: "model", label: "Model" }, { path: "vendor_name", label: "Vendor" },
                { path: "manager_name", label: "Responsible Manager" }, { path: "purchase_date", label: "Purchase Date", type: "date" },
                { path: "purchase_cost", label: "Purchase Cost", type: "amount", unit: "currency_code" }, { path: "warranty_expiry", label: "Warranty Expiry", type: "date" },
                { path: "condition", label: "Condition", type: "status" }, { path: "location", label: "Location" },
                { path: "status", label: "Availability", type: "status" }, { path: "holder_name", label: "Current Holder" }
            ],
            search: ["asset_tag", "name", "serial_number", "model", "location"],
            filters: [
                { path: "status", label: "Status", options: ASSET_STATUS },
                { path: "category_asset_category_id", label: "Category", lookup: categoryLookup },
                { path: "condition", label: "Condition", options: Actions.CONDITIONS }
            ],
            view: true,
            create: { title: "Add Asset", buttonText: "Add Asset", fields: assetFields, validate: assetValidate, successText: "Asset added" },
            edit: { title: "Edit Asset", fields: assetFields.map((f) => (f.name === "status" ? Object.assign({}, f, { options: ASSET_STATUS }) : f)), validate: assetValidate },
            remove: { label: (r) => r.asset_tag },
            rowActions: [
                { text: "Assign", icon: "sap-icon://add-employee", visible: { paths: ["status"], test: (s) => s === "Available" },
                    press: (row, c, t) => Actions.assign(ctx, t.refresh, { asset_id: row.asset_id }) },
                { text: "Transfer", icon: "sap-icon://journey-change", visible: { paths: ["current_holder_employee_id"], test: (h) => !!h },
                    press: (row, c, t) => Actions.transfer(ctx, t.refresh, row) },
                { text: "Return", icon: "sap-icon://undo", visible: { paths: ["current_holder_employee_id"], test: (h) => !!h },
                    press: (row, c, t) => Actions.returnAsset(ctx, t.refresh, row) },
                { text: "Ownership History", icon: "sap-icon://history", press: (row) => Actions.history(ctx, row.asset_id, row.asset_tag) }
            ]
        }, ctx);
    };

    const assets = function (ctx) {
        const table = assetTable(ctx);
        ctx.setActiveTable(table);
        return table.control;
    };

    const ownershipTable = function (ctx) {
        return EntityTable.create({
            title: "Asset Ownership",
            entitySet: "AssetOwnerships",
            key: "ownership_id",
            orderby: "start_date desc",
            select: ["asset_asset_id", "owner_employee_id", "notes", "condition", "serial_number"],
            columns: [
                { path: "asset_tag", label: "Asset", type: "title", subtitle: "asset_name" },
                { path: "owner_name", label: "Owner" },
                { path: "department_name", label: "Department" },
                { path: "start_date", label: "Start", type: "date" },
                { path: "expected_return_date", label: "Expected Return", type: "date" },
                { path: "end_date", label: "End", type: "date" },
                { path: "is_current", label: "Ownership", type: "bool", trueText: "Current", falseText: "Ended", falseState: "None" }
            ],
            details: [
                { path: "asset_tag", label: "Asset" }, { path: "asset_name", label: "Asset Name" }, { path: "serial_number", label: "Serial Number" },
                { path: "owner_name", label: "Owner" }, { path: "department_name", label: "Department" },
                { path: "start_date", label: "Start Date", type: "date" }, { path: "expected_return_date", label: "Expected Return", type: "date" },
                { path: "end_date", label: "End Date", type: "date" }, { path: "is_current", label: "Current", type: "bool" }, { path: "notes", label: "Notes" }
            ],
            search: ["asset_tag", "asset_name", "owner_name"],
            filters: [{ path: "is_current", label: "Ownership", allText: "All records", options: [{ key: "true", text: "Current" }, { key: "false", text: "Ended" }], default: true }],
            view: true,
            toolbarActions: [{ text: "Assign Asset", icon: "sap-icon://add-employee", type: "Emphasized", press: (c, t) => Actions.assign(ctx, t.refresh) }],
            rowActions: [
                { text: "Edit Ownership", icon: "sap-icon://edit", visible: { paths: ["is_current"], test: (c) => !!c },
                    press: (row, c, t) => Actions.editOwnership(ctx, t.refresh, row) },
                { text: "Transfer Ownership", icon: "sap-icon://journey-change", visible: { paths: ["is_current"], test: (c) => !!c },
                    press: (row, c, t) => Actions.transfer(ctx, t.refresh, { asset_id: row.asset_asset_id, asset_tag: row.asset_tag, owner_name: row.owner_name }) },
                { text: "Return", icon: "sap-icon://undo", visible: { paths: ["is_current"], test: (c) => !!c },
                    press: (row, c, t) => Actions.returnAsset(ctx, t.refresh, { asset_id: row.asset_asset_id, asset_tag: row.asset_tag, owner_name: row.owner_name, condition: row.condition }) },
                { text: "Ownership History", icon: "sap-icon://history", press: (row) => Actions.history(ctx, row.asset_asset_id, row.asset_tag) }
            ]
        }, ctx);
    };

    const historyTable = function (ctx) {
        return EntityTable.create({
            title: "Ownership History",
            entitySet: "AssignmentHistory",
            key: "ledger_id",
            orderby: "createdAt desc",
            columns: [
                { path: "transition_date", label: "Date", type: "date" },
                { path: "asset_tag", label: "Asset", type: "title", subtitle: "asset_name" },
                { path: "action", label: "Action", type: "status" },
                { path: "from_name", label: "From" },
                { path: "to_name", label: "To" },
                { path: "createdBy", label: "Recorded By" },
                { path: "notes", label: "Notes" }
            ],
            search: ["asset_tag", "asset_name", "from_name", "to_name", "notes"],
            filters: [{ path: "action", label: "Action", options: opts(["Assign", "Transfer", "Return", "Update"]) }]
        }, ctx);
    };

    /** Two tabs: ownership records and the change history */
    const ownership = function (ctx) {
        const records = ownershipTable(ctx);
        const history = historyTable(ctx);
        ctx.setActiveTable(records);
        return new IconTabBar({
            headerMode: "Inline",
            expandable: false,
            applyContentPadding: false,
            stretchContentHeight: false,
            items: [
                new IconTabFilter({ key: "records", text: "Ownership Records", icon: "sap-icon://customer-and-contacts", content: [records.control] }),
                new IconTabFilter({ key: "history", text: "Ownership History", icon: "sap-icon://history", content: [history.control] })
            ],
            select: (e) => {
                const key = e.getParameter("key");
                ctx.setActiveTable(key === "history" ? history : records);
                (key === "history" ? history : records).refresh();
            }
        });
    };

    const maintenanceTable = function (ctx, allowDelete) {
        return EntityTable.create({
            title: "Maintenance Records",
            entitySet: "MaintenanceRecords",
            key: "maintenance_id",
            orderby: "reported_date desc",
            select: ["currency_code", "outcome", "description"],
            columns: [
                { path: "asset_tag", label: "Asset", type: "title", subtitle: "asset_name" },
                { path: "type", label: "Type" },
                { path: "reported_date", label: "Maintenance Date", type: "date" },
                { path: "vendor_name", label: "Service Provider" },
                { path: "cost", label: "Cost", type: "amount", unit: "currency_code" },
                { path: "next_due_date", label: "Next Service", type: "date" },
                { path: "covered_by_warranty", label: "Warranty", type: "bool", falseState: "None" },
                { path: "status", label: "Status", type: "status" }
            ],
            details: [
                { path: "asset_tag", label: "Asset" }, { path: "asset_name", label: "Asset Name" }, { path: "type", label: "Type" },
                { path: "description", label: "Issue Description" }, { path: "vendor_name", label: "Service Provider" },
                { path: "reported_by_name", label: "Reported By" }, { path: "reported_date", label: "Maintenance Date", type: "date" },
                { path: "completed_date", label: "Completed", type: "date" }, { path: "next_due_date", label: "Next Service", type: "date" },
                { path: "cost", label: "Cost", type: "amount", unit: "currency_code" }, { path: "covered_by_warranty", label: "Covered by Warranty", type: "bool" },
                { path: "status", label: "Status", type: "status" }, { path: "outcome", label: "Outcome" }
            ],
            search: ["asset_tag", "asset_name", "type", "description"],
            filters: [{ path: "status", label: "Status", options: MAINTENANCE_STATUS }],
            view: true,
            create: {
                title: "Add Maintenance Record", buttonText: "Add Maintenance Record",
                fields: maintenanceFields.concat([{ name: "status", label: "Status", type: "select", required: true, options: MAINTENANCE_STATUS, default: "Open" }]),
                successText: "Maintenance record added"
            },
            edit: { title: "Edit Maintenance Record", fields: maintenanceFields.filter((f) => f.name !== "asset_asset_id") },
            remove: allowDelete ? { label: (r) => r.asset_tag + " - " + r.type } : undefined,
            rowActions: [{ text: "Update Status", icon: "sap-icon://status-in-process", showText: false,
                press: (row, c, t) => Actions.maintenanceStatus(ctx, t.refresh, row) }]
        }, ctx);
    };

    const maintenance = function (ctx) {
        const table = maintenanceTable(ctx, true);
        ctx.setActiveTable(table);
        return table.control;
    };

    const requestTable = function (ctx) {
        return EntityTable.create({
            title: "Asset Requests",
            entitySet: "AssetRequests",
            key: "request_id",
            orderby: "createdAt desc",
            select: ["category_asset_category_id", "asset_asset_id", "decision_note", "decided_by"],
            columns: [
                { path: "requester_name", label: "Requested By", type: "title", subtitle: "department_name" },
                { path: "type", label: "Type", type: "status" },
                { path: "category_name", label: "Category" },
                { path: "asset_tag", label: "Asset" },
                { path: "issue_type", label: "Issue" },
                { path: "reason", label: "Reason / Description", maxLines: 2 },
                { path: "createdAt", label: "Requested", type: "datetime" },
                { path: "status", label: "Status", type: "status" }
            ],
            details: [
                { path: "requester_name", label: "Requested By" }, { path: "type", label: "Type", type: "status" },
                { path: "category_name", label: "Category" }, { path: "asset_tag", label: "Asset" }, { path: "issue_type", label: "Issue Type" },
                { path: "reason", label: "Reason" }, { path: "needed_by", label: "Needed By", type: "date" },
                { path: "createdAt", label: "Requested", type: "datetime" }, { path: "status", label: "Status", type: "status" },
                { path: "decided_by", label: "Decided By" }, { path: "decision_note", label: "Decision Note" }
            ],
            search: ["requester_name", "reason", "asset_tag", "category_name"],
            filters: [
                { path: "status", label: "Status", options: REQUEST_STATUS, default: "Pending" },
                { path: "type", label: "Type", options: opts(["New", "Return", "Issue"]) }
            ],
            view: true,
            rowActions: [
                { text: "Approve", icon: "sap-icon://accept", type: "Accept", primary: true, visible: { paths: ["status"], test: (s) => s === "Pending" },
                    press: (row, c, t) => Actions.approve(ctx, t.refresh, row) },
                { text: "Reject", icon: "sap-icon://decline", type: "Reject", primary: true, visible: { paths: ["status"], test: (s) => s === "Pending" },
                    press: (row, c, t) => Actions.reject(ctx, t.refresh, row) },
                { text: "Resolve", icon: "sap-icon://complete", visible: { paths: ["type", "status"], test: (type, s) => type === "Issue" && (s === "Pending" || s === "InProgress") },
                    press: (row, c, t) => Actions.resolve(ctx, t.refresh, row) }
            ]
        }, ctx);
    };

    const requests = function (ctx) {
        const table = requestTable(ctx);
        ctx.setActiveTable(table);
        return table.control;
    };

    const REPORTS = [
        { key: "assetsByStatus", text: "Asset Inventory by Status", chart: "donut", labelTitle: "Status", amountLabel: "Purchase Value" },
        { key: "assetsByCategory", text: "Asset Inventory by Category", chart: "column", labelTitle: "Category", amountLabel: "Purchase Value" },
        { key: "ownershipByEmployee", text: "Ownership Records by Employee", chart: "bar", labelTitle: "Employee", showAmount: false },
        { key: "allocationByEmployee", text: "Employee-wise Allocation", chart: "bar", labelTitle: "Employee", amountLabel: "Asset Value" },
        { key: "allocationByManager", text: "Manager-wise Allocation", chart: "bar", labelTitle: "Manager", amountLabel: "Asset Value" },
        { key: "allocationByDepartment", text: "Department-wise Allocation", chart: "donut", labelTitle: "Department", amountLabel: "Asset Value" },
        { key: "maintenanceCostByAsset", text: "Maintenance Expenses by Asset", chart: "column", measure: "amount", measureLabel: "Cost", labelTitle: "Asset", amountLabel: "Cost" },
        { key: "maintenanceByMonth", text: "Maintenance Expenses by Month", chart: "line", measure: "amount", measureLabel: "Cost", labelTitle: "Month", amountLabel: "Cost" },
        { key: "maintenanceByStatus", text: "Maintenance by Status", chart: "donut", labelTitle: "Status", amountLabel: "Cost" },
        { key: "requestsByStatus", text: "Requests by Status", chart: "bar", labelTitle: "Status", showAmount: false },
        { key: "requestsByType", text: "Requests by Type", chart: "donut", labelTitle: "Type", showAmount: false },
        { key: "assetHistoryByAction", text: "Asset History by Action", chart: "column", labelTitle: "Action", showAmount: false }
    ];

    const audit = function (ctx) {
        const table = EntityTable.create({
            title: "Audit Log",
            entitySet: "AuditLogs",
            key: "log_id",
            orderby: "timestamp desc",
            pageSize: 20,
            columns: [
                { path: "timestamp", label: "Time", type: "datetime" },
                { path: "user_id", label: "User" },
                { path: "action", label: "Action" },
                { path: "entity", label: "Object" },
                { path: "entity_key", label: "Key", minScreenWidth: "Desktop" },
                { path: "details", label: "Details" }
            ],
            search: ["user_id", "action", "entity", "details"],
            filters: [{ path: "entity", label: "Object", options: ["Assets", "AssetOwnerships", "AssetRequests", "MaintenanceRecords", "Employees", "Managers", "Users", "Departments"].map((k) => ({ key: k, text: k })) }]
        }, ctx);
        ctx.setActiveTable(table);
        return table.control;
    };

    /* ---------- settings ---------- */

    const settingsTables = function (ctx) {
        return {
            departments: EntityTable.create({
                title: "Departments", entitySet: "Departments", key: "dept_id", orderby: "name",
                columns: [{ path: "name", label: "Department", type: "title" }, { path: "cost_center", label: "Cost Center" }],
                search: ["name", "cost_center"],
                create: { title: "Create Department", fields: [{ name: "name", label: "Name", required: true, maxLength: 100 }, { name: "cost_center", label: "Cost Center", maxLength: 50 }] },
                edit: { title: "Edit Department", fields: [{ name: "name", label: "Name", required: true, maxLength: 100 }, { name: "cost_center", label: "Cost Center", maxLength: 50 }] },
                remove: { label: (r) => r.name }
            }, ctx),
            categories: EntityTable.create({
                title: "Asset Categories", entitySet: "AssetCategories", key: "asset_category_id", orderby: "name",
                columns: [{ path: "name", label: "Category", type: "title" }, { path: "lifespan_months", label: "Lifespan (months)" }],
                search: ["name"],
                create: { title: "Create Asset Category", fields: [{ name: "name", label: "Name", required: true }, { name: "lifespan_months", label: "Lifespan (months)", type: "number", min: 1 }] },
                edit: { title: "Edit Asset Category", fields: [{ name: "name", label: "Name", required: true }, { name: "lifespan_months", label: "Lifespan (months)", type: "number", min: 1 }] },
                remove: { label: (r) => r.name }
            }, ctx),
            vendors: EntityTable.create({
                title: "Vendors / Service Providers", entitySet: "Vendors", key: "vendor_id", orderby: "name",
                columns: [{ path: "name", label: "Vendor", type: "title", subtitle: "email" }, { path: "manager_name", label: "Contact Manager" }],
                search: ["name", "email"],
                create: { title: "Create Vendor", fields: [{ name: "name", label: "Name", required: true }, { name: "email", label: "E-Mail", type: "email" }, { name: "manager_manager_id", label: "Contact Manager", type: "lookup", lookup: managerLookup }] },
                edit: { title: "Edit Vendor", fields: [{ name: "name", label: "Name", required: true }, { name: "email", label: "E-Mail", type: "email" }, { name: "manager_manager_id", label: "Contact Manager", type: "lookup", lookup: managerLookup }] },
                remove: { label: (r) => r.name }
            }, ctx),
            users: EntityTable.create({
                title: "Users", entitySet: "Users", key: "user_id", keyType: "string", orderby: "user_id",
                select: ["active"],
                columns: [
                    { path: "user_id", label: "Login", type: "title", subtitle: "full_name" },
                    { path: "email", label: "E-Mail" },
                    { path: "role_name", label: "Role" },
                    { path: "employee_name", label: "Employee Record" },
                    { path: "active", label: "Account", type: "bool", trueText: "Active", falseText: "Inactive" }
                ],
                search: ["user_id", "full_name", "email"],
                filters: [
                    { path: "role_code", label: "Role", options: ROLES },
                    { path: "active", label: "Account", allText: "All accounts", options: [{ key: "true", text: "Active" }, { key: "false", text: "Inactive" }] }
                ],
                create: {
                    title: "Create User", buttonText: "Create User",
                    fields: [
                        { name: "user_id", label: "Login (user ID / e-mail)", required: true, maxLength: 255 },
                        { name: "full_name", label: "Full Name", required: true },
                        { name: "email", label: "E-Mail", type: "email" },
                        { name: "role_code", label: "Role", type: "select", required: true, options: ROLES, default: "Employee" },
                        { name: "employee_employee_id", label: "Employee Record", type: "lookup", lookup: Actions.employeeLookup() }
                    ]
                },
                edit: {
                    title: "Edit User",
                    fields: [
                        { name: "full_name", label: "Full Name", required: true },
                        { name: "email", label: "E-Mail", type: "email" },
                        { name: "role_code", label: "Role", type: "select", required: true, options: ROLES },
                        { name: "employee_employee_id", label: "Employee Record", type: "lookup", lookup: Actions.employeeLookup() }
                    ]
                },
                remove: { label: (r) => r.user_id },
                rowActions: [
                    { text: "Deactivate", icon: "sap-icon://decline", visible: { paths: ["active"], test: (a) => !!a },
                        press: (row, c, t) => toggleUser(t, row, false) },
                    { text: "Activate", icon: "sap-icon://accept", visible: { paths: ["active"], test: (a) => !a },
                        press: (row, c, t) => toggleUser(t, row, true) }
                ]
            }, ctx),
            roles: EntityTable.create({
                title: "Roles & Permissions", entitySet: "Roles", key: "code", keyType: "string", orderby: "code",
                columns: [{ path: "code", label: "Role", type: "title", subtitle: "name" }, { path: "description", label: "Permissions", wrap: true, maxLines: 4 }],
                edit: { title: "Edit Role", fields: [{ name: "name", label: "Name", required: true }, { name: "description", label: "Permissions / Description", type: "textarea", maxLength: 500 }] }
            }, ctx)
        };
    };

    const toggleUser = function (table, row, active) {
        MessageBox.confirm((active ? "Activate" : "Deactivate") + " user " + row.user_id + "?", {
            onClose: async (action) => {
                if (action !== MessageBox.Action.OK) return;
                try {
                    await api.post(SERVICE + "/setUserActive", { user_id: row.user_id, active: active });
                    MessageToast.show("User " + (active ? "activated" : "deactivated"));
                    table.refresh();
                } catch (error) {
                    MessageBox.error(error.message);
                }
            }
        });
    };

    const settings = function (ctx) {
        const tables = settingsTables(ctx);
        ctx.setActiveTable(tables.departments);
        const hint = new Text({
            text: "Access rights are granted in the SAP BTP cockpit by assigning the role collections AssetManagement_Admin, " +
                "AssetManagement_Manager or AssetManagement_Employee. Here you link each login to its employee record and role."
        }).addStyleClass("sapUiSmallMarginBottom");
        const tab = (key, text, icon, content) => new IconTabFilter({ key: key, text: text, icon: icon, content: content });
        return new VBox({
            items: [new IconTabBar({
                headerMode: "Inline",
                expandable: false,
                applyContentPadding: false,
                items: [
                    tab("departments", "Departments", "sap-icon://org-chart", [tables.departments.control]),
                    tab("categories", "Asset Categories", "sap-icon://product", [tables.categories.control]),
                    tab("vendors", "Vendors", "sap-icon://supplier", [tables.vendors.control]),
                    tab("users", "Users", "sap-icon://account", [hint, tables.users.control]),
                    tab("roles", "Roles & Permissions", "sap-icon://key-user-settings", [tables.roles.control])
                ],
                select: (e) => ctx.setActiveTable(tables[e.getParameter("key")])
            })]
        });
    };

    return {
        title: "Admin Dashboard",
        service: SERVICE,
        sections: [
            { key: "overview", text: "Dashboard Overview", icon: "sap-icon://home", title: "Dashboard Overview", subtitle: "Key figures of the whole application", build: overview },
            { key: "managers", text: "Manager Management", icon: "sap-icon://manager", subtitle: "Create, edit, activate and deactivate manager accounts", build: managers },
            { key: "employees", text: "Employee Management", icon: "sap-icon://employee", subtitle: "Employee records, departments and manager assignment", build: employees },
            { key: "assets", text: "Asset Management", icon: "sap-icon://laptop", subtitle: "Add, update, search and filter assets", build: assets },
            { key: "ownership", text: "Asset Ownership", icon: "sap-icon://customer-and-contacts", subtitle: "Assign, transfer and return assets; ownership history", build: ownership },
            { key: "maintenance", text: "Maintenance", icon: "sap-icon://wrench", subtitle: "Maintenance records, costs and service dates", build: maintenance },
            { key: "requests", text: "Asset Requests", icon: "sap-icon://inbox", subtitle: "Approve or reject requests, returns and issue reports", build: requests },
            { key: "reports", text: "Reports & Analytics", icon: "sap-icon://business-objects-experience", subtitle: "Inventory, allocation, maintenance and request reports", build: (ctx) => Sections.reports(ctx, REPORTS) },
            { key: "audit", text: "Audit Log", icon: "sap-icon://activity-items", subtitle: "Who changed what and when", build: audit },
            { key: "notifications", text: "Notifications", icon: "sap-icon://bell", build: Sections.notifications },
            { key: "settings", text: "Settings & Permissions", icon: "sap-icon://action-settings", subtitle: "Departments, categories, vendors, users and roles", build: settings }
        ],
        // building blocks shared with the manager dashboard
        shared: {
            ownership: ownership,
            historyTable: historyTable,
            maintenanceTable: maintenanceTable,
            requestTable: requestTable,
            REPORTS: REPORTS
        }
    };
});
