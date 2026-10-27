sap.ui.define([
    "sap/m/Dialog",
    "sap/m/Button",
    "sap/m/Table",
    "sap/m/Column",
    "sap/m/ColumnListItem",
    "sap/m/Text",
    "sap/m/Label",
    "sap/m/ObjectStatus",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "./FormDialog",
    "./api",
    "./format"
], function (Dialog, Button, Table, Column, ColumnListItem, Text, Label, ObjectStatus, MessageToast, MessageBox,
    Filter, FilterOperator, FormDialog, api, format) {
    "use strict";

    const CONDITIONS = ["New", "Good", "Fair", "Poor", "Damaged"].map((k) => ({ key: k }));
    const MAINTENANCE_STATUS = ["Open", "InProgress", "Completed", "Cancelled"].map((k) => ({ key: k, text: format.status(k) }));

    const employeeLookup = (filters) => ({ path: "/Employees", key: "employee_id", text: "full_name", additional: "email", filters: filters || [] });
    const availableAssetLookup = (extraFilters) => ({
        path: "/Assets",
        key: "asset_id",
        text: "asset_tag",
        additional: "name",
        filters: [new Filter("status", FilterOperator.EQ, "Available")].concat(extraFilters || [])
    });

    const done = function (ctx, refresh, text) {
        MessageToast.show(text);
        if (refresh) refresh();
        if (ctx.notify) ctx.notify();
    };

    const buildTable = function (columns, rows, heading) {
        const table = new Table({ noDataText: "No records", growing: true, growingThreshold: 20 });
        if (heading) table.setHeaderText(heading + " (" + rows.length + ")");
        columns.forEach((c, i) => table.addColumn(new Column({ header: new Label({ text: c.label }), minScreenWidth: i < 2 ? "" : "Tablet", demandPopin: i >= 2 })));
        rows.forEach((row) => table.addItem(new ColumnListItem({
            cells: columns.map((c) => {
                const v = row[c.path];
                if (c.type === "status") return new ObjectStatus({ text: format.status(v), state: format.state(v), inverted: true });
                if (c.type === "date") return new Text({ text: format.date(v) });
                if (c.type === "datetime") return new Text({ text: format.dateTime(v) });
                if (c.type === "bool") return new Text({ text: v ? "Yes" : "No" });
                return new Text({ text: v === null || v === undefined ? "" : String(v) });
            })
        })));
        return table;
    };

    /**
     * Read-only tables in a dialog.
     * @param {object} ctx
     * @param {string} title
     * @param {{heading?:string, columns:object[], rows:object[]}[]} parts
     */
    const showTablesDialog = function (ctx, title, parts) {
        const dialog = new Dialog({
            title: title,
            contentWidth: "52rem",
            resizable: true,
            content: parts.map((p) => buildTable(p.columns, p.rows, p.heading).addStyleClass("sapUiSmallMarginBottom")),
            endButton: new Button({ text: "Close", press: () => dialog.close() }),
            afterClose: () => dialog.destroy()
        });
        ctx.owner.addDependent(dialog);
        dialog.open();
    };

    /** Read-only table of rows in a dialog */
    const showTableDialog = (ctx, title, columns, rows) => showTablesDialog(ctx, title, [{ columns: columns, rows: rows }]);

    return {
        CONDITIONS: CONDITIONS,
        MAINTENANCE_STATUS: MAINTENANCE_STATUS,
        employeeLookup: employeeLookup,
        availableAssetLookup: availableAssetLookup,
        showTableDialog: showTableDialog,
        showTablesDialog: showTablesDialog,

        /** Assign an available asset to an employee (asset or employee may be preselected) */
        assign: function (ctx, refresh, preset) {
            preset = preset || {};
            FormDialog.open({
                title: "Assign Asset",
                owner: ctx.owner,
                model: ctx.model,
                submitText: "Assign",
                data: Object.assign({ start_date: format.isoDate(0) }, preset),
                fields: [
                    { name: "asset_id", label: "Asset", type: "lookup", required: true, lookup: availableAssetLookup(), editable: !preset.asset_id },
                    { name: "employee_id", label: "Employee", type: "lookup", required: true, lookup: employeeLookup([new Filter("status", FilterOperator.NE, "Inactive")]) },
                    { name: "start_date", label: "Start Date", type: "date", required: true },
                    { name: "expected_return_date", label: "Expected Return Date", type: "date" },
                    { name: "notes", label: "Notes", type: "textarea", maxLength: 500 }
                ],
                validate: (v) => (v.expected_return_date && v.expected_return_date < v.start_date ? "Expected return date must not be before the start date" : null),
                onSubmit: async (values) => {
                    values.asset_id = values.asset_id || preset.asset_id;
                    await api.post(ctx.service + "/assignAsset", values);
                    done(ctx, refresh, "Asset assigned");
                }
            });
        },

        /** Transfer an assigned asset to another employee */
        transfer: function (ctx, refresh, asset) {
            FormDialog.open({
                title: "Transfer Ownership - " + (asset.asset_tag || ""),
                owner: ctx.owner,
                model: ctx.model,
                submitText: "Transfer",
                data: { current_holder: asset.holder_name || asset.owner_name, transfer_date: format.isoDate(0) },
                fields: [
                    { name: "current_holder", label: "Current Owner", editable: false, send: false },
                    { name: "to_employee_id", label: "New Owner", type: "lookup", required: true, lookup: employeeLookup([new Filter("status", FilterOperator.NE, "Inactive")]) },
                    { name: "transfer_date", label: "Transfer Date", type: "date", required: true },
                    { name: "expected_return_date", label: "Expected Return Date", type: "date" },
                    { name: "notes", label: "Notes", type: "textarea", maxLength: 500 }
                ],
                onSubmit: async (values) => {
                    await api.post(ctx.service + "/transferAsset", Object.assign({ asset_id: asset.asset_id || asset.asset_asset_id }, values));
                    done(ctx, refresh, "Ownership transferred");
                }
            });
        },

        /** Record the return of an asset */
        returnAsset: function (ctx, refresh, asset) {
            FormDialog.open({
                title: "Return Asset - " + (asset.asset_tag || ""),
                owner: ctx.owner,
                submitText: "Record Return",
                data: { holder: asset.holder_name || asset.owner_name, return_date: format.isoDate(0), condition: asset.condition },
                fields: [
                    { name: "holder", label: "Returned By", editable: false, send: false },
                    { name: "return_date", label: "Return Date", type: "date", required: true },
                    { name: "condition", label: "Condition", type: "select", options: CONDITIONS },
                    { name: "notes", label: "Notes", type: "textarea", maxLength: 500 }
                ],
                onSubmit: async (values) => {
                    await api.post(ctx.service + "/returnAsset", Object.assign({ asset_id: asset.asset_id || asset.asset_asset_id }, values));
                    done(ctx, refresh, "Return recorded");
                }
            });
        },

        /** Edit the details of an ownership record */
        editOwnership: function (ctx, refresh, ownership) {
            FormDialog.open({
                title: "Edit Ownership - " + ownership.asset_tag,
                owner: ctx.owner,
                data: ownership,
                fields: [
                    { name: "owner_name", label: "Owner", editable: false, send: false },
                    { name: "start_date", label: "Start Date", type: "date", required: true },
                    { name: "expected_return_date", label: "Expected Return Date", type: "date" },
                    { name: "notes", label: "Notes", type: "textarea", maxLength: 500 }
                ],
                validate: (v) => (v.expected_return_date && v.expected_return_date < v.start_date ? "Expected return date must not be before the start date" : null),
                onSubmit: async (values) => {
                    await api.post(ctx.service + "/updateOwnership", Object.assign({ ownership_id: ownership.ownership_id }, values));
                    done(ctx, refresh, "Ownership updated - the change was recorded in the history");
                }
            });
        },

        /** Complete assignment history of an asset */
        history: async function (ctx, assetId, assetTag) {
            try {
                const rows = await api.get(ctx.service + "/AssignmentHistory?$filter=asset_asset_id%20eq%20" + assetId + "&$orderby=createdAt%20desc");
                showTableDialog(ctx, "Ownership History - " + (assetTag || ""), [
                    { path: "transition_date", label: "Date", type: "date" },
                    { path: "action", label: "Action", type: "status" },
                    { path: "from_name", label: "From" },
                    { path: "to_name", label: "To" },
                    { path: "createdBy", label: "Recorded By" },
                    { path: "notes", label: "Notes" }
                ], rows);
            } catch (error) {
                MessageBox.error(error.message);
            }
        },

        /** Approve a request (New: pick an available asset of the requested category) */
        approve: function (ctx, refresh, request) {
            const fields = [
                { name: "summary", label: "Request", editable: false, send: false },
                { name: "requester_name", label: "Requested By", editable: false, send: false },
                { name: "reason", label: "Reason", type: "textarea", editable: false, send: false }
            ];
            if (request.type === "New") {
                fields.push({
                    name: "asset_id", label: "Allocate Asset", type: "lookup", required: true,
                    lookup: availableAssetLookup(request.category_asset_category_id
                        ? [new Filter("category_asset_category_id", FilterOperator.EQ, request.category_asset_category_id)] : [])
                });
            }
            fields.push({ name: "note", label: "Note", type: "textarea", maxLength: 500 });
            const summary = request.type === "New" ? "New " + (request.category_name || "asset")
                : request.type === "Return" ? "Return of " + request.asset_tag
                    : "Issue (" + request.issue_type + ") for " + request.asset_tag;
            FormDialog.open({
                title: "Approve Request",
                owner: ctx.owner,
                model: ctx.model,
                submitText: "Approve",
                data: Object.assign({ summary: summary }, request),
                fields: fields,
                onSubmit: async (values) => {
                    await api.post(ctx.service + "/approveRequest", Object.assign({ request_id: request.request_id }, values));
                    done(ctx, refresh, request.type === "Issue" ? "Issue accepted - maintenance record opened" : "Request approved");
                }
            });
        },

        reject: function (ctx, refresh, request) {
            FormDialog.open({
                title: "Reject Request",
                owner: ctx.owner,
                submitText: "Reject",
                fields: [{ name: "note", label: "Reason for rejection", type: "textarea", required: true, maxLength: 500 }],
                onSubmit: async (values) => {
                    await api.post(ctx.service + "/rejectRequest", { request_id: request.request_id, note: values.note });
                    done(ctx, refresh, "Request rejected");
                }
            });
        },

        resolve: function (ctx, refresh, request) {
            FormDialog.open({
                title: "Resolve Issue",
                owner: ctx.owner,
                submitText: "Resolve",
                fields: [{ name: "note", label: "Resolution", type: "textarea", maxLength: 500 }],
                onSubmit: async (values) => {
                    await api.post(ctx.service + "/resolveRequest", { request_id: request.request_id, note: values.note });
                    done(ctx, refresh, "Issue resolved");
                }
            });
        },

        /** Update the status of a maintenance record */
        maintenanceStatus: function (ctx, refresh, record) {
            FormDialog.open({
                title: "Update Maintenance Status - " + (record.asset_tag || ""),
                owner: ctx.owner,
                submitText: "Update",
                data: { status: record.status, cost: record.cost, outcome: record.outcome, completed_date: format.isoDate(0) },
                fields: [
                    { name: "status", label: "Status", type: "select", required: true, options: MAINTENANCE_STATUS },
                    { name: "completed_date", label: "Completed On (if completed)", type: "date" },
                    { name: "cost", label: "Cost", type: "decimal", min: 0 },
                    { name: "outcome", label: "Outcome", type: "textarea", maxLength: 255 }
                ],
                onSubmit: async (values) => {
                    if (values.status !== "Completed") delete values.completed_date;
                    await api.post(ctx.service + "/updateMaintenanceStatus", Object.assign({ maintenance_id: record.maintenance_id }, values));
                    done(ctx, refresh, "Maintenance status updated");
                }
            });
        }
    };
});
