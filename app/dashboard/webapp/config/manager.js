sap.ui.define([
    "sap/m/IconTabBar",
    "sap/m/IconTabFilter",
    "sap/m/VBox",
    "sap/m/Button",
    "sap/m/Label",
    "sap/m/Text",
    "sap/m/ObjectStatus",
    "sap/m/MessageToast",
    "sap/ui/layout/form/SimpleForm",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "../util/EntityTable",
    "../util/Charts",
    "../util/Sections",
    "../util/Actions",
    "../util/FormDialog",
    "../util/api",
    "../util/format",
    "./admin"
], function (IconTabBar, IconTabFilter, VBox, Button, Label, Text, ObjectStatus, MessageToast, SimpleForm, Filter, FilterOperator,
    EntityTable, Charts, Sections, Actions, FormDialog, api, format, admin) {
    "use strict";

    const SERVICE = "/odata/v4/manager";
    const shared = admin.shared;
    const opts = (keys) => keys.map((k) => ({ key: k, text: format.status(k) }));
    const EMPLOYEE_STATUS = opts(["Active", "Inactive", "OnLeave"]);
    const ASSET_STATUS = opts(["Available", "Assigned", "InRepair", "Lost", "Retired", "Archived"]);
    const employeeLookup = { path: "/Employees", key: "employee_id", text: "full_name", additional: "email" };

    const overview = async function (ctx) {
        const today = format.isoDate(0);
        const [stats, allocation, byStatus, pending, upcoming] = await Promise.all([
            api.fn(SERVICE, "getStats"),
            api.fn(SERVICE, "getReport", { report: "allocationByEmployee" }),
            api.fn(SERVICE, "getReport", { report: "assetsByStatus" }),
            api.get(SERVICE + "/AssetRequests?$filter=status%20eq%20'Pending'&$orderby=createdAt%20desc&$top=6"),
            api.get(SERVICE + "/MaintenanceRecords?$filter=next_due_date%20ge%20" + today + "%20or%20status%20eq%20'Open'%20or%20status%20eq%20'InProgress'&$orderby=next_due_date&$top=6")
        ]);
        const go = (section) => () => ctx.navTo(section);
        return [
            Sections.kpis([
                Charts.kpi({ title: "Team Employees", value: stats.totalEmployees, icon: "sap-icon://group", press: go("employees") }),
                Charts.kpi({ title: "Team Assets", value: stats.totalAssets, icon: "sap-icon://laptop", press: go("employeeAssets") }),
                Charts.kpi({ title: "Assigned Assets", value: stats.assignedAssets, icon: "sap-icon://add-employee", color: "Good", press: go("ownership") }),
                Charts.kpi({ title: "Available Assets", value: stats.availableAssets, icon: "sap-icon://inventory", color: "Good", press: go("allocation") }),
                Charts.kpi({ title: "Pending Requests", value: stats.pendingRequests, icon: "sap-icon://inbox", color: stats.pendingRequests ? "Critical" : "Neutral", press: go("requests") }),
                Charts.kpi({ title: "Maintenance Activities", subtitle: stats.upcomingMaintenance + " due in 30 days", value: stats.openMaintenance, icon: "sap-icon://wrench", press: go("maintenance") }),
                Charts.kpi({ title: "Overdue Returns", value: stats.overdueReturns, icon: "sap-icon://lateness", color: stats.overdueReturns ? "Error" : "Neutral", press: go("ownership") })
            ]),
            Sections.grid([
                Charts.chart({ title: "Asset Allocation by Employee", type: "bar", rows: allocation }),
                Charts.chart({ title: "Team Assets by Status", type: "donut", rows: byStatus }),
                Sections.listCard("Pending Requests", pending, (r) => ({
                    title: r.requester_name + " - " + format.status(r.type) + (r.asset_tag ? " " + r.asset_tag : r.category_name ? " (" + r.category_name + ")" : ""),
                    description: r.reason,
                    info: format.date(r.createdAt),
                    infoState: "Warning",
                    icon: "sap-icon://inbox",
                    type: "Navigation",
                    press: go("requests")
                }), "No pending requests"),
                Sections.listCard("Maintenance Activities", upcoming, (m) => ({
                    title: m.asset_tag + " - " + m.type,
                    description: m.next_due_date ? "Next service: " + format.date(m.next_due_date) : (m.description || ""),
                    info: format.status(m.status),
                    infoState: format.state(m.status),
                    icon: "sap-icon://wrench",
                    type: "Navigation",
                    press: go("maintenance")
                }), "No upcoming maintenance")
            ])
        ];
    };

    const employees = function (ctx) {
        const table = EntityTable.create({
            title: "Employee Records",
            entitySet: "Employees",
            key: "employee_id",
            orderby: "full_name",
            columns: [
                { path: "full_name", label: "Employee", type: "title", subtitle: "email" },
                { path: "employee_id", label: "Employee ID", minScreenWidth: "Desktop" },
                { path: "department_name", label: "Department" },
                { path: "designation", label: "Designation" },
                { path: "manager_name", label: "Assigned Manager" },
                { path: "status", label: "Account Status", type: "status" }
            ],
            details: [
                { path: "employee_id", label: "Employee ID" }, { path: "full_name", label: "Name" }, { path: "email", label: "E-Mail" },
                { path: "phone", label: "Phone" }, { path: "location", label: "Location" }, { path: "department_name", label: "Department" },
                { path: "designation", label: "Designation" }, { path: "manager_name", label: "Assigned Manager" }, { path: "status", label: "Status", type: "status" }
            ],
            search: ["full_name", "email", "designation", "location"],
            filters: [{ path: "status", label: "Status", options: EMPLOYEE_STATUS }],
            view: true,
            edit: {
                title: "Update Employee",
                fields: [
                    { name: "phone", label: "Phone", type: "phone" },
                    { name: "location", label: "Location", maxLength: 100 },
                    { name: "designation", label: "Designation", maxLength: 100 },
                    { name: "status", label: "Status", type: "select", required: true, options: EMPLOYEE_STATUS }
                ]
            },
            rowActions: [{
                text: "Assigned Assets", icon: "sap-icon://laptop",
                press: async (row) => {
                    const assets = await api.get(SERVICE + "/Assets?$filter=current_holder_employee_id%20eq%20" + row.employee_id);
                    Actions.showTableDialog(ctx, "Assets of " + row.full_name, [
                        { path: "asset_tag", label: "Asset" }, { path: "name", label: "Name" }, { path: "serial_number", label: "Serial No." },
                        { path: "assigned_on", label: "Assigned On", type: "date" }, { path: "condition", label: "Condition", type: "status" }
                    ], assets);
                }
            }]
        }, ctx);
        ctx.setActiveTable(table);
        return table.control;
    };

    const employeeAssets = function (ctx) {
        const table = EntityTable.create({
            title: "Employee Asset Details",
            entitySet: "Assets",
            key: "asset_id",
            orderby: "asset_tag",
            fixedFilters: [new Filter("current_holder_employee_id", FilterOperator.NE, null)],
            select: ["current_holder_employee_id"],
            columns: [
                { path: "holder_name", label: "Employee", type: "title" },
                { path: "asset_tag", label: "Asset ID", type: "title", subtitle: "name" },
                { path: "serial_number", label: "Serial Number" },
                { path: "category_name", label: "Category" },
                { path: "assigned_on", label: "Assignment Date", type: "date" },
                { path: "condition", label: "Condition", type: "status" },
                { path: "status", label: "Status", type: "status" }
            ],
            search: ["asset_tag", "name", "serial_number", "holder_name"],
            filters: [{ path: "current_holder_employee_id", label: "Employee", lookup: employeeLookup }],
            view: true,
            rowActions: [
                { text: "Transfer Ownership", icon: "sap-icon://journey-change", press: (row, c, t) => Actions.transfer(ctx, t.refresh, row) },
                { text: "Ownership History", icon: "sap-icon://history", press: (row) => Actions.history(ctx, row.asset_id, row.asset_tag) }
            ]
        }, ctx);
        ctx.setActiveTable(table);
        return table.control;
    };

    /** Available assets to allocate + recent transfers */
    const allocation = function (ctx) {
        const available = EntityTable.create({
            title: "Available Assets",
            entitySet: "Assets",
            key: "asset_id",
            orderby: "asset_tag",
            fixedFilters: [new Filter("status", FilterOperator.EQ, "Available")],
            columns: [
                { path: "asset_tag", label: "Asset", type: "title", subtitle: "name" },
                { path: "category_name", label: "Category" },
                { path: "serial_number", label: "Serial Number" },
                { path: "condition", label: "Condition", type: "status" },
                { path: "location", label: "Location" }
            ],
            search: ["asset_tag", "name", "serial_number"],
            rowActions: [{ text: "Assign", icon: "sap-icon://add-employee", type: "Emphasized", showText: true,
                press: (row, c, t) => Actions.assign(ctx, () => { t.refresh(); transfers.refresh(); }, { asset_id: row.asset_id }) }]
        }, ctx);
        const transfers = shared.historyTable(ctx);
        ctx.setActiveTable(available);
        return new IconTabBar({
            headerMode: "Inline",
            expandable: false,
            applyContentPadding: false,
            items: [
                new IconTabFilter({ key: "available", text: "Allocate Assets", icon: "sap-icon://inventory", content: [available.control] }),
                new IconTabFilter({ key: "transfers", text: "Assignments & Transfers", icon: "sap-icon://journey-change", content: [transfers.control] })
            ],
            select: (e) => ctx.setActiveTable(e.getParameter("key") === "transfers" ? transfers : available)
        });
    };

    const maintenance = function (ctx) {
        const table = shared.maintenanceTable(ctx, false);
        ctx.setActiveTable(table);
        return table.control;
    };

    const requests = function (ctx) {
        const table = shared.requestTable(ctx);
        ctx.setActiveTable(table);
        return table.control;
    };

    const REPORT_KEYS = ["allocationByEmployee", "ownershipByEmployee", "allocationByDepartment", "assetsByStatus", "assetsByCategory",
        "maintenanceCostByAsset", "maintenanceByStatus", "requestsByStatus", "assetHistoryByAction"];
    const REPORTS = shared.REPORTS.filter((r) => REPORT_KEYS.includes(r.key))
        .map((r) => (r.key === "allocationByDepartment" ? Object.assign({}, r, { text: "Department-level Asset Utilization" }) : r));

    const profile = async function (ctx) {
        const rows = await api.get(SERVICE + "/MyProfile");
        const me = rows[0];
        const form = new SimpleForm({ editable: false, layout: "ResponsiveGridLayout", labelSpanL: 4, labelSpanM: 4 });
        const add = (label, value) => { form.addContent(new Label({ text: label })); form.addContent(new Text({ text: value || "-" })); };
        add("Name", me.full_name);
        add("E-Mail", me.email);
        add("Phone", me.phone);
        add("Department", me.department_name);
        add("Designation", me.designation);
        add("Location", me.location);
        form.addContent(new Label({ text: "Manager Account" }));
        form.addContent(new ObjectStatus({ text: me.active ? "Active" : "Inactive", state: me.active ? "Success" : "Error", inverted: true }));
        const edit = new Button({
            text: "Edit Profile", icon: "sap-icon://edit", type: "Emphasized",
            press: () => FormDialog.open({
                title: "Edit Profile",
                owner: ctx.owner,
                data: me,
                fields: [
                    { name: "full_name", label: "Full Name", required: true },
                    { name: "email", label: "E-Mail", type: "email", required: true },
                    { name: "phone", label: "Phone", type: "phone" }
                ],
                onSubmit: async (values) => {
                    await api.patch(SERVICE + "/MyProfile(" + me.manager_id + ")", values);
                    MessageToast.show("Profile updated");
                    ctx.refreshUser();
                    ctx.rerender();
                }
            })
        });
        return Sections.card("My Profile", [form, new VBox({ alignItems: "End", items: [edit] })]).addStyleClass("amFormContainer");
    };

    return {
        title: "Manager Dashboard",
        service: SERVICE,
        sections: [
            { key: "overview", text: "Manager Overview", icon: "sap-icon://home", subtitle: "Your team, its assets and open activities", build: overview },
            { key: "employees", text: "Employee Records", icon: "sap-icon://group", subtitle: "Employees of your team and department", build: employees },
            { key: "employeeAssets", text: "Employee Asset Details", icon: "sap-icon://laptop", subtitle: "Assets assigned to your team members", build: employeeAssets },
            { key: "ownership", text: "Asset Ownership", icon: "sap-icon://customer-and-contacts", subtitle: "View, edit and transfer ownership; every change is recorded", build: shared.ownership },
            { key: "allocation", text: "Asset Allocation", icon: "sap-icon://inventory", subtitle: "Assign available assets and track transfers", build: allocation },
            { key: "maintenance", text: "Maintenance Records", icon: "sap-icon://wrench", subtitle: "Maintenance of the assets you manage", build: maintenance },
            { key: "requests", text: "Requests & Approvals", icon: "sap-icon://inbox", subtitle: "Asset requests, returns and issue reports of your team", build: requests },
            { key: "reports", text: "Reports", icon: "sap-icon://business-objects-experience", subtitle: "Allocation, ownership, maintenance and utilization", build: (ctx) => Sections.reports(ctx, REPORTS) },
            { key: "notifications", text: "Notifications", icon: "sap-icon://bell", build: Sections.notifications },
            { key: "profile", text: "Manager Profile", icon: "sap-icon://customer", subtitle: "Your account details", build: profile }
        ]
    };
});
