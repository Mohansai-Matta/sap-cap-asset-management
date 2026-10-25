sap.ui.define([
    "sap/ui/core/UIComponent",
    "sap/ui/model/json/JSONModel",
    "./util/api"
], function (UIComponent, JSONModel, api) {
    "use strict";

    return UIComponent.extend("assetmanagement.dashboard.Component", {
        metadata: {
            manifest: "json",
            interfaces: ["sap.ui.core.IAsyncContentCreation"]
        },

        init: function () {
            UIComponent.prototype.init.apply(this, arguments);
            this.setModel(new JSONModel({ loaded: false }), "user");
            // the i18n bundle loads asynchronously
            this.textsReady = Promise.resolve(this.getModel("i18n").getResourceBundle()).then((bundle) => {
                this._bundle = bundle;
            });
            this.getRouter().initialize();
        },

        /**
         * Loads the logged-in user (roles, linked employee / manager) once.
         * @returns {Promise<object>} user info
         */
        loadUser: function () {
            if (!this._userPromise) {
                this._userPromise = api.get("/odata/v4/user/me()").then((user) => {
                    this.getModel("user").setData(Object.assign({ loaded: true }, user));
                    return user;
                }).catch((error) => {
                    this._userPromise = null;
                    throw error;
                });
            }
            return this._userPromise;
        },

        /** Text from the i18n bundle (after textsReady has resolved) */
        getText: function (key, args) {
            return this._bundle ? this._bundle.getText(key, args) : key;
        },

        refreshUser: function () {
            this._userPromise = null;
            return this.loadUser();
        }
    });
});
