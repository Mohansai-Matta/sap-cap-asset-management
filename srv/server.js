const cds = require('@sap/cds');

/*
 * SAP HANA cannot lock views that contain joins ("no target table or view available for FOR UPDATE clause").
 * CAP checks @assert.target references with "SELECT ... FOR SHARE LOCK" on the service entity, and many
 * service entities are such views (e.g. AdminService.Employees with the department and manager names).
 * For those views the existence check runs without the lock; the check itself stays in place.
 */
cds.on('served', () => {
    cds.db?.before('READ', (req) => {
        const select = req.query?.SELECT;
        if (select?.forShareLock && (req.target?.query || req.target?.projection)) delete select.forShareLock;
    });
});

module.exports = cds.server;
