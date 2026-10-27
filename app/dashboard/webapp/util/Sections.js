sap.ui.define([
    "sap/m/FlexBox",
    "sap/m/VBox",
    "sap/m/HBox",
    "sap/m/Select",
    "sap/m/SegmentedButton",
    "sap/m/SegmentedButtonItem",
    "sap/m/Button",
    "sap/m/Label",
    "sap/m/Text",
    "sap/m/Table",
    "sap/m/Column",
    "sap/m/ColumnListItem",
    "sap/m/ObjectNumber",
    "sap/m/MessageBox",
    "sap/m/MessageToast",
    "sap/m/List",
    "sap/m/StandardListItem",
    "sap/f/Card",
    "sap/f/cards/Header",
    "sap/ui/core/Item",
    "sap/ui/layout/Grid",
    "sap/ui/layout/GridData",
    "sap/ui/model/Filter",
    "sap/m/MessageStrip",
    "./Charts",
    "./EntityTable",
    "./FormDialog",
    "./api",
    "./format"
], function (FlexBox, VBox, HBox, Select, SegmentedButton, SegmentedButtonItem, Button, Label, Text, Table, Column,
    ColumnListItem, ObjectNumber, MessageBox, MessageToast, List, StandardListItem, Card, CardHeader, Item, Grid, GridData,
    Filter, MessageStrip, Charts, EntityTable, FormDialog, api, format) {
    "use strict";

    const requireModules = (names) => new Promise((resolve, reject) => sap.ui.require(names, (...m) => resolve(m), reject));

    const Sections = {

        /** Row of KPI tiles */
        kpis: function (tiles) {
            return new FlexBox({ wrap: "Wrap", items: tiles, renderType: "Bare" }).addStyleClass("sapUiSmallMarginBottom");
        },

        /** Responsive grid: two cards per row on desktop, one on phones */
        grid: function (controls, span) {
            return new Grid({
                defaultSpan: span || "XL6 L6 M12 S12",
                hSpacing: 1,
                vSpacing: 0,
                width: "100%",
                content: controls
            });
        },

        /** Card with arbitrary content */
        card: function (title, content, subtitle) {
            const card = new Card({
                width: "100%",
                header: new CardHeader({ title: title, subtitle: subtitle || "" }),
                content: new VBox({ width: "100%", items: Array.isArray(content) ? content : [content] })
            });
            card.addStyleClass("amCard");
            return card;
        },

        /** Simple list of items in a card (e.g. recent activity) */
        listCard: function (title, rows, mapRow, emptyText, subtitle) {
            const list = new List({ noDataText: emptyText || "Nothing to show", showSeparators: "Inner" });
            rows.forEach((r) => list.addItem(new StandardListItem(mapRow(r))));
            return Sections.card(title, list, subtitle);
        },

        /**
         * Form in a card that is submitted with a button (e.g. "Request an Asset").
         * @param {{title:string, subtitle?:string, fields:object[], model?:object, submitText:string,
         *          defaults?:function, validate?:function, onSubmit:function, successText:string}} o
         */
        inlineForm: function (o) {
            const strip = new MessageStrip({ type: "Error", showIcon: true, visible: false }).addStyleClass("sapUiSmallMarginBottom");
            const holder = new VBox({ width: "100%" });
            let built;
            const reset = function () {
                holder.destroyItems();
                built = FormDialog.buildForm(o.fields, o.defaults ? o.defaults() : {}, o.model);
                holder.addItem(built.form);
            };
            reset();
            const card = Sections.card(o.title, [strip, holder, new HBox({
                justifyContent: "End",
                items: [new Button({
                    text: o.submitText,
                    icon: o.icon || "sap-icon://paper-plane",
                    type: "Emphasized",
                    press: async function () {
                        strip.setVisible(false);
                        const values = built.collect();
                        const problem = values ? (o.validate && o.validate(values)) : "Please correct the highlighted fields.";
                        if (problem) {
                            strip.setText(problem);
                            strip.setVisible(true);
                            return;
                        }
                        card.setBusy(true);
                        try {
                            await o.onSubmit(values);
                            MessageToast.show(o.successText || "Submitted");
                            reset();
                        } catch (error) {
                            strip.setText(error.message);
                            strip.setVisible(true);
                        } finally {
                            card.setBusy(false);
                        }
                    }
                })]
            }).addStyleClass("sapUiSmallMarginTop")], o.subtitle);
            card.addStyleClass("amFormContainer");
            return card;
        },

        /** Notifications of the logged-in user */
        notifications: function (ctx) {
            const table = EntityTable.create({
                title: "Notifications",
                entitySet: "Notifications",
                key: "notification_id",
                orderby: "createdAt desc",
                select: ["is_read"],
                columns: [
                    { path: "title", label: "Title", type: "title", subtitle: "message" },
                    { path: "type", label: "Type", type: "status" },
                    { path: "createdAt", label: "Received", type: "datetime" },
                    { path: "is_read", label: "Read", type: "bool", trueText: "Read", falseText: "Unread", falseState: "Warning" }
                ],
                search: ["title", "message"],
                filters: [
                    { path: "is_read", label: "Status", allText: "All", options: [{ key: "false", text: "Unread" }, { key: "true", text: "Read" }] },
                    { path: "type", label: "Type", options: ["Info", "Request", "Ownership", "Maintenance", "Overdue"].map((k) => ({ key: k })) }
                ],
                rowActions: [{
                    text: "Mark as read", icon: "sap-icon://accept",
                    visible: { paths: ["is_read"], test: (read) => !read },
                    press: async (row, c, t) => {
                        await api.post(ctx.service + "/markNotificationRead", { notification_id: row.notification_id });
                        t.refresh();
                        ctx.notify();
                    }
                }],
                toolbarActions: [{
                    text: "Mark all as read", icon: "sap-icon://complete",
                    press: async (c, t) => {
                        await api.post(ctx.service + "/markAllNotificationsRead", {});
                        t.refresh();
                        ctx.notify();
                        MessageToast.show("All notifications marked as read");
                    }
                }]
            }, ctx);
            ctx.setActiveTable(table);
            return table.control;
        },

        /**
         * Reports: pick a report, see it as chart and table, export it.
         * @param {object} ctx
         * @param {{key:string, text:string, chart:string, measure?:string, measureLabel?:string, labelTitle:string}[]} reports
         */
        reports: function (ctx, reports) {
            const container = new VBox({ width: "100%" });
            const select = new Select({
                width: "22rem",
                items: reports.map((r) => new Item({ key: r.key, text: r.text })),
                change: () => load()
            });
            let currentRows = [];
            let current = reports[0];

            const exportReport = async function () {
                try {
                    const [Lib] = await requireModules(["sap/ui/core/Lib"]);
                    await Lib.load({ name: "sap.ui.export" });
                    const [Spreadsheet] = await requireModules(["sap/ui/export/Spreadsheet"]);
                    const sheet = new Spreadsheet({
                        workbook: {
                            columns: [
                                { label: current.labelTitle, property: "label", type: "String" },
                                { label: "Count", property: "count", type: "Number" },
                                { label: current.amountLabel || "Amount", property: "amount", type: "Number", scale: 2 }
                            ]
                        },
                        dataSource: currentRows.map((r) => Object.assign({}, r, { label: format.status(r.label) })),
                        fileName: current.text.replace(/\W+/g, "_") + ".xlsx"
                    });
                    await sheet.build();
                    sheet.destroy();
                } catch (error) {
                    MessageBox.error("Export failed: " + error.message);
                }
            };

            const toolbar = new HBox({
                alignItems: "Center",
                wrap: "Wrap",
                items: [
                    new Label({ text: "Report", labelFor: select }).addStyleClass("sapUiSmallMarginEnd"),
                    select,
                    new Button({ text: "Export", icon: "sap-icon://excel-attachment", press: exportReport }).addStyleClass("sapUiSmallMarginBegin"),
                    new Button({ icon: "sap-icon://refresh", tooltip: "Refresh", press: () => load() }).addStyleClass("sapUiTinyMarginBegin")
                ]
            }).addStyleClass("sapUiSmallMarginBottom");

            const body = new VBox({ width: "100%" });

            const load = async function () {
                current = reports.find((r) => r.key === select.getSelectedKey()) || reports[0];
                body.destroyItems();
                body.setBusy(true);
                try {
                    currentRows = await api.fn(ctx.service, "getReport", { report: current.key });
                    const table = new Table({ noDataText: "No data" });
                    table.addColumn(new Column({ header: new Label({ text: current.labelTitle }) }));
                    table.addColumn(new Column({ header: new Label({ text: "Count" }), hAlign: "End" }));
                    if (current.showAmount !== false) table.addColumn(new Column({ header: new Label({ text: current.amountLabel || "Amount" }), hAlign: "End" }));
                    currentRows.forEach((r) => {
                        const cells = [new Text({ text: format.status(r.label) }), new ObjectNumber({ number: String(r.count) })];
                        if (current.showAmount !== false) cells.push(new ObjectNumber({ number: format.amount(r.amount) }));
                        table.addItem(new ColumnListItem({ cells: cells }));
                    });
                    body.addItem(Sections.grid([
                        Charts.chart({ title: current.text, type: current.chart, rows: currentRows, measure: current.measure, measureLabel: current.measureLabel, height: "340px" }),
                        Sections.card("Data", table, current.subtitle)
                    ]));
                } catch (error) {
                    body.addItem(new Text({ text: error.message }));
                }
                body.setBusy(false);
            };

            container.addItem(toolbar);
            container.addItem(body);
            load();
            return container;
        }
    };

    return Sections;
});
