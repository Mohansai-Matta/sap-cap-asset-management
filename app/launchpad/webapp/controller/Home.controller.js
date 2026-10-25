sap.ui.define(
    ["sap/ui/core/mvc/Controller", "sap/m/library"],
    function (Controller, mobileLibrary) {
        "use strict";

        // Deployed (HTML5 Application Repository): /assetmanagement<app>/index.html
        // Local (cds watch):                       /<app>/index.html
        const DEPLOYED_PREFIX = "/assetmanagement";

        return Controller.extend("assetmanagement.launchpad.controller.Home", {
            onOpenApp: function (oEvent) {
                const sApp = oEvent.getSource().data("target");
                const bDeployed = window.location.pathname.startsWith(DEPLOYED_PREFIX);
                const sUrl = (bDeployed ? DEPLOYED_PREFIX + sApp : "/" + sApp) + "/index.html";
                mobileLibrary.URLHelper.redirect(sUrl, false);
            }
        });
    }
);
