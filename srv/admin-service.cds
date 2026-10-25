using { asset.management as db } from '../db/schema';
using { asset.management.api as api } from './types';

/**
 * Admin dashboard: full access to all modules and records.
 */
@path    : '/odata/v4/admin'
@requires: 'Admin'
service AdminService {

    entity Departments        as projection on db.Departments
        excluding { employees, manager };

    entity Employees          as projection on db.Employees {
        *,
        department.name   as department_name : String(100),
        manager.full_name as manager_name    : String(100),
        user.user_id      as login_id        : String(255)
    } excluding { asset, manager_profile, user };

    entity Managers           as projection on db.Managers {
        *,
        department.name    as department_name : String(100),
        employee.full_name as employee_name   : String(100)
    } excluding { managed_assets, vendors, ownership_logs, maintenance_logs, archive_records, team };

    entity Assets             as projection on db.Assets {
        *,
        category.name            as category_name : String(100),
        vendor.name              as vendor_name   : String(100),
        manager.full_name        as manager_name  : String(100),
        current_holder.full_name as holder_name   : String(100)
    } excluding { ownerships, ownership_history, requests, maintenance_records, archive_records };

    entity AssetCategories    as projection on db.AssetCategories;

    entity Vendors            as projection on db.Vendors {
        *,
        manager.full_name as manager_name : String(100)
    } excluding { asset };

    /** changed via assignAsset / transferAsset / returnAsset / updateOwnership only */
    @readonly
    entity AssetOwnerships    as projection on db.AssetOwnerships {
        *,
        asset.asset_tag  as asset_tag   : String(50),
        asset.name       as asset_name  : String(100),
        asset.serial_number as serial_number : String(100),
        asset.condition  as condition   : String(20),
        owner.full_name  as owner_name  : String(100),
        owner.department.name as department_name : String(100)
    } excluding { transfers };

    @readonly
    entity AssignmentHistory  as projection on db.AssetAssignmentHistory {
        *,
        asset.asset_tag          as asset_tag         : String(50),
        asset.name               as asset_name        : String(100),
        from_employee.full_name  as from_name         : String(100),
        to_employee.full_name    as to_name           : String(100),
        recorded_by.full_name    as recorded_by_name  : String(100)
    };

    entity MaintenanceRecords as projection on db.MaintenanceRecords {
        *,
        asset.asset_tag      as asset_tag         : String(50),
        asset.name           as asset_name        : String(100),
        service_vendor.name  as vendor_name       : String(100),
        reported_by.full_name as reported_by_name : String(100)
    };

    /** decided via approveRequest / rejectRequest / resolveRequest */
    @readonly
    entity AssetRequests      as projection on db.AssetRequests {
        *,
        requested_by.full_name       as requester_name  : String(100),
        requested_by.department.name as department_name : String(100),
        asset.asset_tag              as asset_tag       : String(50),
        asset.name                   as asset_name      : String(100),
        category.name                as category_name   : String(100)
    };

    entity Users              as projection on db.Users {
        *,
        employee.full_name as employee_name : String(100),
        role.name          as role_name     : String(50)
    };

    entity Roles              as projection on db.Roles;

    @readonly
    entity ArchiveRecords     as projection on db.ArchiveRecords;

    /** only the admin's own notifications */
    @readonly
    entity Notifications      as projection on db.Notifications;

    @readonly
    entity AuditLogs          as projection on db.AuditLogs;

    /* Ownership */
    action   assignAsset(asset_id : UUID, employee_id : UUID, start_date : Date, expected_return_date : Date, notes : String(500))               returns AssetOwnerships;
    action   transferAsset(asset_id : UUID, to_employee_id : UUID, transfer_date : Date, expected_return_date : Date, notes : String(500))      returns AssetOwnerships;
    action   returnAsset(asset_id : UUID, return_date : Date, condition : String(20), notes : String(500))                                     returns AssetOwnerships;
    action   updateOwnership(ownership_id : UUID, start_date : Date, expected_return_date : Date, notes : String(500))                         returns AssetOwnerships;

    /* Requests */
    action   approveRequest(request_id : UUID, asset_id : UUID, note : String(500))                                                            returns AssetRequests;
    action   rejectRequest(request_id : UUID, note : String(500))                                                                              returns AssetRequests;
    action   resolveRequest(request_id : UUID, note : String(500))                                                                             returns AssetRequests;

    /* Maintenance */
    action   updateMaintenanceStatus(maintenance_id : UUID, status : String(30), completed_date : Date, outcome : String(255), cost : Decimal(15, 2)) returns MaintenanceRecords;

    /* Accounts */
    action   setManagerActive(manager_id : UUID, active : Boolean)                                                                             returns Managers;
    action   setUserActive(user_id : String(255), active : Boolean)                                                                            returns Users;

    /* Notifications */
    action   markNotificationRead(notification_id : UUID);
    action   markAllNotificationsRead();

    /* Dashboard */
    function getStats()                                                                                                                         returns api.DashboardStats;
    function getReport(report : String(50))                                                                                                     returns array of api.ReportRow;
}

// name, e-mail and phone of a new manager are copied from the selected employee (see admin-service.js)
annotate AdminService.Managers with {
    full_name @mandatory: false;
    email     @mandatory: false;
};
