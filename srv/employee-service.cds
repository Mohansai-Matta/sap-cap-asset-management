using { asset.management as db } from '../db/schema';
using { asset.management.api as api } from './types';

/**
 * Employee dashboard: only the logged-in employee's own records.
 * Requests, returns and issue reports are created through the actions.
 */
@path    : '/odata/v4/employee'
@requires: 'Employee'
service EmployeeService {

    @readonly
    entity MyProfile           as projection on db.Employees {
        employee_id,
        full_name,
        email,
        phone,
        location,
        designation,
        status,
        department.name   as department_name : String(100),
        manager.full_name as manager_name    : String(100),
        manager.email     as manager_email   : String(100),
        manager.phone     as manager_phone   : String(20)
    };

    @readonly
    entity MyAssets            as projection on db.Assets {
        asset_id,
        asset_tag,
        name,
        serial_number,
        model,
        condition,
        location,
        status,
        purchase_date,
        warranty_expiry,
        category.name as category_name : String(100),
        current_holder.employee_id as holder_id : UUID,
        virtual null  as assigned_on   : Date
    };

    @readonly
    entity MyOwnerships        as projection on db.AssetOwnerships {
        ownership_id,
        start_date,
        end_date,
        expected_return_date,
        is_current,
        notes,
        asset.asset_id      as asset_id      : UUID,
        asset.asset_tag     as asset_tag     : String(50),
        asset.name          as asset_name    : String(100),
        asset.serial_number as serial_number : String(100),
        owner.employee_id   as owner_id      : UUID
    };

    @readonly
    entity MyAssignmentHistory as projection on db.AssetAssignmentHistory {
        ledger_id,
        action,
        transition_date,
        notes,
        createdAt,
        asset.asset_id          as asset_id   : UUID,
        asset.asset_tag         as asset_tag  : String(50),
        asset.name              as asset_name : String(100),
        from_employee.full_name as from_name  : String(100),
        to_employee.full_name   as to_name    : String(100),
        from_employee.employee_id as from_employee_id : UUID,
        to_employee.employee_id   as to_employee_id   : UUID
    };

    @readonly
    entity MyMaintenance       as projection on db.MaintenanceRecords {
        maintenance_id,
        type,
        status,
        reported_date,
        completed_date,
        next_due_date,
        outcome,
        description,
        covered_by_warranty,
        asset.asset_id  as asset_id   : UUID,
        asset.asset_tag as asset_tag  : String(50),
        asset.name      as asset_name : String(100),
        service_vendor.name as vendor_name : String(100)
    };

    @readonly
    entity MyRequests          as projection on db.AssetRequests {
        request_id,
        type,
        issue_type,
        reason,
        needed_by,
        status,
        decided_at,
        decision_note,
        createdAt,
        asset.asset_id  as asset_id      : UUID,
        asset.asset_tag as asset_tag     : String(50),
        asset.name      as asset_name    : String(100),
        category.name   as category_name : String(100),
        requested_by.employee_id as requested_by_id : UUID
    };

    @readonly
    entity AssetCategories     as projection on db.AssetCategories { asset_category_id, name };

    @readonly
    entity Notifications       as projection on db.Notifications;

    action   requestAsset(category_id : UUID, reason : String(1000), needed_by : Date)                        returns MyRequests;
    action   requestReturn(asset_id : UUID, reason : String(1000))                                            returns MyRequests;
    action   reportIssue(asset_id : UUID, issue_type : String(20), description : String(1000))                returns MyRequests;
    action   cancelRequest(request_id : UUID)                                                                 returns MyRequests;
    action   markNotificationRead(notification_id : UUID);
    action   markAllNotificationsRead();
    function getStats()                                                                                       returns api.DashboardStats;
}
