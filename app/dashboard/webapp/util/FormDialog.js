sap.ui.define([
    "sap/m/Dialog",
    "sap/m/Button",
    "sap/m/Label",
    "sap/m/Input",
    "sap/m/TextArea",
    "sap/m/DatePicker",
    "sap/m/Select",
    "sap/m/ComboBox",
    "sap/m/CheckBox",
    "sap/m/MessageStrip",
    "sap/m/library",
    "sap/ui/core/Item",
    "sap/ui/core/ListItem",
    "sap/ui/core/library",
    "sap/ui/layout/form/SimpleForm",
    "sap/ui/layout/library"
], function (Dialog, Button, Label, Input, TextArea, DatePicker, Select, ComboBox, CheckBox, MessageStrip,
    mobileLibrary, Item, ListItem, coreLibrary, SimpleForm, layoutLibrary) {
    "use strict";

    const ValueState = coreLibrary.ValueState;
    const PATTERNS = {
        email: { regex: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, text: "Enter a valid e-mail address" },
        phone: { regex: /^[+0-9 ()-]{6,20}$/, text: "Enter a valid phone number (6-20 digits)" }
    };

    /** Creates the input control for one field */
    const createControl = function (field, value, model) {
        const editable = field.editable !== false;
        switch (field.type) {
            case "textarea":
                return new TextArea({ value: value || "", rows: 3, width: "100%", maxLength: field.maxLength || 0, editable: editable, growing: true });
            case "date":
                return new DatePicker({ value: value || "", valueFormat: "yyyy-MM-dd", displayFormat: "medium", editable: editable });
            case "number":
            case "decimal":
                return new Input({ value: value === null || value === undefined ? "" : String(value), type: mobileLibrary.InputType.Number, editable: editable });
            case "boolean":
                return new CheckBox({ selected: !!value, editable: editable });
            case "select": {
                const select = new Select({ width: "100%", forceSelection: false, enabled: editable });
                if (!field.required) select.addItem(new Item({ key: "", text: "" }));
                (field.options || []).forEach((o) => select.addItem(new Item({ key: o.key, text: o.text || o.key })));
                select.setSelectedKey(value === null || value === undefined ? "" : String(value));
                return select;
            }
            case "lookup": {
                const lookup = field.lookup;
                const combo = new ComboBox({
                    width: "100%",
                    editable: editable,
                    showSecondaryValues: !!lookup.additional,
                    filterSecondaryValues: !!lookup.additional,
                    placeholder: field.placeholder || "Select...",
                    items: {
                        path: lookup.path,
                        parameters: Object.assign({ $orderby: lookup.orderby || lookup.text }, lookup.parameters || {}),
                        filters: lookup.filters || [],
                        templateShareable: false,
                        template: new ListItem({
                            key: "{" + lookup.key + "}",
                            text: "{" + lookup.text + "}",
                            additionalText: lookup.additional ? "{" + lookup.additional + "}" : ""
                        })
                    }
                });
                combo.setModel(model);
                if (value) {
                    combo.setSelectedKey(value);
                    // the item list loads asynchronously - select again once it is there
                    combo.getBinding("items").attachEventOnce("dataReceived", () => combo.setSelectedKey(value));
                }
                return combo;
            }
            default: {
                const input = new Input({
                    value: value || "",
                    maxLength: field.maxLength || 0,
                    editable: editable,
                    placeholder: field.placeholder || "",
                    type: field.type === "email" ? mobileLibrary.InputType.Email : field.type === "phone" ? mobileLibrary.InputType.Tel : mobileLibrary.InputType.Text
                });
                return input;
            }
        }
    };

    const readValue = function (field, control) {
        switch (field.type) {
            case "boolean": return control.getSelected();
            case "select": return control.getSelectedKey() || null;
            case "lookup": return control.getSelectedKey() || null;
            case "number": return control.getValue() === "" ? null : parseInt(control.getValue(), 10);
            case "decimal": return control.getValue() === "" ? null : Number(control.getValue());
            case "date": return control.getValue() || null;
            default: return control.getValue().trim() || null;
        }
    };

    const setState = function (control, state, text) {
        if (control.setValueState) {
            control.setValueState(state);
            if (control.setValueStateText) control.setValueStateText(text || "");
        }
    };

    /**
     * Builds a form for the field definitions.
     * @returns {{form: sap.ui.layout.form.SimpleForm, collect: function(): (object|null), controls: object}}
     */
    const buildForm = function (fields, data, model) {
        data = data || {};
        const controls = {};
        const form = new SimpleForm({
            editable: true,
            layout: layoutLibrary.form.SimpleFormLayout.ResponsiveGridLayout,
            labelSpanL: 4, labelSpanM: 4, labelSpanS: 12,
            columnsL: 1, columnsM: 1,
            content: []
        });

        fields.forEach((field) => {
            if (field.visible === false) return;
            const initial = data[field.name] !== undefined ? data[field.name] : field.default;
            const control = createControl(field, initial, model);
            controls[field.name] = control;
            form.addContent(new Label({ text: field.label, required: !!field.required && field.editable !== false, labelFor: control }));
            form.addContent(control);
        });

        const collect = function () {
            const values = {};
            let valid = true;
            fields.forEach((field) => {
                const control = controls[field.name];
                if (!control) return;
                const value = readValue(field, control);
                setState(control, ValueState.None);
                if (field.required && (value === null || value === undefined || value === "")) {
                    setState(control, ValueState.Error, "This field is required");
                    valid = false;
                } else if (value && PATTERNS[field.type] && !PATTERNS[field.type].regex.test(value)) {
                    setState(control, ValueState.Error, PATTERNS[field.type].text);
                    valid = false;
                } else if (field.type === "lookup" && control.getValue() && !control.getSelectedKey()) {
                    setState(control, ValueState.Error, "Select a value from the list");
                    valid = false;
                } else if ((field.type === "number" || field.type === "decimal") && value !== null && (isNaN(value) || (field.min !== undefined && value < field.min))) {
                    setState(control, ValueState.Error, field.min !== undefined ? "Enter a number of at least " + field.min : "Enter a number");
                    valid = false;
                } else if (field.type === "date" && control.getValue() && !control.isValidValue()) {
                    setState(control, ValueState.Error, "Enter a valid date");
                    valid = false;
                }
                if (field.editable !== false && field.send !== false) values[field.name] = value;
            });
            return valid ? values : null;
        };

        return { form: form, collect: collect, controls: controls };
    };

    return {
        buildForm: buildForm,

        /**
         * Opens a form dialog.
         * @param {object} options
         * @param {string} options.title
         * @param {object[]} options.fields      field definitions
         * @param {object} [options.data]        initial values
         * @param {sap.ui.model.Model} [options.model]  OData model for lookups
         * @param {string} [options.submitText]
         * @param {function} [options.validate]  (values) => error text or null
         * @param {function} options.onSubmit    async (values) => void; throwing keeps the dialog open
         */
        open: function (options) {
            const strip = new MessageStrip({ type: "Error", showIcon: true, visible: false });
            const built = buildForm(options.fields, options.data, options.model);
            const collect = built.collect;
            const form = built.form;

            const dialog = new Dialog({
                title: options.title,
                contentWidth: options.width || "36rem",
                resizable: true,
                draggable: true,
                content: [strip, form],
                beginButton: new Button({
                    text: options.submitText || "Save",
                    type: mobileLibrary.ButtonType.Emphasized,
                    press: async function () {
                        strip.setVisible(false);
                        const values = collect();
                        if (!values) {
                            strip.setText("Please correct the highlighted fields.");
                            strip.setVisible(true);
                            return;
                        }
                        const problem = options.validate && options.validate(values);
                        if (problem) {
                            strip.setText(problem);
                            strip.setVisible(true);
                            return;
                        }
                        dialog.setBusy(true);
                        try {
                            await options.onSubmit(values);
                            dialog.close();
                        } catch (error) {
                            strip.setText(error.message);
                            strip.setVisible(true);
                        } finally {
                            dialog.setBusy(false);
                        }
                    }
                }),
                endButton: new Button({ text: "Cancel", press: () => dialog.close() }),
                afterClose: () => dialog.destroy()
            });
            dialog.addStyleClass("sapUiContentPadding");
            if (options.owner) options.owner.addDependent(dialog);
            dialog.open();
            return dialog;
        }
    };
});
