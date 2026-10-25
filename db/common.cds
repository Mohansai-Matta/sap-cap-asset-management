namespace asset.management.common;

/** Technical key used by all entities (stored as NVARCHAR(36) on SAP HANA). */
type Identifier : UUID;

type Email : String(100) @assert.format: '^[^\s@]+@[^\s@]+\.[^\s@]+$';
type Phone : String(20)  @assert.format: '^[+0-9 ()-]{6,20}$';

@assert.range
type EmployeeStatus : String(30) enum {
    Active;
    Inactive;
    OnLeave;
}

@assert.range
type AssetStatus : String(30) enum {
    Available;
    Assigned;
    InRepair;
    Lost;
    Retired;
    Archived;
}

@assert.range
type OwnershipAction : String(30) enum {
    Assign;
    Transfer;
    Return;
    Update;
}

@assert.range
type MaintenanceStatus : String(30) enum {
    Open;
    InProgress;
    Completed;
    Cancelled;
}

@assert.range
type UserRole : String(20) enum {
    Admin;
    Manager;
    Employee;
}

@assert.range
type AssetCondition : String(20) enum {
    New;
    Good;
    Fair;
    Poor;
    Damaged;
}

@assert.range
type RequestType : String(20) enum {
    New;
    Return;
    Issue;
}

@assert.range
type RequestStatus : String(20) enum {
    Pending;
    Approved;
    Rejected;
    InProgress;
    Resolved;
    Cancelled;
}

@assert.range
type IssueType : String(20) enum {
    Damaged;
    Lost;
    Malfunction;
}

@assert.range
type NotificationType : String(20) enum {
    Info;
    Request;
    Ownership;
    Maintenance;
    Overdue;
}
