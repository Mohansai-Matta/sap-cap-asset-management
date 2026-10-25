sap.ui.define(
    ["sap/ui/core/mvc/Controller", "sap/ui/model/json/JSONModel", "sap/m/library"],
    function (Controller, JSONModel, mobileLibrary) {
        "use strict";

        // Deployed (HTML5 Application Repository): /assetmanagement<app>/index.html
        // Local (cds watch):                       /<app>/index.html
        const DEPLOYED_PREFIX = "/assetmanagement";

        return Controller.extend("assetmanagement.launchpad.controller.Home", {

            onInit: function () {
                const model = new JSONModel({ loaded: false });
                this.getView().setModel(model, "user");
                // show only the tiles the logged-in user may open
                fetch("/odata/v4/user/me()", { headers: { Accept: "application/json" }, credentials: "same-origin" })
                    .then(async (response) => {
                        if (response.ok) return response.json();
                        if (response.status === 401 || response.status === 403) {
                            throw new Error("You are not authorized to use Asset Management.");
                        }
                        // show the reason reported by the server
                        const body = await response.json().catch(() => null);
                        const reason = body && body.error && body.error.message;
                        throw new Error("Could not load your user (" + response.status + ")" + (reason ? ": " + reason : "."));
                    })
                    .then((user) => {
                        const message = !user.is_admin && !user.is_manager && !user.is_employee
                            ? (user.registered ? "No dashboard is available for your roles." : "Your login '" + user.user_id + "' is not registered in Asset Management. Please contact the administrator.")
                            : "";
                        model.setData(Object.assign({ loaded: true, message: message }, user));
                    })
                    .catch((error) => model.setData({ loaded: true, message: error.message }));
            },

            onOpenApp: function (oEvent) {
                const source = oEvent.getSource();
                const sApp = source.data("target");
                const sHash = source.data("hash") || "";
                const bDeployed = window.location.pathname.startsWith(DEPLOYED_PREFIX);
                const sUrl = (bDeployed ? DEPLOYED_PREFIX + sApp : "/" + sApp) + "/index.html" + sHash;
                mobileLibrary.URLHelper.redirect(sUrl, false);
            }
        });
    }
);
