sap.ui.define(
    ["sap/ui/core/UIComponent"],
    function (UIComponent) {
        "use strict";

        return UIComponent.extend("assetmanagement.launchpad.Component", {
            metadata: {
                manifest: "json",
                interfaces: ["sap.ui.core.IAsyncContentCreation"]
            }
        });
    }
);
