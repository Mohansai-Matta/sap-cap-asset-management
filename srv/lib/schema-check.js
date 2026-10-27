const cds = require('@sap/cds');

const LOG = cds.log('asset-management');

// SQLite: "no such table"; SAP HANA: "invalid table name: Could not find table/view ..."
const isMissingTable = (error) => /no such table|invalid table name|could not find table/i.test(error?.message || '');

const HOW_TO_FIX = 'Deploy the database: in SAP Business Application Studio run "cds deploy --to hana" (or "npm run watch", which does it), ' +
    'for the deployed app run "mbt build" and "cf deploy" and check that the module asset-management-db-deployer finishes without errors ' +
    '("cf logs asset-management-db-deployer --recent").';

const OUTDATED = 'The database has not been updated for this version of Asset Management (tables are missing). ' + HOW_TO_FIX;

/** Names of the application tables that do not exist in the connected database */
const missingTables = async () => {
    const missing = [];
    for (const [name, entity] of Object.entries(cds.entities('asset.management'))) {
        if (entity.query || entity['@cds.persistence.skip']) continue;
        try {
            await SELECT.one.from(entity).columns('1 as x');
        } catch (error) {
            if (isMissingTable(error)) missing.push(name);
            else throw error;
        }
    }
    return missing;
};

/** Rejects with a clear message if a query failed because the database schema is outdated */
const explain = async (req, error) => {
    if (!isMissingTable(error)) throw error;
    let missing = [];
    try { missing = await missingTables(); } catch (e) { /* keep the generic message */ }
    const text = 'The database has not been updated for this version of Asset Management' +
        (missing.length ? ` - missing tables: ${missing.join(', ')}. ` : '. ') + HOW_TO_FIX;
    LOG.error(text, '| database error:', error.message.split('\n')[0]);
    return req.reject(503, text);
};

/** Logs a clear error at startup if the HDI container does not contain the current tables */
const checkSchema = async () => {
    try {
        const missing = await missingTables();
        if (missing.length) LOG.error(`Missing tables: ${missing.join(', ')}. ${HOW_TO_FIX}`);
        else LOG.info('database schema is up to date');
    } catch (error) {
        LOG.error('Database check failed:', error.message);
    }
};

module.exports = { explain, checkSchema, isMissingTable, OUTDATED };
