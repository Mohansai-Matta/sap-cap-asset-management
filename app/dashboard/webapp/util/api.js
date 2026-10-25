sap.ui.define([], function () {
    "use strict";

    /**
     * Small JSON client for the CAP OData V4 services (actions, functions and writes).
     * Handles the CSRF token required by the SAP application router.
     */
    let csrfToken = null;

    const fetchToken = async function () {
        const response = await fetch("/odata/v4/user/", {
            method: "HEAD",
            headers: { "X-CSRF-Token": "Fetch" },
            credentials: "same-origin"
        });
        csrfToken = response.headers.get("X-CSRF-Token") || "unsafe";
        return csrfToken;
    };

    const errorMessage = async function (response) {
        let text = response.statusText || ("HTTP " + response.status);
        try {
            const body = await response.json();
            const error = body.error || {};
            if (error.details && error.details.length) {
                text = error.details.map((d) => (d.target ? d.target + ": " : "") + d.message).join("\n");
            } else if (error.message) {
                text = (error.target && error.target !== "in" ? error.target + ": " : "") + error.message;
            }
        } catch (e) {
            // not a JSON response
        }
        const err = new Error(text);
        err.status = response.status;
        return err;
    };

    const request = async function (method, url, body, retried) {
        const headers = { Accept: "application/json" };
        if (method !== "GET") {
            headers["Content-Type"] = "application/json";
            headers["X-CSRF-Token"] = csrfToken || await fetchToken();
        }
        const response = await fetch(url, {
            method: method,
            headers: headers,
            credentials: "same-origin",
            body: body === undefined ? undefined : JSON.stringify(body)
        });
        if (response.status === 403 && !retried && (response.headers.get("X-CSRF-Token") || "").toLowerCase() === "required") {
            csrfToken = null;
            return request(method, url, body, true);
        }
        if (!response.ok) throw await errorMessage(response);
        if (response.status === 204) return null;
        const data = await response.json().catch(() => null);
        if (data && Object.prototype.hasOwnProperty.call(data, "value") && Object.keys(data).every((k) => k === "value" || k.startsWith("@"))) {
            return data.value;
        }
        if (data) delete data["@odata.context"];
        return data;
    };

    // removes empty strings so that optional fields are not sent as ''
    const clean = function (data) {
        const result = {};
        Object.keys(data || {}).forEach((key) => {
            const value = data[key];
            result[key] = value === "" ? null : value;
        });
        return result;
    };

    // OData key literal: UUIDs / numbers unquoted, strings quoted
    const keyLiteral = function (value, type) {
        if (type === "string") return "'" + String(value).replace(/'/g, "''") + "'";
        return String(value);
    };

    return {
        get: (url) => request("GET", url),
        post: (url, body) => request("POST", url, clean(body || {})),
        patch: (url, body) => request("PATCH", url, clean(body || {})),
        del: (url) => request("DELETE", url),
        keyLiteral: keyLiteral,
        /** Calls an unbound function, e.g. fn("/odata/v4/admin", "getReport", { report: "x" }) */
        fn: function (service, name, params) {
            const args = Object.keys(params || {}).map((k) => k + "=" + (typeof params[k] === "string" ? "'" + encodeURIComponent(params[k]) + "'" : params[k]));
            return request("GET", service + "/" + name + "(" + args.join(",") + ")");
        }
    };
});
