sap.ui.define([
    "sap/m/Table",
    "sap/m/Column",
    "sap/m/ColumnListItem",
    "sap/m/Text",
    "sap/m/Title",
    "sap/m/Toolbar",
    "sap/m/OverflowToolbar",
    "sap/m/ToolbarSpacer",
    "sap/m/SearchField",
    "sap/m/Select",
    "sap/m/ComboBox",
    "sap/m/Button",
    "sap/m/MenuButton",
    "sap/m/Menu",
    "sap/m/MenuItem",
    "sap/m/HBox",
    "sap/m/VBox",
    "sap/m/ObjectStatus",
    "sap/m/ObjectNumber",
    "sap/m/ObjectIdentifier",
    "sap/m/MessageBox",
    "sap/m/MessageToast",
    "sap/m/Dialog",
    "sap/m/ViewSettingsDialog",
    "sap/m/ViewSettingsItem",
    "sap/m/Label",
    "sap/m/library",
    "sap/ui/core/Item",
    "sap/ui/core/ListItem",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/model/Sorter",
    "sap/ui/layout/form/SimpleForm",
    "./format",
    "./api",
    "./FormDialog"
], function (Table, Column, ColumnListItem, Text, Title, Toolbar, OverflowToolbar, ToolbarSpacer, SearchField, Select, ComboBox,
    Button, MenuButton, Menu, MenuItem, HBox, VBox, ObjectStatus, ObjectNumber, ObjectIdentifier, MessageBox, MessageToast, Dialog, ViewSettingsDialog, ViewSettingsItem, Label,
    mobileLibrary, Item, ListItem, Filter, FilterOperator, Sorter, SimpleForm, format, api, FormDialog) {
    "use strict";

    const ButtonType = mobileLibrary.ButtonType;

    /** Cell control for a column definition */
    const createCell = function (col) {
        switch (col.type) {
            case "title":
                return new ObjectIdentifier({ title: "{" + col.path + "}", text: col.subtitle ? "{" + col.subtitle + "}" : "" });
            case "status":
                return new ObjectStatus({
                    text: { path: col.path, targetType: "any", formatter: format.status },
                    state: { path: col.path, targetType: "any", formatter: format.state },
                    inverted: true
                });
            case "bool":
                return new ObjectStatus({
                    text: { path: col.path, targetType: "any", formatter: (v) => (v ? (col.trueText || "Yes") : (col.falseText || "No")) },
                    state: { path: col.path, targetType: "any", formatter: (v) => (v ? "Success" : (col.falseState || "Error")) },
                    inverted: true
                });
            case "date":
                return new Text({ text: { path: col.path, targetType: "any", formatter: format.date } });
            case "datetime":
                return new Text({ text: { path: col.path, targetType: "any", formatter: format.dateTime } });
            case "amount":
                return new ObjectNumber({
                    number: { path: col.path, targetType: "any", formatter: format.amount },
                    unit: col.unit ? "{" + col.unit + "}" : ""
                });
            default:
                return new Text({ text: "{" + col.path + "}", wrapping: col.wrap !== false, maxLines: col.maxLines || 3 });
        }
    };

    const keyPredicate = function (cfg, row) {
        return "(" + api.keyLiteral(row[cfg.key], cfg.keyType) + ")";
    };

    /**
     * Builds a table section for an entity set.
     *
     * @param {object} cfg
     * @param {string} cfg.title
     * @param {string} cfg.entitySet         e.g. "Assets"
     * @param {string} cfg.key               key property
     * @param {object[]} cfg.columns         {path, label, type, width, subtitle, unit}
     * @param {string[]} [cfg.search]        properties for the search field
     * @param {object[]} [cfg.filters]       select filters {path, label, options|lookup, default}
     * @param {sap.ui.model.Filter[]} [cfg.fixedFilters]
     * @param {string} [cfg.orderby]
     * @param {string[]} [cfg.select]        additional properties to load (used by actions)
     * @param {object} [cfg.create]          {title, fields, before(values) (async, throw to stop), prepare(values), after(values, created)}
     * @param {object} [cfg.edit]            {title, fields}
     * @param {boolean|object} [cfg.remove]  delete action {confirm}
     * @param {boolean} [cfg.view]           view details action
     * @param {object[]} [cfg.rowActions]    {text, icon, type, visible:{paths, test}, press(row, ctx, table)}
     * @param {object[]} [cfg.toolbarActions]{text, icon, type, press(ctx, table)}
     * @param {object} ctx                   {service, model, owner, notify}
     */
    const create = function (cfg, ctx) {
        const model = ctx.model;
        const title = new Title({ text: cfg.title, level: "H3" });
        const table = new Table({
            growing: true,
            growingThreshold: cfg.pageSize || 10,
            growingScrollToLoad: false,
            sticky: ["ColumnHeaders", "HeaderToolbar"],
            alternateRowColors: true,
            popinLayout: mobileLibrary.PopinLayout.GridSmall,
            noDataText: cfg.noDataText || "No records found",
            width: "100%"
        });
        table.setModel(model);

        /* ---------- search & filters ---------- */

        let searchText = "";
        const filterControls = [];

        const currentFilters = function () {
            const filters = (cfg.fixedFilters || []).slice();
            filterControls.forEach(({ def, control }) => {
                const key = control.getSelectedKey();
                if (key === "" || key === null || key === undefined) return;
                const value = key === "true" ? true : key === "false" ? false : key === "null" ? null : key;
                filters.push(new Filter(def.path, def.operator || FilterOperator.EQ, value));
            });
            if (searchText && cfg.search && cfg.search.length) {
                filters.push(new Filter({
                    filters: cfg.search.map((p) => new Filter({ path: p, operator: FilterOperator.Contains, value1: searchText, caseSensitive: false })),
                    and: false
                }));
            }
            return filters.length ? new Filter({ filters: filters, and: true }) : [];
        };

        const applyFilters = function () {
            const binding = table.getBinding("items");
            if (binding) binding.filter(currentFilters());
        };

        /* ---------- columns ---------- */

        cfg.columns.forEach((col, index) => {
            table.addColumn(new Column({
                header: new Label({ text: col.label, wrapping: true }),
                width: col.width,
                hAlign: col.type === "amount" ? "End" : "Begin",
                minScreenWidth: index < 2 ? "" : (col.minScreenWidth || "Tablet"),
                demandPopin: index >= 2,
                popinDisplay: "Inline"
            }));
        });

        const actions = [];
        if (cfg.view) {
            actions.push({ text: "View", icon: "sap-icon://display", press: (row) => showDetails(row) });
        }
        (cfg.rowActions || []).forEach((a) => actions.push(a));
        if (cfg.edit) {
            actions.push({ text: "Edit", icon: "sap-icon://edit", visible: cfg.edit.visible, press: (row) => openEdit(row) });
        }
        if (cfg.remove) {
            actions.push({ text: "Delete", icon: "sap-icon://delete", visible: cfg.remove.visible, press: (row) => remove(row) });
        }
        if (actions.length) {
            const buttons = actions.length <= 3 ? actions.length : (actions.filter((a) => a.primary).length || 2) + 1;
            table.addColumn(new Column({ header: new Label({ text: "Actions" }), hAlign: "End", width: cfg.actionsWidth || (buttons * 2.75 + 0.5) + "rem" }));
        }

        const cells = cfg.columns.map(createCell);
        if (actions.length) {
            // up to three actions are shown as buttons; otherwise the primary ones (or the first two) plus a "More" menu
            const flagged = actions.filter((a) => a.primary);
            const inline = actions.length <= 3 ? actions : (flagged.length ? flagged : actions.slice(0, 2));
            const more = actions.filter((a) => inline.indexOf(a) < 0);
            const visibleBinding = (a) => (a.visible
                ? { parts: a.visible.paths.map((path) => ({ path: path, targetType: "any" })), formatter: a.visible.test }
                : true);
            const run = (a, source) => a.press(source.getBindingContext().getObject(), ctx, api_);
            const items = inline.map((a) => new Button({
                icon: a.icon,
                text: a.showText ? a.text : "",
                tooltip: a.text,
                type: a.type || ButtonType.Transparent,
                visible: visibleBinding(a),
                press: (event) => run(a, event.getSource())
            }).addStyleClass("sapUiTinyMarginBegin"));
            if (more.length) {
                items.push(new MenuButton({
                    icon: "sap-icon://overflow",
                    tooltip: "More actions",
                    type: ButtonType.Transparent,
                    menu: new Menu({
                        items: more.map((a) => new MenuItem({
                            text: a.text,
                            icon: a.icon,
                            visible: visibleBinding(a),
                            press: (event) => run(a, event.getSource())
                        }))
                    })
                }).addStyleClass("sapUiTinyMarginBegin"));
            }
            cells.push(new HBox({ justifyContent: "End", alignItems: "Center", items: items }));
        }
        const template = new ColumnListItem({ cells: cells, vAlign: "Middle" });

        // properties needed by the edit dialog and actions are loaded as well
        const editFields = cfg.edit ? cfg.edit.fields.filter((f) => !f.virtual).map((f) => f.name) : [];
        const select = Array.from(new Set([cfg.key].concat(cfg.select || [], editFields)));
        table.bindItems({
            path: "/" + cfg.entitySet,
            parameters: Object.assign({ $count: true, $select: select.join(",") }, cfg.orderby ? { $orderby: cfg.orderby } : {}),
            template: template,
            templateShareable: false,
            filters: (function () {
                // initial filters incl. defaults of filter selects
                const f = (cfg.fixedFilters || []).slice();
                (cfg.filters || []).forEach((def) => {
                    if (def.default !== undefined && def.default !== "") {
                        f.push(new Filter(def.path, def.operator || FilterOperator.EQ, def.default));
                    }
                });
                return f.length ? new Filter({ filters: f, and: true }) : [];
            })()
        });

        const updateCount = function () {
            const binding = table.getBinding("items");
            const count = binding && binding.getHeaderContext() ? binding.getHeaderContext().getProperty("$count") : undefined;
            title.setText(cfg.title + (count !== undefined ? " (" + count + ")" : ""));
        };
        table.getBinding("items").attachEvent("dataReceived", (event) => {
            updateCount();
            const error = event.getParameter("error");
            if (error) table.setNoDataText(error.message);
        });
        table.getBinding("items").attachChange(updateCount);

        /* ---------- toolbar ---------- */

        const toolbar = new OverflowToolbar({ style: "Clear", content: [title, new ToolbarSpacer()] });
        if (cfg.search && cfg.search.length) {
            toolbar.addContent(new SearchField({
                width: "14rem",
                placeholder: "Search " + cfg.title.toLowerCase(),
                search: function (event) {
                    searchText = (event.getParameter("query") || "").trim();
                    applyFilters();
                }
            }));
        }
        (cfg.filters || []).forEach((def) => {
            let control;
            if (def.lookup) {
                control = new ComboBox({
                    width: "11rem",
                    placeholder: def.label,
                    items: {
                        path: def.lookup.path,
                        parameters: { $orderby: def.lookup.text },
                        filters: def.lookup.filters || [],
                        templateShareable: false,
                        template: new ListItem({ key: "{" + def.lookup.key + "}", text: "{" + def.lookup.text + "}" })
                    },
                    selectionChange: applyFilters
                });
                control.setModel(model);
            } else {
                control = new Select({
                    width: "10rem",
                    tooltip: def.label,
                    items: [new Item({ key: "", text: def.allText || ("All " + def.label.toLowerCase()) })]
                        .concat(def.options.map((o) => new Item({ key: String(o.key), text: o.text || format.status(o.key) }))),
                    change: applyFilters
                });
                if (def.default !== undefined) control.setSelectedKey(String(def.default));
            }
            filterControls.push({ def: def, control: control });
            toolbar.addContent(control);
        });

        const api_ = {
            table: table,
            refresh: function () {
                const binding = table.getBinding("items");
                if (binding) binding.refresh();
            },
            search: function (text) {
                searchText = (text || "").trim();
                applyFilters();
            }
        };

        if (cfg.create) {
            toolbar.addContent(new Button({
                text: cfg.create.buttonText || "Create",
                icon: "sap-icon://add",
                type: ButtonType.Emphasized,
                press: () => openCreate()
            }));
        }
        (cfg.toolbarActions || []).forEach((a) => toolbar.addContent(new Button({
            text: a.text, icon: a.icon, type: a.type || ButtonType.Default,
            press: () => a.press(ctx, api_)
        })));
        toolbar.addContent(new Button({ icon: "sap-icon://sort", tooltip: "Sort", press: () => openSort() }));
        toolbar.addContent(new Button({
            icon: "sap-icon://excel-attachment", tooltip: "Export to spreadsheet",
            press: () => exportData()
        }));
        toolbar.addContent(new Button({ icon: "sap-icon://refresh", tooltip: "Refresh", press: () => api_.refresh() }));
        table.setHeaderToolbar(toolbar);

        /* ---------- actions ---------- */

        const collectionUrl = () => ctx.service + "/" + cfg.entitySet;

        function openCreate() {
            FormDialog.open({
                title: cfg.create.title || ("Create " + cfg.title),
                fields: cfg.create.fields,
                data: cfg.create.defaults ? cfg.create.defaults() : {},
                model: model,
                owner: ctx.owner,
                submitText: "Create",
                validate: cfg.create.validate,
                onSubmit: async function (values) {
                    if (cfg.create.before) await cfg.create.before(values, ctx);
                    const payload = cfg.create.prepare ? cfg.create.prepare(values) : values;
                    const created = await api.post(collectionUrl(), payload);
                    if (cfg.create.after) await cfg.create.after(values, created, ctx);
                    MessageToast.show(cfg.create.successText || (cfg.title + ": record created"));
                    api_.refresh();
                    if (ctx.notify) ctx.notify();
                }
            });
        }

        function openEdit(row) {
            FormDialog.open({
                title: cfg.edit.title || ("Edit " + cfg.title),
                fields: cfg.edit.fields,
                data: row,
                model: model,
                owner: ctx.owner,
                validate: cfg.edit.validate,
                onSubmit: async function (values) {
                    const payload = cfg.edit.prepare ? cfg.edit.prepare(values, row) : values;
                    await api.patch(collectionUrl() + keyPredicate(cfg, row), payload);
                    if (cfg.edit.after) await cfg.edit.after(values, row, ctx);
                    MessageToast.show("Changes saved");
                    api_.refresh();
                    if (ctx.notify) ctx.notify();
                }
            });
        }

        function remove(row) {
            const label = cfg.remove.label ? cfg.remove.label(row) : (row[cfg.columns[0].path] || row[cfg.key]);
            MessageBox.confirm("Delete \"" + label + "\"? This cannot be undone.", {
                title: "Confirm deletion",
                emphasizedAction: MessageBox.Action.OK,
                onClose: async function (action) {
                    if (action !== MessageBox.Action.OK) return;
                    try {
                        await api.del(collectionUrl() + keyPredicate(cfg, row));
                        MessageToast.show("Deleted");
                        api_.refresh();
                        if (ctx.notify) ctx.notify();
                    } catch (error) {
                        MessageBox.error(error.message);
                    }
                }
            });
        }

        function showDetails(row) {
            const detailColumns = cfg.details || cfg.columns;
            const form = new SimpleForm({ editable: false, layout: "ResponsiveGridLayout", labelSpanM: 4, labelSpanL: 4 });
            detailColumns.forEach((col) => {
                const value = row[col.path];
                let text;
                if (col.type === "date") text = format.date(value);
                else if (col.type === "datetime") text = format.dateTime(value);
                else if (col.type === "amount") text = format.amount(value) + (col.unit && row[col.unit] ? " " + row[col.unit] : "");
                else if (col.type === "bool") text = value ? "Yes" : "No";
                else if (col.type === "status") text = format.status(value);
                else text = value === null || value === undefined ? "" : String(value);
                form.addContent(new Label({ text: col.label }));
                form.addContent(col.type === "status"
                    ? new ObjectStatus({ text: text, state: format.state(value), inverted: true })
                    : new Text({ text: text || "-" }));
            });
            const dialog = new Dialog({
                title: cfg.title + " details",
                contentWidth: "34rem",
                content: [form],
                endButton: new Button({ text: "Close", press: () => dialog.close() }),
                afterClose: () => dialog.destroy()
            });
            if (ctx.owner) ctx.owner.addDependent(dialog);
            dialog.open();
        }

        let sortDialog;
        function openSort() {
            if (!sortDialog) {
                const [initialPath, initialDir] = (cfg.orderby || cfg.columns[0].path).split(/\s+/);
                sortDialog = new ViewSettingsDialog({
                    title: "Sort " + cfg.title,
                    sortDescending: (initialDir || "").toLowerCase() === "desc",
                    sortItems: cfg.columns.map((col) => new ViewSettingsItem({
                        key: col.path, text: col.label, selected: col.path === initialPath
                    })),
                    confirm: function (event) {
                        const item = event.getParameter("sortItem");
                        if (!item) return;
                        table.getBinding("items").sort(new Sorter(item.getKey(), event.getParameter("sortDescending")));
                    }
                });
                if (ctx.owner) ctx.owner.addDependent(sortDialog);
            }
            sortDialog.open();
        }

        async function exportData() {
            const binding = table.getBinding("items");
            try {
                const [Lib] = await new Promise((resolve, reject) => sap.ui.require(["sap/ui/core/Lib"], (...m) => resolve(m), reject));
                await Lib.load({ name: "sap.ui.export" });
                const [Spreadsheet] = await new Promise((resolve, reject) => sap.ui.require(["sap/ui/export/Spreadsheet"], (...m) => resolve(m), reject));
                const count = binding.getHeaderContext().getProperty("$count") || binding.getLength() || 0;
                const contexts = await binding.requestContexts(0, Math.max(count, 1));
                const rows = contexts.map((c) => {
                    const o = c.getObject();
                    const r = {};
                    cfg.columns.forEach((col) => {
                        const v = o[col.path];
                        r[col.path] = col.type === "status" ? format.status(v) : col.type === "bool" ? (v ? "Yes" : "No") : v;
                    });
                    return r;
                });
                const sheet = new Spreadsheet({
                    workbook: {
                        columns: cfg.columns.map((col) => ({
                            label: col.label,
                            property: col.path,
                            type: col.type === "amount" ? "Number" : col.type === "date" ? "Date" : "String",
                            scale: col.type === "amount" ? 2 : undefined
                        }))
                    },
                    dataSource: rows,
                    fileName: cfg.title.replace(/\W+/g, "_") + ".xlsx"
                });
                await sheet.build();
                sheet.destroy();
            } catch (error) {
                MessageBox.error("Export failed: " + error.message);
            }
        }

        const box = new VBox({ items: [table], width: "100%" });
        const destroyBox = box.destroy.bind(box);
        box.destroy = function () {
            if (sortDialog) sortDialog.destroy();
            return destroyBox.apply(null, arguments);
        };
        box.data("entityTable", api_);
        api_.control = box;
        return api_;
    };

    return { create: create };
});
