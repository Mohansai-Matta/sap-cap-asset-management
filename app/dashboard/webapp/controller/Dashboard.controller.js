sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/ui/model/odata/v4/ODataModel",
    "sap/m/MessageBox",
    "sap/m/MessageToast",
    "sap/m/IllustratedMessage",
    "sap/m/Popover",
    "sap/m/List",
    "sap/m/NotificationListItem",
    "sap/m/Button",
    "sap/m/Bar",
    "sap/m/Title",
    "sap/m/ActionSheet",
    "sap/m/StandardListItem",
    "sap/m/BusyIndicator",
    "../util/api",
    "../util/format",
    "../config/admin",
    "../config/manager",
    "../config/employee"
], function (Controller, JSONModel, ODataModel, MessageBox, MessageToast, IllustratedMessage, Popover, List,
    NotificationListItem, Button, Bar, Title, ActionSheet, StandardListItem, BusyIndicator, api, format,
    adminConfig, managerConfig, employeeConfig) {
    "use strict";

    const CONFIGS = { admin: adminConfig, manager: managerConfig, employee: employeeConfig };
    const PERMISSION = { admin: "is_admin", manager: "is_manager", employee: "is_employee" };
    // test users of the local run (cds watch, see package.json), shown when the logged-in user lacks the role
    const TEST_USERS = {
        admin: { user: "admin@company.com", password: "admin" },
        manager: { user: "vijay.kumar@company.com", password: "vijay" },
        employee: { user: "priya.sharma@company.com", password: "priya" }
    };
    const POLL_MS = 60000;

    return Controller.extend("assetmanagement.dashboard.controller.Dashboard", {

        onInit: function () {
            this._models = {};
            this.getView().setModel(new JSONModel({
                title: "Asset Management",
                section: "overview",
                sectionTitle: "",
                sectionSubtitle: "",
                nav: [],
                switches: [],
                unread: 0,
                unreadText: "",
                initials: "",
                searchEnabled: false,
                sideExpanded: !this._isPhone()
            }), "view");
            this.getOwnerComponent().getRouter().getRoute("dashboard").attachPatternMatched(this._onMatched, this);
            this._poll = setInterval(() => this._refreshUnread(), POLL_MS);
        },

        onExit: function () {
            clearInterval(this._poll);
        },

        _isPhone: function () {
            return window.matchMedia && window.matchMedia("(max-width: 600px)").matches;
        },

        _text: function (key, args) {
            return this.getOwnerComponent().getText(key, args);
        },

        /* =========================================================
           Routing
        ========================================================= */

        _onMatched: async function (event) {
            await this.getOwnerComponent().textsReady;
            const args = event.getParameter("arguments");
            const role = args.role;
            const config = CONFIGS[role];
            const viewModel = this.getView().getModel("view");
            let user;
            try {
                user = await this.getOwnerComponent().loadUser();
            } catch (error) {
                this._showMessage("sapIllus-ErrorScreen", this._text("errorTitle"), error.message);
                return;
            }
            if (!config) {
                this.getOwnerComponent().getRouter().navTo("home", {}, true);
                return;
            }
            if (!user[PERMISSION[role]]) {
                this._role = null;
                viewModel.setProperty("/nav", []);
                this._buildSwitches(user, role);
                // who is signed in with which roles, and buttons to the dashboards this user can open
                const details = this._text("noAccessDetails", [user.user_id, user.roles ? user.roles.split(",").join(", ") : this._text("none")]);
                const router = this.getOwnerComponent().getRouter();
                const buttons = viewModel.getProperty("/switches").map((sw) => new Button({
                    text: this._text("openDashboard", [sw.text]), icon: sw.icon, type: "Emphasized",
                    press: () => router.navTo("dashboard", { role: sw.key.slice(7), section: "overview" })
                }));
                this._showMessage("sapIllus-UnableToLoad", this._text("noAccessTitle"), this._noAccessText(user, role, config) + " " + details, buttons);
                return;
            }

            if (this._role !== role) {
                this._role = role;
                this._config = config;
                viewModel.setProperty("/title", config.title);
                viewModel.setProperty("/nav", config.sections.map((s) => ({ key: s.key, text: s.text, icon: s.icon })));
                viewModel.setProperty("/initials", (user.full_name || user.user_id || "?").split(/[\s.@]+/).filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join(""));
                this._buildSwitches(user, role);
                document.title = config.title + " - Asset Management";
            }
            const section = config.sections.find((s) => s.key === args.section) || config.sections[0];
            viewModel.setProperty("/section", section.key);
            this._refreshUnread();
            this._render(section);
            if (this._isPhone()) viewModel.setProperty("/sideExpanded", false);
        },

        _buildSwitches: function (user, current) {
            const switches = [];
            if (user.is_admin && current !== "admin") switches.push({ key: "switch:admin", text: this._text("adminDashboard"), icon: "sap-icon://shield" });
            if (user.is_manager && current !== "manager") switches.push({ key: "switch:manager", text: this._text("managerDashboard"), icon: "sap-icon://manager" });
            if (user.is_employee && current !== "employee") switches.push({ key: "switch:employee", text: this._text("employeeDashboard"), icon: "sap-icon://employee" });
            this.getView().getModel("view").setProperty("/switches", switches);
        },

        /** OData V4 model of the dashboard's service (one per role) */
        _model: function () {
            const role = this._role;
            if (!this._models[role]) {
                const model = new ODataModel({
                    serviceUrl: this._config.service + "/",
                    operationMode: "Server",
                    autoExpandSelect: true,
                    earlyRequests: false,
                    groupId: "$auto"
                });
                model.setSizeLimit(1000);
                this._models[role] = model;
            }
            return this._models[role];
        },

        _context: function () {
            const component = this.getOwnerComponent();
            return {
                role: this._role,
                service: this._config.service,
                model: this._model(),
                owner: this.getView(),
                user: component.getModel("user").getData(),
                notify: () => this._refreshUnread(),
                navTo: (section) => component.getRouter().navTo("dashboard", { role: this._role, section: section }),
                refreshUser: () => component.refreshUser(),
                rerender: () => this._render(this._section),
                setActiveTable: (table) => { this._activeTable = table; this.getView().getModel("view").setProperty("/searchEnabled", !!table); }
            };
        },

        _render: async function (section) {
            this._section = section;
            const viewModel = this.getView().getModel("view");
            const content = this.byId("sectionContent");
            viewModel.setProperty("/sectionTitle", section.title || section.text);
            viewModel.setProperty("/sectionSubtitle", section.subtitle || "");
            this.byId("sectionHeader").setVisible(true);
            this._activeTable = null;
            viewModel.setProperty("/searchEnabled", false);
            this.byId("globalSearch").setValue("");
            content.destroyItems();
            const busy = new BusyIndicator({ size: "2rem" }).addStyleClass("sapUiLargeMargin");
            content.addItem(busy);
            const token = (this._renderToken = {});
            try {
                const control = await section.build(this._context());
                if (token !== this._renderToken) return; // another section was opened meanwhile
                content.destroyItems();
                (Array.isArray(control) ? control : [control]).forEach((c) => content.addItem(c));
            } catch (error) {
                if (token !== this._renderToken) return;
                content.destroyItems();
                content.addItem(new IllustratedMessage({ illustrationType: "sapIllus-UnableToLoad", title: this._text("errorTitle"), description: error.message }));
            }
        },

        /** Explains why the dashboard cannot be opened and what to do (missing role or login not linked) */
        _noAccessText: function (user, role, config) {
            const deployed = window.location.pathname.indexOf("/assetmanagement") === 0;
            const roleName = role.charAt(0).toUpperCase() + role.slice(1);
            const hasRole = (user.roles || "").split(",").indexOf(roleName) >= 0;
            if (!hasRole) {
                if (!deployed) {
                    const test = TEST_USERS[role];
                    return this._text("noRoleLocal", [user.user_id, roleName, config.title, test.user, test.password]);
                }
                return user.has_role ? this._text("noRoleDeployed", [user.user_id, "AssetManagement_" + roleName])
                    : this._text("noRoleText", [user.user_id, user.token_roles || "none"]);
            }
            if (role !== "admin" && user.registered && !user.active) return this._text("userDeactivated", [user.user_id]);
            if (role !== "admin" && !user.employee_id) return this._text("employeeNotLinked", [user.user_id]);
            if (role === "manager" && user.manager_id && !user.manager_active) return this._text("managerDeactivated", [user.user_id]);
            if (role === "manager") return this._text("managerNotLinked", [user.user_id]);
            return this._text("noDashboardAccess", [config.title]);
        },

        _showMessage: function (type, title, text, buttons) {
            const content = this.byId("sectionContent");
            this.byId("sectionHeader").setVisible(false);
            content.destroyItems();
            content.addItem(new IllustratedMessage({ illustrationType: type, title: title, description: text, additionalContent: buttons || [] }));
        },

        /* =========================================================
           Shell events
        ========================================================= */

        onToggleSide: function () {
            const viewModel = this.getView().getModel("view");
            viewModel.setProperty("/sideExpanded", !viewModel.getProperty("/sideExpanded"));
        },

        /** Back to the home page (welcome page with the three dashboards) */
        onGoHome: function () {
            const deployed = window.location.pathname.indexOf("/assetmanagement") === 0;
            window.location.href = deployed ? "/assetmanagementlaunchpad/index.html" : "/launchpad/index.html";
        },

        onNavSelect: function (event) {
            const key = event.getParameter("item").getKey();
            const router = this.getOwnerComponent().getRouter();
            if (key.startsWith("switch:")) {
                router.navTo("dashboard", { role: key.slice(7), section: "overview" });
                return;
            }
            router.navTo("dashboard", { role: this._role, section: key });
        },

        onGlobalSearch: function (event) {
            if (this._activeTable) this._activeTable.search(event.getParameter("query"));
        },

        /* =========================================================
           Notifications
        ========================================================= */

        _refreshUnread: async function () {
            if (!this._config) return;
            try {
                const response = await fetch(this._config.service + "/Notifications/$count?$filter=is_read%20eq%20false", { credentials: "same-origin" });
                if (!response.ok) return;
                const unread = parseInt(await response.text(), 10) || 0;
                const viewModel = this.getView().getModel("view");
                viewModel.setProperty("/unread", unread);
                viewModel.setProperty("/unreadText", unread > 99 ? "99+" : String(unread));
            } catch (e) {
                // ignore polling errors
            }
        },

        onOpenNotifications: async function (event) {
            const source = event.getSource();
            if (!this._config) return;
            const list = new List({ noDataText: this._text("noNotifications"), growing: false });
            const popover = new Popover({
                title: this._text("notifications"),
                placement: "Bottom",
                contentWidth: "26rem",
                contentHeight: "28rem",
                content: [list],
                footer: new Bar({
                    contentLeft: [new Button({ text: this._text("markAllRead"), press: async () => {
                        await api.post(this._config.service + "/markAllNotificationsRead", {});
                        await this._refreshUnread();
                        popover.close();
                        MessageToast.show(this._text("allMarkedRead"));
                    } })],
                    contentRight: [new Button({ text: this._text("viewAll"), type: "Emphasized", press: () => {
                        popover.close();
                        this.getOwnerComponent().getRouter().navTo("dashboard", { role: this._role, section: "notifications" });
                    } })]
                }),
                afterClose: () => popover.destroy()
            });
            this.getView().addDependent(popover);
            popover.openBy(source);
            popover.setBusy(true);
            try {
                const rows = await api.get(this._config.service + "/Notifications?$orderby=createdAt%20desc&$top=10");
                rows.forEach((n) => list.addItem(new NotificationListItem({
                    title: n.title,
                    description: n.message,
                    datetime: format.dateTime(n.createdAt),
                    unread: !n.is_read,
                    priority: n.type === "Overdue" ? "High" : n.type === "Request" ? "Medium" : "None",
                    showCloseButton: false,
                    press: async () => {
                        if (!n.is_read) {
                            await api.post(this._config.service + "/markNotificationRead", { notification_id: n.notification_id });
                            this._refreshUnread();
                        }
                    }
                })));
            } catch (error) {
                list.setNoDataText(error.message);
            }
            popover.setBusy(false);
        },

        /* =========================================================
           Profile menu
        ========================================================= */

        onOpenProfileMenu: function (event) {
            const user = this.getOwnerComponent().getModel("user").getData();
            // the logout endpoint exists only behind the SAP application router
            const deployed = window.location.pathname.indexOf("/assetmanagement") === 0;
            const buttons = [
                new Button({ text: user.full_name + (user.role ? " (" + user.role + ")" : ""), icon: "sap-icon://person-placeholder", enabled: false })
            ];
            if (this._config && this._config.sections.some((s) => s.key === "profile")) {
                buttons.push(new Button({ text: this._text("myProfile"), icon: "sap-icon://customer", press: () => this.getOwnerComponent().getRouter().navTo("dashboard", { role: this._role, section: "profile" }) }));
            }
            this.getView().getModel("view").getProperty("/switches").forEach((s) => {
                buttons.push(new Button({ text: s.text, icon: s.icon, press: () => this.getOwnerComponent().getRouter().navTo("dashboard", { role: s.key.slice(7), section: "overview" }) }));
            });
            if (deployed) {
                buttons.push(new Button({ text: this._text("signOut"), icon: "sap-icon://log", press: () => { window.location.href = "/do/logout"; } }));
            }
            const sheet = new ActionSheet({ placement: "Bottom", buttons: buttons, afterClose: () => sheet.destroy() });
            this.getView().addDependent(sheet);
            sheet.openBy(event.getSource());
        }
    });
});
