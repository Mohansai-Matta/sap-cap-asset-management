sap.ui.define([
    "sap/ui/core/mvc/Controller"
], function (Controller) {
    "use strict";

    /** Opens the most powerful dashboard the user may use: Admin > Manager > Employee */
    return Controller.extend("assetmanagement.dashboard.controller.Home", {

        onInit: function () {
            this.getOwnerComponent().getRouter().getRoute("home").attachPatternMatched(this._onMatched, this);
        },

        _onMatched: async function () {
            await this.getOwnerComponent().textsReady;
            const message = this.byId("homeMessage");
            const busy = this.byId("homeBusy");
            try {
                const user = await this.getOwnerComponent().loadUser();
                const role = user.is_admin ? "admin" : user.is_manager ? "manager" : user.is_employee ? "employee" : null;
                if (role) {
                    this.getOwnerComponent().getRouter().navTo("dashboard", { role: role, section: "overview" }, true);
                    return;
                }
                message.setDescription(user.registered === false
                    ? this._text("notRegisteredText", [user.user_id])
                    : this._text("noAccessText"));
            } catch (error) {
                message.setDescription(error.message);
            }
            busy.setVisible(false);
            message.setVisible(true);
        },

        _text: function (key, args) {
            return this.getOwnerComponent().getText(key, args);
        }
    });
});
