using { asset.management as db } from '../db/schema';
using { asset.management.api as api } from './types';

/**
 * Manager dashboard: employees of the manager's department / team, their assets,
 * ownership, maintenance records and requests. Every record is scoped on the server.
 */
@path    : '/odata/v4/manager'
@requires: 'Manager'
service ManagerService {

    /** team members - managers may update contact data, designation and status */
    @restrict: [{ grant: ['READ', 'UPDATE'], to: 'Manager' }]
    entity Employees          as projection on db.Employees {
        *,
        department.name   as department_name : String(100),
        manager.full_name as manager_name    : String(100)
    } excluding { asset, manager_profile, user };

    /** team assets plus available assets that may be allocated */
    @readonly
    entity Assets             as projection on db.Assets {
        *,
        category.name            as category_name : String(100),
        vendor.name              as vendor_name   : String(100),
        current_holder.full_name as holder_name   : String(100),
        virtual null             as assigned_on   : Date
    } excluding { ownerships, ownership_history, requests, maintenance_records, archive_records, manager };

    @readonly
    entity AssetOwnerships    as projection on db.AssetOwnerships {
        *,
        asset.asset_tag     as asset_tag     : String(50),
        asset.name          as asset_name    : String(100),
        asset.serial_number as serial_number : String(100),
        asset.condition     as condition     : String(20),
        owner.full_name     as owner_name    : String(100),
        owner.department.name as department_name : String(100)
    } excluding { transfers };

    @readonly
    entity AssignmentHistory  as projection on db.AssetAssignmentHistory {
        *,
        asset.asset_tag         as asset_tag        : String(50),
        asset.name              as asset_name       : String(100),
        from_employee.full_name as from_name        : String(100),
        to_employee.full_name   as to_name          : String(100),
        recorded_by.full_name   as recorded_by_name : String(100)
    } excluding { recorded_by };

    /** maintenance of team assets - create, edit and update status */
    @restrict: [{ grant: ['READ', 'CREATE', 'UPDATE'], to: 'Manager' }]
    entity MaintenanceRecords as projection on db.MaintenanceRecords {
        *,
        asset.asset_tag       as asset_tag        : String(50),
        asset.name            as asset_name       : String(100),
        service_vendor.name   as vendor_name      : String(100),
        reported_by.full_name as reported_by_name : String(100)
    } excluding { reported_by };

    @readonly
    entity AssetRequests      as projection on db.AssetRequests {
        *,
        requested_by.full_name as requester_name : String(100),
        requested_by.department.name as department_name : String(100),
        asset.asset_tag        as asset_tag      : String(50),
        asset.name             as asset_name     : String(100),
        category.name          as category_name  : String(100)
    } excluding { maintenance };

    @readonly
    entity AssetCategories    as projection on db.AssetCategories;

    @readonly
    entity Vendors            as projection on db.Vendors { vendor_id, name, email };

    @readonly
    entity Departments        as projection on db.Departments { dept_id, name, cost_center };

    /** the manager's own record - contact data can be updated */
    @restrict: [{ grant: ['READ', 'UPDATE'], to: 'Manager' }]
    entity MyProfile          as projection on db.Managers {
        manager_id,
        full_name,
        email,
        phone,
        active,
        department.name    as department_name : String(100),
        employee.designation as designation   : String(100),
        employee.location  as location        : String(100)
    };

    @readonly
    entity Notifications      as projection on db.Notifications;

    /* Ownership */
    action   assignAsset(asset_id : UUID, employee_id : UUID, start_date : Date, expected_return_date : Date, notes : String(500))          returns AssetOwnerships;
    action   transferAsset(asset_id : UUID, to_employee_id : UUID, transfer_date : Date, expected_return_date : Date, notes : String(500)) returns AssetOwnerships;
    action   returnAsset(asset_id : UUID, return_date : Date, condition : String(20), notes : String(500))                                returns AssetOwnerships;
    action   updateOwnership(ownership_id : UUID, start_date : Date, expected_return_date : Date, notes : String(500))                    returns AssetOwnerships;

    /* Requests */
    action   approveRequest(request_id : UUID, asset_id : UUID, note : String(500))                                                       returns AssetRequests;
    action   rejectRequest(request_id : UUID, note : String(500))                                                                         returns AssetRequests;
    action   resolveRequest(request_id : UUID, note : String(500))                                                                        returns AssetRequests;

    /* Maintenance */
    action   updateMaintenanceStatus(maintenance_id : UUID, status : String(30), completed_date : Date, outcome : String(255), cost : Decimal(15, 2)) returns MaintenanceRecords;

    /* Notifications */
    action   markNotificationRead(notification_id : UUID);
    action   markAllNotificationsRead();

    /* Dashboard */
    function getStats()                                                                                                                    returns api.DashboardStats;
    function getReport(report : String(50))                                                                                                returns array of api.ReportRow;
}
