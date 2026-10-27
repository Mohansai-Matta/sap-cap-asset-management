const cds = require('@sap/cds');
const { db } = require('./common');

/** Writes one audit log entry; user and timestamp are filled in automatically */
const audit = (action, entity, key, details) => INSERT.into(db().AuditLogs).entries({
    log_id: cds.utils.uuid(),
    action,
    entity,
    entity_key: key === undefined || key === null ? null : String(key),
    details: details ? String(details).slice(0, 2000) : null
});

const SKIP = new Set(['Notifications', 'AuditLogs', 'DraftAdministrativeData']);

/**
 * Registers generic audit logging for all CREATE / UPDATE / DELETE requests of a service.
 */
const registerAudit = (srv) => {
    srv.after(['CREATE', 'UPDATE', 'DELETE'], async (result, req) => {
        const entityName = req.target?.name?.split('.').pop();
        if (!entityName || SKIP.has(entityName) || entityName.endsWith('drafts')) return;
        const keyNames = Object.keys(req.target.keys || {}).filter((k) => k !== 'IsActiveEntity');
        const source = (req.event === 'DELETE' || Array.isArray(result) ? req.data : result) || req.data || {};
        const key = keyNames.map((k) => source[k] ?? req.data?.[k]).filter((v) => v !== undefined).join(',');
        const changed = Object.keys(req.data || {}).filter((k) => !keyNames.includes(k) && k !== 'IsActiveEntity');
        await audit(req.event, entityName, key, changed.length ? `Fields: ${changed.join(', ')}` : undefined);
    });
};

module.exports = { audit, registerAudit };
