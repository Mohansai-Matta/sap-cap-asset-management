sap.ui.define(
    ["sap/ui/core/mvc/Controller", "sap/ui/model/json/JSONModel", "sap/m/library"],
    function (Controller, JSONModel, mobileLibrary) {
        "use strict";

        // Deployed (HTML5 Application Repository): /assetmanagement<app>/index.html
        // Local (cds watch):                       /<app>/index.html
        const DEPLOYED_PREFIX = "/assetmanagement";

        return Controller.extend("assetmanagement.launchpad.controller.Home", {

            onInit: function () {
                // the logout endpoint exists only behind the SAP application router
                this.getView().setModel(new JSONModel({ deployed: window.location.pathname.startsWith(DEPLOYED_PREFIX) }), "view");
            },

            /** Opens a dashboard; the dashboard checks the role of the user (role-based access) */
            onOpenDashboard: function (oEvent) {
                const role = oEvent.getSource().data("role");
                const bDeployed = window.location.pathname.startsWith(DEPLOYED_PREFIX);
                const sUrl = (bDeployed ? DEPLOYED_PREFIX + "dashboard" : "/dashboard") + "/index.html#/" + role + "/overview";
                mobileLibrary.URLHelper.redirect(sUrl, false);
            },

            onSignOut: function () {
                window.location.href = "/do/logout";
            }
        });
    }
);
