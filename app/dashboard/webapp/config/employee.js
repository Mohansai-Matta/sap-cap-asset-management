sap.ui.define([
    "sap/m/IconTabBar",
    "sap/m/IconTabFilter",
    "sap/m/VBox",
    "sap/m/Label",
    "sap/m/Text",
    "sap/m/ObjectStatus",
    "sap/m/MessageBox",
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
    "../util/format"
], function (IconTabBar, IconTabFilter, VBox, Label, Text, ObjectStatus, MessageBox, MessageToast, SimpleForm, Filter, FilterOperator,
    EntityTable, Charts, Sections, Actions, FormDialog, api, format) {
    "use strict";

    const SERVICE = "/odata/v4/employee";
    const opts = (keys) => keys.map((k) => ({ key: k, text: format.status(k) }));
    const REQUEST_STATUS = opts(["Pending", "Approved", "Rejected", "InProgress", "Resolved", "Cancelled"]);
    const ISSUE_TYPES = opts(["Damaged", "Lost", "Malfunction"]);
    const myAssetLookup = { path: "/MyAssets", key: "asset_id", text: "asset_tag", additional: "name" };
    const categoryLookup = { path: "/AssetCategories", key: "asset_category_id", text: "name" };

    /* ---------- actions on own assets ---------- */

    const requestReturn = function (ctx, asset, after) {
        FormDialog.open({
            title: "Return Asset - " + asset.asset_tag,
            owner: ctx.owner,
            submitText: "Submit Return Request",
            fields: [{ name: "reason", label: "Reason", type: "textarea", required: true, maxLength: 1000 }],
            onSubmit: async (values) => {
                await api.post(SERVICE + "/requestReturn", { asset_id: asset.asset_id, reason: values.reason });
                MessageToast.show("Return request submitted");
                if (after) after();
            }
        });
    };

    const reportIssue = function (ctx, asset, after) {
        FormDialog.open({
            title: "Report Issue - " + asset.asset_tag,
            owner: ctx.owner,
            submitText: "Report Issue",
            fields: [
                { name: "issue_type", label: "Issue Type", type: "select", required: true, options: ISSUE_TYPES },
                { name: "description", label: "Description", type: "textarea", required: true, maxLength: 1000 }
            ],
            onSubmit: async (values) => {
                await api.post(SERVICE + "/reportIssue", Object.assign({ asset_id: asset.asset_id }, values));
                MessageToast.show("Issue reported");
                if (after) after();
            }
        });
    };

    const ownershipDetails = async function (ctx, asset) {
        try {
            const [ownerships, history] = await Promise.all([
                api.get(SERVICE + "/MyOwnerships?$filter=asset_id%20eq%20" + asset.asset_id + "&$orderby=start_date%20desc"),
                api.get(SERVICE + "/MyAssignmentHistory?$filter=asset_id%20eq%20" + asset.asset_id + "&$orderby=createdAt%20desc")
            ]);
            Actions.showTablesDialog(ctx, "Ownership of " + asset.asset_tag, [
                { heading: "Ownership", rows: ownerships, columns: [
                    { path: "start_date", label: "Owner Since", type: "date" },
                    { path: "expected_return_date", label: "Expected Return", type: "date" },
                    { path: "end_date", label: "Owner Until", type: "date" },
                    { path: "is_current", label: "Current", type: "bool" },
                    { path: "notes", label: "Notes" }] },
                { heading: "History", rows: history, columns: [
                    { path: "transition_date", label: "Date", type: "date" },
                    { path: "action", label: "Action", type: "status" },
                    { path: "from_name", label: "From" },
                    { path: "to_name", label: "To" },
                    { path: "notes", label: "Notes" }] }
            ]);
        } catch (error) {
            MessageBox.error(error.message);
        }
    };

    /* ---------- sections ---------- */

    const overview = async function (ctx) {
        const [stats, assets, notifications, maintenance] = await Promise.all([
            api.fn(SERVICE, "getStats"),
            api.get(SERVICE + "/MyAssets?$orderby=asset_tag"),
            api.get(SERVICE + "/Notifications?$orderby=createdAt%20desc&$top=5"),
            api.get(SERVICE + "/MyMaintenance?$filter=status%20eq%20'Open'%20or%20status%20eq%20'InProgress'%20or%20next_due_date%20ge%20" + format.isoDate(0) + "&$orderby=next_due_date&$top=5")
        ]);
        const go = (section) => () => ctx.navTo(section);
        return [
            Sections.kpis([
                Charts.kpi({ title: "My Assets", value: stats.assignedAssets, icon: "sap-icon://laptop", press: go("myAssets") }),
                Charts.kpi({ title: "Pending Requests", value: stats.pendingRequests, icon: "sap-icon://pending", color: stats.pendingRequests ? "Critical" : "Neutral", press: go("myRequests") }),
                Charts.kpi({ title: "Approved Requests", value: stats.approvedRequests, icon: "sap-icon://accept", color: "Good", press: go("myRequests") }),
                Charts.kpi({ title: "Reported Issues", subtitle: "open", value: stats.openIssues, icon: "sap-icon://alert", color: stats.openIssues ? "Critical" : "Neutral", press: go("reportIssue") }),
                Charts.kpi({ title: "Upcoming Maintenance", subtitle: "next 30 days", value: stats.upcomingMaintenance, icon: "sap-icon://wrench", press: go("maintenance") }),
                Charts.kpi({ title: "Upcoming Returns", subtitle: stats.overdueReturns ? stats.overdueReturns + " overdue" : "next 30 days", value: stats.upcomingReturns + stats.overdueReturns, icon: "sap-icon://undo", color: stats.overdueReturns ? "Error" : "Neutral", press: go("ownership") })
            ]),
            Sections.grid([
                Sections.listCard("My Assets", assets, (a) => ({
                    title: a.asset_tag + (a.name ? " - " + a.name : ""),
                    description: (a.category_name || "") + (a.serial_number ? " · S/N " + a.serial_number : ""),
                    info: format.status(a.status),
                    infoState: format.state(a.status),
                    icon: "sap-icon://laptop",
                    type: "Navigation",
                    press: go("myAssets")
                }), "No assets assigned to you"),
                Sections.listCard("Notifications", notifications, (n) => ({
                    title: n.title,
                    description: n.message,
                    info: format.date(n.createdAt),
                    infoState: n.is_read ? "None" : "Information",
                    icon: n.is_read ? "sap-icon://message-information" : "sap-icon://bell",
                    type: "Navigation",
                    press: go("notifications")
                }), "No notifications"),
                Sections.listCard("Maintenance & Service Dates", maintenance, (m) => ({
                    title: m.asset_tag + " - " + m.type,
                    description: m.next_due_date ? "Next service: " + format.date(m.next_due_date) : (m.description || ""),
                    info: format.status(m.status),
                    infoState: format.state(m.status),
                    icon: "sap-icon://wrench"
                }), "No upcoming maintenance")
            ])
        ];
    };

    const profile = async function () {
        const rows = await api.get(SERVICE + "/MyProfile");
        const me = rows[0] || {};
        const form = new SimpleForm({ editable: false, layout: "ResponsiveGridLayout", labelSpanL: 4, labelSpanM: 4 });
        const add = (label, value) => { form.addContent(new Label({ text: label })); form.addContent(new Text({ text: value || "-" })); };
        add("Employee ID", me.employee_id);
        add("Name", me.full_name);
        add("E-Mail", me.email);
        add("Phone", me.phone);
        add("Location", me.location);
        add("Department", me.department_name);
        add("Designation", me.designation);
        add("Assigned Manager", me.manager_name ? me.manager_name + (me.manager_email ? " (" + me.manager_email + ")" : "") : null);
        form.addContent(new Label({ text: "Status" }));
        form.addContent(new ObjectStatus({ text: format.status(me.status), state: format.state(me.status), inverted: true }));
        return Sections.card("My Profile", form, "Contact your administrator to change these details").addStyleClass("amFormContainer");
    };

    const myAssets = function (ctx) {
        const table = EntityTable.create({
            title: "My Assets",
            entitySet: "MyAssets",
            key: "asset_id",
            orderby: "asset_tag",
            columns: [
                { path: "asset_tag", label: "Asset ID", type: "title", subtitle: "name" },
                { path: "category_name", label: "Category" },
                { path: "serial_number", label: "Serial Number" },
                { path: "assigned_on", label: "Assignment Date", type: "date" },
                { path: "condition", label: "Condition", type: "status" },
                { path: "status", label: "Status", type: "status" }
            ],
            details: [
                { path: "asset_tag", label: "Asset ID" }, { path: "name", label: "Name" }, { path: "category_name", label: "Category" },
                { path: "serial_number", label: "Serial Number" }, { path: "model", label: "Model" }, { path: "assigned_on", label: "Assignment Date", type: "date" },
                { path: "condition", label: "Condition", type: "status" }, { path: "location", label: "Location" },
                { path: "warranty_expiry", label: "Warranty Expiry", type: "date" }, { path: "status", label: "Status", type: "status" }
            ],
            search: ["asset_tag", "name", "serial_number"],
            view: true,
            rowActions: [
                { text: "Ownership Details", icon: "sap-icon://customer-and-contacts", press: (row) => ownershipDetails(ctx, row) },
                { text: "Return Asset", icon: "sap-icon://undo", press: (row, c, t) => requestReturn(ctx, row, t.refresh) },
                { text: "Report Issue", icon: "sap-icon://alert", press: (row, c, t) => reportIssue(ctx, row, t.refresh) }
            ],
            noDataText: "No assets are assigned to you"
        }, ctx);
        ctx.setActiveTable(table);
        return table.control;
    };

    const ownership = function (ctx) {
        const current = EntityTable.create({
            title: "My Asset Ownership",
            entitySet: "MyOwnerships",
            key: "ownership_id",
            orderby: "start_date desc",
            columns: [
                { path: "asset_tag", label: "Asset", type: "title", subtitle: "asset_name" },
                { path: "serial_number", label: "Serial Number" },
                { path: "start_date", label: "Owner Since", type: "date" },
                { path: "expected_return_date", label: "Expected Return", type: "date" },
                { path: "end_date", label: "Owner Until", type: "date" },
                { path: "is_current", label: "Ownership", type: "bool", trueText: "Current", falseText: "Ended", falseState: "None" }
            ],
            search: ["asset_tag", "asset_name"],
            filters: [{ path: "is_current", label: "Ownership", allText: "All records", options: [{ key: "true", text: "Current" }, { key: "false", text: "Ended" }] }],
            view: true
        }, ctx);
        const history = EntityTable.create({
            title: "Ownership History",
            entitySet: "MyAssignmentHistory",
            key: "ledger_id",
            orderby: "createdAt desc",
            columns: [
                { path: "transition_date", label: "Date", type: "date" },
                { path: "asset_tag", label: "Asset", type: "title", subtitle: "asset_name" },
                { path: "action", label: "Action", type: "status" },
                { path: "from_name", label: "From" },
                { path: "to_name", label: "To" },
                { path: "notes", label: "Notes" }
            ],
            search: ["asset_tag", "asset_name", "notes"]
        }, ctx);
        ctx.setActiveTable(current);
        return new VBox({
            items: [
                new Text({ text: "Ownership records are maintained by your manager or the administrator. Use 'Return Asset' or 'Report Issue' to request changes." })
                    .addStyleClass("sapUiSmallMarginBottom"),
                new IconTabBar({
            headerMode: "Inline",
                    expandable: false,
                    applyContentPadding: false,
                    items: [
                        new IconTabFilter({ key: "current", text: "Ownership", icon: "sap-icon://customer-and-contacts", content: [current.control] }),
                        new IconTabFilter({ key: "history", text: "History", icon: "sap-icon://history", content: [history.control] })
                    ],
                    select: (e) => ctx.setActiveTable(e.getParameter("key") === "history" ? history : current)
                })
            ]
        });
    };

    /** My requests of one type (for the request / return / issue pages) */
    const requestsTable = function (ctx, type, title) {
        return EntityTable.create({
            title: title,
            entitySet: "MyRequests",
            key: "request_id",
            orderby: "createdAt desc",
            fixedFilters: type ? [new Filter("type", FilterOperator.EQ, type)] : [],
            select: ["decided_at"],
            columns: [
                { path: "createdAt", label: "Submitted", type: "datetime" },
                { path: "type", label: "Type", type: "status" },
                { path: type === "New" ? "category_name" : "asset_tag", label: type === "New" ? "Category" : "Asset" },
                type === "Issue" ? { path: "issue_type", label: "Issue", type: "status" } : { path: "reason", label: "Reason", maxLines: 2 },
                { path: "status", label: "Status", type: "status" },
                { path: "decision_note", label: "Response", maxLines: 2 }
            ],
            details: [
                { path: "type", label: "Type", type: "status" }, { path: "category_name", label: "Category" }, { path: "asset_tag", label: "Asset" },
                { path: "issue_type", label: "Issue Type" }, { path: "reason", label: "Reason / Description" }, { path: "needed_by", label: "Needed By", type: "date" },
                { path: "createdAt", label: "Submitted", type: "datetime" }, { path: "status", label: "Status", type: "status" },
                { path: "decided_at", label: "Decided", type: "datetime" }, { path: "decision_note", label: "Response" }
            ],
            search: ["reason", "asset_tag", "category_name"],
            filters: [{ path: "status", label: "Status", options: REQUEST_STATUS }].concat(type ? [] : [{ path: "type", label: "Type", options: opts(["New", "Return", "Issue"]) }]),
            view: true,
            rowActions: [{
                text: "Cancel Request", icon: "sap-icon://cancel", visible: { paths: ["status"], test: (s) => s === "Pending" },
                press: (row, c, t) => MessageBox.confirm("Cancel this request?", {
                    onClose: async (action) => {
                        if (action !== MessageBox.Action.OK) return;
                        try {
                            await api.post(SERVICE + "/cancelRequest", { request_id: row.request_id });
                            MessageToast.show("Request cancelled");
                            t.refresh();
                        } catch (error) {
                            MessageBox.error(error.message);
                        }
                    }
                })
            }]
        }, ctx);
    };

    const requestPage = function (ctx, form, type, title) {
        const table = requestsTable(ctx, type, title);
        ctx.setActiveTable(table);
        return [Sections.grid([form(table)], "XL12 L12 M12 S12"), table.control];
    };

    const requestAsset = (ctx) => requestPage(ctx, (table) => Sections.inlineForm({
        title: "Request an Asset",
        subtitle: "Your manager or the administrator will review the request",
        model: ctx.model,
        submitText: "Submit Request",
        successText: "Asset request submitted",
        fields: [
            { name: "category_id", label: "Asset Category", type: "lookup", required: true, lookup: categoryLookup },
            { name: "reason", label: "Reason", type: "textarea", required: true, maxLength: 1000 },
            { name: "needed_by", label: "Needed By", type: "date" }
        ],
        validate: (v) => (v.needed_by && v.needed_by < format.isoDate(0) ? "'Needed by' must not be in the past" : null),
        onSubmit: async (values) => {
            await api.post(SERVICE + "/requestAsset", values);
            table.refresh();
            ctx.notify();
        }
    }), "New", "My Asset Requests");

    const returnAsset = (ctx) => requestPage(ctx, (table) => Sections.inlineForm({
        title: "Return an Asset",
        subtitle: "Submit a return request for an asset assigned to you",
        model: ctx.model,
        submitText: "Submit Return Request",
        successText: "Return request submitted",
        fields: [
            { name: "asset_id", label: "Asset", type: "lookup", required: true, lookup: myAssetLookup },
            { name: "reason", label: "Reason", type: "textarea", required: true, maxLength: 1000 }
        ],
        onSubmit: async (values) => {
            await api.post(SERVICE + "/requestReturn", values);
            table.refresh();
        }
    }), "Return", "My Return Requests");

    const reportIssuePage = (ctx) => requestPage(ctx, (table) => Sections.inlineForm({
        title: "Report an Asset Issue",
        subtitle: "Report damaged, lost or malfunctioning assets",
        model: ctx.model,
        submitText: "Report Issue",
        successText: "Issue reported",
        fields: [
            { name: "asset_id", label: "Asset", type: "lookup", required: true, lookup: myAssetLookup },
            { name: "issue_type", label: "Issue Type", type: "select", required: true, options: ISSUE_TYPES },
            { name: "description", label: "Description", type: "textarea", required: true, maxLength: 1000 }
        ],
        onSubmit: async (values) => {
            await api.post(SERVICE + "/reportIssue", values);
            table.refresh();
        }
    }), "Issue", "My Reported Issues");

    const maintenance = function (ctx) {
        const table = EntityTable.create({
            title: "Maintenance Information",
            entitySet: "MyMaintenance",
            key: "maintenance_id",
            orderby: "reported_date desc",
            columns: [
                { path: "asset_tag", label: "Asset", type: "title", subtitle: "asset_name" },
                { path: "type", label: "Type" },
                { path: "reported_date", label: "Maintenance Date", type: "date" },
                { path: "completed_date", label: "Completed", type: "date" },
                { path: "next_due_date", label: "Next Service", type: "date" },
                { path: "status", label: "Status", type: "status" }
            ],
            details: [
                { path: "asset_tag", label: "Asset" }, { path: "type", label: "Type" }, { path: "description", label: "Description" },
                { path: "vendor_name", label: "Service Provider" }, { path: "reported_date", label: "Maintenance Date", type: "date" },
                { path: "completed_date", label: "Completed", type: "date" }, { path: "next_due_date", label: "Next Service", type: "date" },
                { path: "outcome", label: "Outcome" }, { path: "covered_by_warranty", label: "Covered by Warranty", type: "bool" },
                { path: "status", label: "Status", type: "status" }
            ],
            search: ["asset_tag", "type", "description"],
            filters: [{ path: "status", label: "Status", options: opts(["Open", "InProgress", "Completed", "Cancelled"]) }],
            view: true,
            noDataText: "No maintenance records for your assets"
        }, ctx);
        ctx.setActiveTable(table);
        return table.control;
    };

    const myRequests = function (ctx) {
        const table = requestsTable(ctx, null, "My Requests");
        ctx.setActiveTable(table);
        return table.control;
    };

    return {
        title: "Employee Dashboard",
        service: SERVICE,
        sections: [
            { key: "overview", text: "Overview", icon: "sap-icon://home", subtitle: "Your assets, requests and upcoming dates", build: overview },
            { key: "profile", text: "My Profile", icon: "sap-icon://customer", build: profile },
            { key: "myAssets", text: "My Assets", icon: "sap-icon://laptop", subtitle: "Assets assigned to you", build: myAssets },
            { key: "ownership", text: "My Asset Ownership", icon: "sap-icon://customer-and-contacts", subtitle: "Ownership details and history of your assets", build: ownership },
            { key: "requestAsset", text: "Request an Asset", icon: "sap-icon://cart", build: requestAsset },
            { key: "returnAsset", text: "Return Asset", icon: "sap-icon://undo", build: returnAsset },
            { key: "reportIssue", text: "Report Asset Issues", icon: "sap-icon://alert", build: reportIssuePage },
            { key: "maintenance", text: "Maintenance Information", icon: "sap-icon://wrench", subtitle: "Maintenance history and upcoming service of your assets", build: maintenance },
            { key: "myRequests", text: "My Requests", icon: "sap-icon://inbox", subtitle: "Pending, approved and rejected requests", build: myRequests },
            { key: "notifications", text: "Notifications", icon: "sap-icon://bell", build: Sections.notifications }
        ]
    };
});
