const cds = require('@sap/cds');
const { db } = require('./common');

/** Active login IDs of the users linked to the given employees */
const usersOfEmployees = async (employeeIds) => {
    const ids = employeeIds.filter(Boolean);
    if (!ids.length) return [];
    const users = await SELECT.from(db().Users).columns('user_id')
        .where({ employee_employee_id: { in: ids }, active: true });
    return users.map((u) => u.user_id);
};

const adminUsers = async () => {
    const users = await SELECT.from(db().Users).columns('user_id').where({ role_code: 'Admin', active: true });
    return users.map((u) => u.user_id);
};

/** Login IDs of the people who may decide on requests of an employee: the employee's manager and all admins */
const approversOf = async (employeeId) => {
    const { Employees, Managers } = db();
    const employee = await SELECT.one.from(Employees).columns('manager_manager_id').where({ employee_id: employeeId });
    const managerEmployeeIds = [];
    if (employee?.manager_manager_id) {
        const manager = await SELECT.one.from(Managers).columns('employee_employee_id')
            .where({ manager_id: employee.manager_manager_id, active: true });
        if (manager) managerEmployeeIds.push(manager.employee_employee_id);
    }
    return [...await usersOfEmployees(managerEmployeeIds), ...await adminUsers()];
};

/**
 * Creates one notification per recipient (login ID).
 * @param {string[]} recipients
 * @param {{title:string, message?:string, type?:string, entity?:string, id?:string}} n
 */
const notify = async (recipients, { title, message, type = 'Info', entity, id }) => {
    const unique = [...new Set(recipients.filter(Boolean))];
    if (!unique.length) return;
    await INSERT.into(db().Notifications).entries(unique.map((recipient) => ({
        notification_id: cds.utils.uuid(),
        recipient_user_id: recipient,
        title,
        message,
        type,
        related_entity: entity,
        related_id: id
    })));
};

const notifyEmployees = async (employeeIds, n) => notify(await usersOfEmployees(employeeIds), n);

const markRead = async (userId, notificationId) => {
    const { Notifications } = db();
    const where = { recipient_user_id: userId };
    if (notificationId) where.notification_id = notificationId;
    return UPDATE(Notifications).set({ is_read: true }).where(where);
};

module.exports = { notify, notifyEmployees, usersOfEmployees, adminUsers, approversOf, markRead };
