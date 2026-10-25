using { CatalogService as srv } from './cat-service';

/*
 * Authorization (roles are defined in xs-security.json)
 * - AssetViewer: read-only access to all entities
 * - AssetAdmin : full access, incl. create / update / delete and all actions
 */

annotate srv.DepartmentSrv with @restrict: [
    { grant: 'READ', to: ['AssetViewer', 'AssetAdmin'] },
    { grant: '*',    to: 'AssetAdmin' }
];

annotate srv.EmployeeSrv with @restrict: [
    { grant: 'READ', to: ['AssetViewer', 'AssetAdmin'] },
    { grant: '*',    to: 'AssetAdmin' }
];

annotate srv.ManagerSrv with @restrict: [
    { grant: 'READ', to: ['AssetViewer', 'AssetAdmin'] },
    { grant: '*',    to: 'AssetAdmin' }
];

annotate srv.AssetSrv with @restrict: [
    { grant: 'READ', to: ['AssetViewer', 'AssetAdmin'] },
    { grant: '*',    to: 'AssetAdmin' }
];

annotate srv.AssetCategorySrv with @restrict: [
    { grant: 'READ', to: ['AssetViewer', 'AssetAdmin'] },
    { grant: '*',    to: 'AssetAdmin' }
];

annotate srv.VendorSrv with @restrict: [
    { grant: 'READ', to: ['AssetViewer', 'AssetAdmin'] },
    { grant: '*',    to: 'AssetAdmin' }
];

annotate srv.OwnershipLedgerSrv with @restrict: [
    { grant: 'READ', to: ['AssetViewer', 'AssetAdmin'] },
    { grant: '*',    to: 'AssetAdmin' }
];

annotate srv.MaintenanceRecordSrv with @restrict: [
    { grant: 'READ', to: ['AssetViewer', 'AssetAdmin'] },
    { grant: '*',    to: 'AssetAdmin' }
];

annotate srv.ArchiveRecordSrv with @restrict: [
    { grant: 'READ', to: ['AssetViewer', 'AssetAdmin'] },
    { grant: '*',    to: 'AssetAdmin' }
];

annotate srv.CreateDepartment with @requires: 'AssetAdmin';
annotate srv.UpdateDepartment with @requires: 'AssetAdmin';
annotate srv.DeleteDepartment with @requires: 'AssetAdmin';
annotate srv.CreateEmployee with @requires: 'AssetAdmin';
annotate srv.UpdateEmployee with @requires: 'AssetAdmin';
annotate srv.DeleteEmployee with @requires: 'AssetAdmin';
annotate srv.CreateManager with @requires: 'AssetAdmin';
annotate srv.UpdateManager with @requires: 'AssetAdmin';
annotate srv.DeleteManager with @requires: 'AssetAdmin';
annotate srv.CreateVendor with @requires: 'AssetAdmin';
annotate srv.UpdateVendor with @requires: 'AssetAdmin';
annotate srv.DeleteVendor with @requires: 'AssetAdmin';
annotate srv.CreateAsset with @requires: 'AssetAdmin';
annotate srv.UpdateAsset with @requires: 'AssetAdmin';
annotate srv.DeleteAsset with @requires: 'AssetAdmin';
annotate srv.CreateAssetCategory with @requires: 'AssetAdmin';
annotate srv.UpdateAssetCategory with @requires: 'AssetAdmin';
annotate srv.DeleteAssetCategory with @requires: 'AssetAdmin';
annotate srv.CreateOwnershipLedger with @requires: 'AssetAdmin';
annotate srv.UpdateOwnershipLedger with @requires: 'AssetAdmin';
annotate srv.DeleteOwnershipLedger with @requires: 'AssetAdmin';
