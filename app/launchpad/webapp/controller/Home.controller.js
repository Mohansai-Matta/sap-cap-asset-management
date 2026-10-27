sap.ui.define(
    ["sap/ui/core/mvc/Controller", "sap/ui/model/json/JSONModel", "sap/m/library", "sap/m/MessageBox"],
    function (Controller, JSONModel, mobileLibrary, MessageBox) {
        "use strict";

        // Deployed (HTML5 Application Repository): /assetmanagement<app>/index.html
        // Local (cds watch):                       /<app>/index.html
        const DEPLOYED_PREFIX = "/assetmanagement";

        return Controller.extend("assetmanagement.launchpad.controller.Home", {

            onInit: function () {
                const model = new JSONModel({ loaded: false });
                this.getView().setModel(model, "user");
                // the logout endpoint exists only behind the SAP application router
                this.getView().setModel(new JSONModel({ deployed: window.location.pathname.startsWith(DEPLOYED_PREFIX) }), "view");
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
                        let message = "";
                        if (!user.has_role) {
                            message = "Your user '" + user.user_id + "' has no Asset Management role. Ask your SAP BTP administrator to assign the role collection " +
                                "AssetManagement_Admin, AssetManagement_Manager or AssetManagement_Employee in the BTP cockpit (Security > Users), then sign out and log in again. " +
                                "Roles in your current login: " + (user.token_roles || "none") + ".";
                        } else if (!user.is_admin && !user.is_manager && !user.is_employee) {
                            message = user.registered
                                ? "Your user is not linked to an employee / manager record. Please ask the administrator to link it in Admin Dashboard > Settings & Permissions > Users."
                                : "Your login '" + user.user_id + "' (roles: " + user.roles + ") is not registered in Asset Management yet. " +
                                    "Please ask the administrator to create your user in Admin Dashboard > Settings & Permissions > Users.";
                        }
                        model.setData(Object.assign({ loaded: true, message: message }, user));
                    })
                    .catch((error) => model.setData({ loaded: true, message: error.message }));
            },

            /** Opens a dashboard, or explains which role collection is missing */
            onOpenDashboard: async function (oEvent) {
                const role = oEvent.getSource().data("role");
                const user = this.getView().getModel("user").getData();
                if (user["is_" + role]) {
                    this._open("dashboard", "#/" + role + "/overview");
                    return;
                }
                // the i18n bundle is loaded asynchronously
                const bundle = await Promise.resolve(this.getOwnerComponent().getModel("i18n").getResourceBundle());
                const roleCollection = "AssetManagement_" + role.charAt(0).toUpperCase() + role.slice(1);
                MessageBox.information(bundle.getText(role === "admin" ? "noAccessAdmin" : "noAccessLinked", [roleCollection]));
            },

            onSignOut: function () {
                window.location.href = "/do/logout";
            },

            onOpenApp: function (oEvent) {
                this._open(oEvent.getSource().data("target"), "");
            },

            _open: function (sApp, sHash) {
                const bDeployed = window.location.pathname.startsWith(DEPLOYED_PREFIX);
                const sUrl = (bDeployed ? DEPLOYED_PREFIX + sApp : "/" + sApp) + "/index.html" + sHash;
                mobileLibrary.URLHelper.redirect(sUrl, false);
            }
        });
    }
);
