const cds = require('@sap/cds');

const LOG = cds.log('asset-management');

// SQLite: "no such table"; SAP HANA: "invalid table name: Could not find table/view ..."
const isMissingTable = (error) => /no such table|invalid table name|could not find table/i.test(error?.message || '');

const OUTDATED = 'The database has not been updated for this version of Asset Management (tables are missing). ' +
    'Deploy the database: run "mbt build" and "cf deploy", or in SAP Business Application Studio "cds deploy --to hana" ' +
    'for the bound HDI container - then reload the page.';

/** Rejects with a clear message if a query failed because the database schema is outdated */
const explain = (req, error) => {
    if (isMissingTable(error)) {
        LOG.error(OUTDATED, '-', error.message.split('\n')[0]);
        return req.reject(503, OUTDATED);
    }
    throw error;
};

/** Logs a clear error at startup if the HDI container does not contain the current tables */
const checkSchema = async () => {
    try {
        const { Users, AssetRequests, AuditLogs } = cds.entities('asset.management');
        for (const entity of [Users, AssetRequests, AuditLogs]) await SELECT.one.from(entity).columns('1 as x');
    } catch (error) {
        if (isMissingTable(error)) LOG.error(OUTDATED);
        else LOG.error('Database check failed:', error.message);
    }
};

module.exports = { explain, checkSchema, isMissingTable, OUTDATED };
