const cds = require('@sap/cds');
const { db } = require('./common');

const cache = new WeakMap();

/**
 * Resolves the logged-in user to the application records:
 * Users entry, linked employee and (if any) manager record.
 */
const getContext = async () => {
    const key = cds.context;
    if (key && cache.has(key)) return cache.get(key);
    const { Users, Employees, Managers } = db();
    const userId = cds.context.user.id;
    // logins are compared case-insensitively (identity providers may send Name@Company.com)
    const user = await SELECT.one.from(Users).where('lower(user_id) =', String(userId).toLowerCase());
    const employeeId = user?.active ? user.employee_employee_id : null;
    const employee = employeeId ? await SELECT.one.from(Employees).where({ employee_id: employeeId }) : null;
    const manager = employeeId ? await SELECT.one.from(Managers).where({ employee_employee_id: employeeId }) : null;
    const ctx = { userId, user, employee, manager };
    if (key) cache.set(key, ctx);
    return ctx;
};

/** Ensures the login is linked to an active employee record */
const requireEmployee = async (req) => {
    const ctx = await getContext();
    if (!ctx.user) req.reject(403, `Your login '${ctx.userId}' is not registered in Asset Management. Please contact the administrator.`);
    if (!ctx.user.active) req.reject(403, 'Your user account is deactivated. Please contact the administrator.');
    if (!ctx.employee) req.reject(403, 'Your login is not linked to an employee record. Please contact the administrator.');
    return ctx;
};

/** Ensures the login is linked to an active manager record */
const requireManager = async (req) => {
    const ctx = await requireEmployee(req);
    if (!ctx.manager) req.reject(403, 'Your login is not linked to a manager record. Please contact the administrator.');
    if (!ctx.manager.active) req.reject(403, 'Your manager account is deactivated. Please contact the administrator.');
    return ctx;
};

/**
 * Records a manager may work with:
 * - employees: members of the manager's department and employees reporting to the manager
 * - teamAssets: assets managed by the manager or held by a team member
 * - assignableAssets: available assets managed by the manager or not managed by anyone
 */
const managerScope = async (manager) => {
    const key = cds.context;
    const cached = key && cache.get(key)?.scope;
    if (cached) return cached;
    const { Employees, Assets } = db();
    const employeeQuery = SELECT.from(Employees).columns('employee_id');
    if (manager.department_dept_id) {
        employeeQuery.where('department_dept_id =', manager.department_dept_id, 'or manager_manager_id =', manager.manager_id);
    } else {
        employeeQuery.where({ manager_manager_id: manager.manager_id });
    }
    const employeeIds = (await employeeQuery).map((e) => e.employee_id);
    // employees whose assigned manager is this manager - their asset requests are sent to this manager
    const reportIds = (await SELECT.from(Employees).columns('employee_id').where({ manager_manager_id: manager.manager_id }))
        .map((e) => e.employee_id);

    const managed = await SELECT.from(Assets).columns('asset_id').where({ manager_manager_id: manager.manager_id });
    const held = employeeIds.length
        ? await SELECT.from(Assets).columns('asset_id').where({ current_holder_employee_id: { in: employeeIds } })
        : [];
    const teamAssetIds = [...new Set([...managed, ...held].map((a) => a.asset_id))];

    const assignable = await SELECT.from(Assets).columns('asset_id')
        .where('status =', 'Available', 'and (manager_manager_id =', manager.manager_id, 'or manager_manager_id is null)');
    const assignableAssetIds = assignable.map((a) => a.asset_id);

    const scope = {
        employeeIds,
        reportIds,
        teamAssetIds,
        assignableAssetIds,
        assetIds: [...new Set([...teamAssetIds, ...assignableAssetIds])]
    };
    if (key && cache.has(key)) cache.get(key).scope = scope;
    return scope;
};

/** Information about the logged-in user for the UI */
const me = async () => {
    const ctx = await getContext();
    const user = cds.context.user;
    const { Departments, Notifications } = db();
    const department = ctx.employee?.department_dept_id
        ? await SELECT.one.from(Departments).columns('name').where({ dept_id: ctx.employee.department_dept_id })
        : null;
    const unread = await SELECT.one.from(Notifications).columns('count(1) as n')
        .where({ recipient_user_id: ctx.userId, is_read: false });
    return {
        user_id: ctx.userId,
        full_name: ctx.user?.full_name || ctx.employee?.full_name || ctx.userId,
        email: ctx.user?.email || ctx.employee?.email,
        role: ctx.user?.role_code,
        registered: !!ctx.user,
        has_role: ['Admin', 'Manager', 'Employee'].some((r) => user.is(r)),
        roles: ['Admin', 'Manager', 'Employee'].filter((r) => user.is(r)).join(','),
        // all roles (scopes) contained in the login token - helps to find wrongly configured role collections
        token_roles: Object.keys(user.roles || {})
            .filter((r) => !['openid', 'uaa.user', 'authenticated-user', 'identified-user', 'any'].includes(r))
            .join(', '),
        active: !!ctx.user?.active,
        is_admin: user.is('Admin'),
        is_manager: user.is('Manager') && !!ctx.manager?.active,
        is_employee: user.is('Employee') && !!ctx.employee,
        employee_id: ctx.employee?.employee_id,
        manager_id: ctx.manager?.manager_id,
        designation: ctx.employee?.designation,
        department_name: department?.name,
        unread_notifications: Number(unread?.n ?? 0)
    };
};

module.exports = { getContext, requireEmployee, requireManager, managerScope, me };
