const cds = require('@sap/cds');

const LOG = cds.log('asset-management');

/*
 * Roles: a user gets the dashboards of the BTP role collections (AssetManagement_Admin / _Manager / _Employee)
 * and, in addition, of the role an administrator sets in Admin Dashboard > Settings & Permissions > Users.
 * So assigning the role in the app is enough; no role collection per user is needed.
 */
const APP_ROLES = { Admin: ['Admin'], Manager: ['Manager', 'Employee'], Employee: ['Employee'] };

cds.middlewares.add((req, res, next) => {
    const user = cds.context?.user;
    if (!user?.id || user._is_anonymous || user._is_privileged) return next();
    cds.db.tx({ tenant: cds.context.tenant, user: cds.User.privileged }, (tx) => tx.run(
        SELECT.one.from('asset.management.Users').columns('role_code')
            .where('lower(user_id) =', String(user.id).toLowerCase(), 'and active =', true)
    )).then((row) => {
        const missing = (APP_ROLES[row?.role_code] || []).filter((role) => !user.is(role));
        if (missing.length) {
            // a copy, so that cached user objects are not changed
            const withAppRoles = Object.create(user);
            withAppRoles.roles = { ...user.roles, ...Object.fromEntries(missing.map((role) => [role, 1])) };
            cds.context.user = withAppRoles;
            if (req.user) req.user = withAppRoles;
        }
    }).catch((error) => {
        LOG.warn(`Could not read the role of ${user.id} in Settings & Permissions > Users:`, error.message);
    }).finally(() => next());
}, { after: 'auth' });

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
