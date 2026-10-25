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
    InStock;
    Assigned;
    InRepair;
    Retired;
    Archived;
}

@assert.range
type OwnershipAction : String(30) enum {
    Assign;
    Transfer;
    Return;
}

@assert.range
type MaintenanceStatus : String(30) enum {
    Open;
    InProgress;
    Completed;
    Cancelled;
}
