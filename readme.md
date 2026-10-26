# Asset Management (SAP CAP · SAP HANA Cloud · SAP Fiori / SAPUI5)

An asset management application with three role-based dashboards (**Admin**, **Manager**, **Employee**) built on the SAP stack only:

| Layer | Technology |
|-------|------------|
| Database | **SAP HANA Cloud** (HDI container, `@cap-js/hana`); in-memory SQLite only for local `cds watch` |
| Backend | **SAP Cloud Application Programming Model (CAP)**, Node.js, OData V4 |
| UI | **SAPUI5** dashboards (sap.tnt ToolPage, sap.m, sap.f cards, sap.viz charts, sap.ui.export) and **SAP Fiori elements V4** master data apps |
| Security | **SAP Authorization and Trust Management (XSUAA)**: role-based access checked on the server |
| Runtime | **SAP BTP, Cloud Foundry**: standalone application router and HTML5 Application Repository |

## Dashboards

| Dashboard | Who | Modules |
|-----------|-----|---------|
| **Admin** | role collection `AssetManagement_Admin` | Overview (KPIs and charts), Manager Management (create, edit, activate/deactivate, team and assets), Employee Management (incl. login creation), Asset Management, Asset Ownership (assign, transfer, return, edit, history), Maintenance, Asset Requests (approve, reject, resolve), Reports & Analytics (charts and Excel export), Audit Log, Notifications, Settings & Permissions (departments, categories, vendors, users, roles) |
| **Manager** | role collection `AssetManagement_Manager` | Overview, Employee Records (view and update), Employee Asset Details, Asset Ownership, Asset Allocation, Maintenance Records, Requests & Approvals, Reports, Notifications, Manager Profile |
| **Employee** | role collection `AssetManagement_Employee` (also included for managers) | Overview, My Profile, My Assets, My Asset Ownership, Request an Asset, Return Asset, Report Asset Issues, Maintenance Information, My Requests, Notifications |

Every dashboard has a sidebar, a header with module search, a notifications popover and a profile menu (switch dashboards, sign out). Tables support search, filters, sorting, paging ("More"), Excel export, status badges, confirmation dialogs and validated forms. All changes are stored in SAP HANA and show up on every dashboard that displays them.

### Server-side authorization

- Each dashboard uses its own OData service: `/odata/v4/admin`, `/odata/v4/manager` and `/odata/v4/employee`. Each service requires the matching XSUAA role.
- **Managers** only see and change records of their team: employees of their department and employees who report to them, those employees' assets, and the assets they manage. Every action (assign, transfer, return, maintenance, approvals) is checked against this scope. A manager cannot decide on their own requests.
- **Employees** only see their own profile, assets, ownership, maintenance and requests. They cannot change ownership records directly; they raise requests instead.
- Every change is written to the **audit log**, and the people involved get **notifications** (new request, decision, assignment, transfer, maintenance, overdue return).

## Data model (`db/schema.cds`)

`Users`, `Roles`, `Managers`, `Employees`, `Departments`, `Assets`, `AssetCategories`, `Vendors`, `AssetOwnerships` (current owner, start/end date, expected return), `AssetAssignmentHistory` (every assign / transfer / return / ownership change), `MaintenanceRecords`, `AssetRequests` (new asset, return, issue report), `Notifications`, `AuditLogs`, `ArchiveRecords`.

A `Users` entry links a login (the user ID from the identity provider, usually the e-mail address) to an employee record and a role. Access rights come from the XSUAA role collections.

## Project structure

| Folder / file | Purpose |
|---------------|---------|
| `db/` | Domain model and sample data (`db/data/*.csv`) |
| `srv/admin-service.*`, `srv/manager-service.*`, `srv/employee-service.*`, `srv/user-service.*` | Services of the dashboards |
| `srv/lib/` | Shared business logic: ownership, requests, maintenance, notifications, audit log, reports, user context and scoping |
| `srv/cat-service.*`, `srv/labels.cds` | Service and labels of the SAP Fiori elements apps (admins only) |
| `app/dashboard` | SAPUI5 app with the Admin, Manager and Employee dashboards (`#/admin`, `#/manager`, `#/employee`) |
| `app/launchpad` | Entry page with tiles for the dashboards the user may open |
| `app/assets`, `app/employee`, `app/manager`, `app/department` | SAP Fiori elements master data apps |
| `.deploy/app-router` | Standalone SAP application router |
| `xs-security.json` | Scopes, role templates and role collections `AssetManagement_Admin`, `AssetManagement_Manager` and `AssetManagement_Employee` |
| `mta.yaml` | Multi-target application descriptor for `mbt build` / `cf deploy` |

## Deploy from SAP Business Application Studio

Prerequisites in your SAP BTP subaccount (Cloud Foundry enabled):

- A running **SAP HANA Cloud** instance mapped to your CF space (entitlement *SAP HANA Schemas & HDI Containers*, plan `hdi-shared`)
- Entitlements for **Authorization and Trust Management Service** (`application`) and **HTML5 Application Repository Service** (`app-host`, `app-runtime`)

```bash
cf login -a https://api.cf.<region>.hana.ondemand.com
mbt build
cf deploy mta_archives/asset-management_1.0.0.mtar
```

Alternatively, right-click `mta.yaml` → **Build MTA Project**, then right-click the `.mtar` → **Deploy MTA Archive**.

After deployment:

1. **Assign role collections** in the BTP cockpit (Security → Role Collections): `AssetManagement_Admin`, `AssetManagement_Manager` or `AssetManagement_Employee`.
2. **Register users.** The sample data contains `admin@company.com`, `vijay.kumar@company.com` and others. Log in with an Admin user and, in *Admin Dashboard → Settings & Permissions → Users*, create one entry per login: user ID = the e-mail address you log in with, plus role and employee record. Admins don't need a `Users` entry, only the role collection. Managers and employees need one so that their dashboard knows which employee record belongs to them.
3. Open the URL of the `asset-management` app (the approuter). The entry page shows the dashboards you may open. Direct URLs:
   - `/assetmanagementdashboard/index.html#/admin/overview`
   - `/assetmanagementdashboard/index.html#/manager/overview`
   - `/assetmanagementdashboard/index.html#/employee/overview`

To remove everything: `cf undeploy asset-management --delete-services --delete-service-keys`

> The CSV files in `db/data` are sample data, and the HDI deployer resets those rows on every deployment. Remove the files (or the rows) before productive use.

## Local development

| Command | Database | Login |
|---------|----------|-------|
| `cds watch` (or `npm run watch`) | in-memory SQLite, filled from `db/data` at every start | mocked users (below) |
| `cds watch --profile hybrid` (or `npm run watch:hybrid`) | your SAP HANA Cloud HDI container | mocked users (below) |
| deployed app (`mbt build` + `cf deploy`) | SAP HANA Cloud HDI container | XSUAA |

Quick start in SAP Business Application Studio:

```bash
npm ci
cds watch
```

To work against SAP HANA instead, bind the HDI container once after the first deployment, deploy the current tables and start in the hybrid profile:

```bash
cds bind -2 asset-management-db
npm run deploy:db          # cds deploy --to hana
npm run watch:hybrid       # cds watch --profile hybrid
```

Open <http://localhost:4004/launchpad/index.html> or <http://localhost:4004/dashboard/index.html>. Mocked users (user / password):

| User | Password | Roles |
|------|----------|-------|
| `admin@company.com` | `admin` | Admin |
| `vijay.kumar@company.com` | `vijay` | Manager + Employee (IT) |
| `rahul.kumar@company.com` | `rahul` | Manager + Employee (HR) |
| `priya.sharma@company.com` | `priya` | Employee |
| `arjun.reddy@company.com` | `arjun` | Employee |
| `meera.iyer@company.com` | `meera` | Employee |

`srv/req.http` contains example requests for all services.

### Local run with the real SAP BTP login (no popup)

Plain `cds watch` on port 4004 asks for a test user in a browser popup. That's CAP's local test login. The SAP login page (with your role collections from the BTP cockpit) is always provided by the application router, so locally you run the application router in front of CAP:

```bash
npm run watch:btp
```

Then open **port 5000**, not 4004. In SAP Business Application Studio, click *Open in New Tab* for port 5000. Because you're already logged in to SAP BTP, XSUAA signs you in without a popup, and the dashboards follow the role collections assigned to you in the BTP cockpit.

| Port | What runs there |
|------|-----------------|
| 5000 | application router: SAP login, forwards apps and OData to port 4004 |
| 4004 | `cds watch --profile xsuaa-local`: accepts XSUAA logins only (opening it directly gives 401) |

Prerequisites: deploy this version once (`mbt build` and `cf deploy`), so that XSUAA allows the redirect URIs `https://*.applicationstudio.cloud.sap/**` and `http://localhost:5000/**`, and log in with `cf login`. On the first run, `npm run watch:btp` installs the application router and binds the XSUAA instance (`cds bind`). The database stays the in-memory SQLite database with the sample data. Stop with Ctrl+C.

## Troubleshooting

**"Could not load your user (503/500)" / "The database has not been updated for this version"**: the service runs against an HDI container that doesn't contain the current tables yet (for example `Users` or `AssetRequests`). This happens when you pull a new version but don't deploy the database:

- Deployed app: run `mbt build` and `cf deploy mta_archives/asset-management_1.0.0.mtar` again, and check that the step *asset-management-db-deployer* finishes without errors. If it doesn't, look at `cf logs asset-management-db-deployer --recent`.
- Local hybrid run in SAP Business Application Studio: `cds deploy --to hana` (uses the bound HDI container), then `npm run watch`.

For any other error, the service log shows the details: `cf logs asset-management-srv --recent`.

**`cf deploy` fails in `asset-management-db-deployer`**: run `cf logs asset-management-db-deployer --recent` and look for lines with `error`.
- *"... is not part of the content / undeploy"*: an artifact from an earlier version must be removed. Add it to `db/undeploy.json`.
- *"unique constraint violated"* in a `.hdbtabledata` file: a sample-data row in `db/data` has the same key as a record created manually. Delete that record or remove the row from the CSV file.
