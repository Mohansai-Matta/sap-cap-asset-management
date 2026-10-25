sap.ui.define([
    "sap/ui/core/format/DateFormat",
    "sap/ui/core/format/NumberFormat",
    "sap/ui/core/library"
], function (DateFormat, NumberFormat, coreLibrary) {
    "use strict";

    const ValueState = coreLibrary.ValueState;
    const dateFormat = DateFormat.getDateInstance({ style: "medium" });
    const dateTimeFormat = DateFormat.getDateTimeInstance({ style: "medium" });
    const amountFormat = NumberFormat.getFloatInstance({ minFractionDigits: 2, maxFractionDigits: 2, groupingEnabled: true });

    // value state (badge colour) per status value
    const STATES = {
        Available: ValueState.Success,
        Assigned: ValueState.Information,
        InRepair: ValueState.Warning,
        Lost: ValueState.Error,
        Retired: ValueState.None,
        Archived: ValueState.None,
        Active: ValueState.Success,
        Inactive: ValueState.Error,
        OnLeave: ValueState.Warning,
        Pending: ValueState.Warning,
        Approved: ValueState.Success,
        Rejected: ValueState.Error,
        InProgress: ValueState.Information,
        Resolved: ValueState.Success,
        Cancelled: ValueState.None,
        Open: ValueState.Warning,
        Completed: ValueState.Success,
        New: ValueState.Information,
        Good: ValueState.Success,
        Fair: ValueState.Warning,
        Poor: ValueState.Error,
        Damaged: ValueState.Error,
        Return: ValueState.Information,
        Issue: ValueState.Warning,
        Assign: ValueState.Success,
        Transfer: ValueState.Information,
        Update: ValueState.None,
        true: ValueState.Success,
        false: ValueState.Error
    };

    // human readable texts for enum values
    const TEXTS = {
        InRepair: "In Repair",
        OnLeave: "On Leave",
        InProgress: "In Progress",
        New: "New",
        true: "Yes",
        false: "No"
    };

    const toDate = (value) => {
        if (!value) return null;
        if (value instanceof Date) return value;
        // plain dates (YYYY-MM-DD) are interpreted as local dates
        if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
            const [y, m, d] = value.split("-").map(Number);
            return new Date(y, m - 1, d);
        }
        return new Date(value);
    };

    return {
        STATES: STATES,
        date: (value) => (value ? dateFormat.format(toDate(value)) : ""),
        dateTime: (value) => (value ? dateTimeFormat.format(toDate(value)) : ""),
        amount: (value) => (value === null || value === undefined || value === "" ? "" : amountFormat.format(Number(value))),
        status: (value) => (value === null || value === undefined ? "" : (TEXTS[value] || String(value))),
        state: (value) => STATES[value] || ValueState.None,
        bool: (value) => (value ? "Yes" : "No"),
        /** ISO date (YYYY-MM-DD) of today plus n days */
        isoDate: (days) => {
            const d = new Date(Date.now() + (days || 0) * 86400000);
            return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
        }
    };
});
