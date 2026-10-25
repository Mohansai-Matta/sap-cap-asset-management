namespace asset.management.api;

/** Key figures shown on the dashboards */
type DashboardStats {
    totalAssets         : Integer;
    assignedAssets      : Integer;
    availableAssets     : Integer;
    inRepairAssets      : Integer;
    totalEmployees      : Integer;
    totalManagers       : Integer;
    activeManagers      : Integer;
    totalUsers          : Integer;
    pendingRequests     : Integer;
    approvedRequests    : Integer;
    rejectedRequests    : Integer;
    openIssues          : Integer;
    maintenanceRecords  : Integer;
    openMaintenance     : Integer;
    upcomingMaintenance : Integer;
    maintenanceCost     : Decimal(15, 2);
    overdueReturns      : Integer;
    upcomingReturns     : Integer;
    unreadNotifications : Integer;
}

/** One row of a report / chart */
type ReportRow {
    label  : String(255);
    count  : Integer;
    amount : Decimal(15, 2);
}

/** The logged-in user */
type UserInfo {
    user_id              : String(255);
    full_name            : String(100);
    email                : String(100);
    role                 : String(20);
    registered           : Boolean;
    active               : Boolean;
    is_admin             : Boolean;
    is_manager           : Boolean;
    is_employee          : Boolean;
    employee_id          : UUID;
    manager_id           : UUID;
    designation          : String(100);
    department_name      : String(100);
    unread_notifications : Integer;
}
