# Asset Management (SAP CAP · SAP HANA Cloud · SAP Fiori / SAPUI5)

An asset management application built on the SAP stack only:

| Layer | Technology |
|-------|------------|
| Database | **SAP HANA Cloud** (HDI container, `@cap-js/hana`) |
| Backend | **SAP Cloud Application Programming Model (CAP)**, Node.js, OData V4 |
| UI | **SAP Fiori elements V4** apps (List Report / Object Page) on **SAPUI5**, plus a SAPUI5 entry page |
| Security | **SAP Authorization and Trust Management (XSUAA)** |
| Runtime | **SAP BTP, Cloud Foundry**: standalone application router and HTML5 Application Repository |

## Project structure

| Folder / file | Purpose |
|---------------|---------|
| `db/schema.cds`, `db/common.cds` | Domain model (Departments, Employees, Managers, Vendors, Asset Categories, Assets, Ownership Ledger, Maintenance and Archive records) |
| `db/data/` | Sample data (CSV), deployed to SAP HANA by the HDI deployer |
| `srv/cat-service.cds` / `.js` | `CatalogService` (OData V4 at `/odata/v4/catalog`): projections and Create/Update/Delete actions with validation |
| `srv/auth.cds` | Authorization (`AssetViewer` = read, `AssetAdmin` = full access) |
| `srv/labels.cds`, `_i18n/` | Field labels and value helps shared by all Fiori apps |
| `app/assets`, `app/employee`, `app/manager`, `app/department` | SAP Fiori elements apps (draft-enabled create/edit) |
| `app/launchpad` | SAPUI5 entry page with tiles for all apps (the approuter's welcome page) |
| `.deploy/app-router` | Standalone SAP application router |
| `xs-security.json` | XSUAA scopes, role templates and role collections |
| `mta.yaml` | Multi-target application descriptor for `mbt build` / `cf deploy` |

## Deploy from SAP Business Application Studio

Prerequisites in your SAP BTP subaccount (Cloud Foundry enabled):

- An **SAP HANA Cloud** instance that is running and mapped to your CF space (entitlement *SAP HANA Schemas & HDI Containers*, plan `hdi-shared`)
- Entitlements for **Authorization and Trust Management Service** (`application`) and **HTML5 Application Repository Service** (`app-host`, `app-runtime`)

Steps (in a BAS terminal at the project root):

```bash
# 1. log in to Cloud Foundry (or use "CF: Login to Cloud Foundry" in BAS)
cf login -a https://api.cf.<region>.hana.ondemand.com

# 2. build the MTA archive
mbt build

# 3. deploy
cf deploy mta_archives/asset-management_1.0.0.mtar
```

Alternatively, right-click `mta.yaml` and choose **Build MTA Project**, then right-click the generated `.mtar` and choose **Deploy MTA Archive**.

After deployment:

1. In the BTP cockpit, go to **Security → Role Collections** and assign `AssetManagement_Admin` (full access) or `AssetManagement_Viewer` (read-only) to your user.
2. Open the URL of the `asset-management` application (the approuter), e.g. from `cf apps`. You land on the entry page with tiles for all apps. Each app is also reachable directly:
   - `/assetmanagementassets/index.html`
   - `/assetmanagementemployee/index.html`
   - `/assetmanagementmanager/index.html`
   - `/assetmanagementdepartment/index.html`

To remove everything: `cf undeploy asset-management --delete-services --delete-service-keys`

> The CSV files in `db/data` are sample data. The HDI deployer resets those rows on every deployment. Remove the files (or the CSV rows) before productive use.

## Local development (against SAP HANA Cloud)

The project uses SAP HANA in all profiles, with no SQLite. After the first deployment, bind the local project to the HDI container and run in the `hybrid` profile:

```bash
npm ci
cds bind -2 asset-management-db     # binds to the HDI container created by cf deploy
npm run watch                       # = cds watch --profile hybrid
```

Then open <http://localhost:4004>. Locally the mocked users are `admin` / `admin` (AssetAdmin) and `viewer` / `viewer` (AssetViewer).
The test requests in `srv/req.http` exercise all actions.

To deploy schema changes to the HDI container from BAS without a full MTA deployment: `cds deploy --to hana:asset-management-db`.

## Roles

| Role collection | Role template | Access |
|-----------------|---------------|--------|
| `AssetManagement_Admin` | `AssetAdmin` | Read, create, edit, delete, all actions |
| `AssetManagement_Viewer` | `AssetViewer` | Read-only |
