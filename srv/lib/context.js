const cds = require('@sap/cds');
const { db } = require('./common');
const { audit } = require('./audit');

const cache = new WeakMap();

/**
 * Makes the employee an active manager: creates the manager record from the employee data,
 * or activates an existing one if activate is set. Returns the manager record.
 */
const ensureManager = async (employeeId, { activate = true } = {}) => {
    const { Employees, Managers } = db();
    const existing = await SELECT.one.from(Managers).where({ employee_employee_id: employeeId });
    if (existing) {
        if (activate && !existing.active) await UPDATE(Managers).set({ active: true }).where({ manager_id: existing.manager_id });
        return activate ? { ...existing, active: true } : existing;
    }
    const employee = await SELECT.one.from(Employees).where({ employee_id: employeeId });
    if (!employee) return null;
    const manager = {
        manager_id: cds.utils.uuid(),
        full_name: employee.full_name,
        email: employee.email,
        phone: employee.phone,
        active: true,
        employee_employee_id: employee.employee_id,
        department_dept_id: employee.department_dept_id
    };
    await INSERT.into(Managers).entries(manager);
    await audit('CREATE', 'Managers', manager.manager_id, `Manager record created for ${employee.full_name} (Manager role)`);
    return manager;
};

/**
 * Resolves the logged-in user to the application records:
 * Users entry, linked employee and (if any) manager record.
 * - A login without Users entry is linked to the employee with the same e-mail address
 *   if the login has an Asset Management role (BTP role collection).
 * - A login with the Manager role whose employee has no manager record gets one.
 */
const getContext = async () => {
    const key = cds.context;
    if (key && cache.has(key)) return cache.get(key);
    const { Users, Employees, Managers } = db();
    const login = cds.context.user;
    const userId = login.id;
    // logins are compared case-insensitively (identity providers may send Name@Company.com)
    let user = await SELECT.one.from(Users).where('lower(user_id) =', String(userId).toLowerCase());
    if (!user && (login.is('Manager') || login.is('Employee'))) {
        const match = await SELECT.one.from(Employees).columns('employee_id', 'full_name', 'email')
            .where('lower(email) =', String(userId).toLowerCase());
        if (match) {
            user = { user_id: userId, full_name: match.full_name, email: match.email, active: true,
                role_code: login.is('Manager') ? 'Manager' : 'Employee', employee_employee_id: match.employee_id };
            await INSERT.into(Users).entries(user);
            await audit('CREATE', 'Users', userId, `Login linked to the employee ${match.full_name} (same e-mail address)`);
        }
    }
    const employeeId = user?.active ? user.employee_employee_id : null;
    const employee = employeeId ? await SELECT.one.from(Employees).where({ employee_id: employeeId }) : null;
    let manager = employeeId ? await SELECT.one.from(Managers).where({ employee_employee_id: employeeId }) : null;
    // a deactivated manager stays deactivated; only a missing manager record is created
    if (employee && !manager && login.is('Manager')) manager = await ensureManager(employee.employee_id, { activate: false });
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
 * Managers see and maintain all employee, asset, ownership and maintenance records and may
 * allocate any available asset to any employee. Asset requests are the exception:
 * reportIds = employees whose assigned manager is this manager; only their requests
 * (new assets, returns, issue reports) are sent to and decided by this manager.
 */
const managerScope = async (manager) => {
    const key = cds.context;
    const cached = key && cache.get(key)?.scope;
    if (cached) return cached;
    const { Employees } = db();
    const reportIds = (await SELECT.from(Employees).columns('employee_id').where({ manager_manager_id: manager.manager_id }))
        .map((e) => e.employee_id);
    const scope = { reportIds };
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

module.exports = { getContext, requireEmployee, requireManager, managerScope, me, ensureManager };
