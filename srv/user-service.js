const cds = require('@sap/cds');
const { me } = require('./lib/context');
const { explain, checkSchema } = require('./lib/schema-check');

module.exports = class UserService extends cds.ApplicationService {
    init() {
        this.on('me', (req) => me().catch((error) => explain(req, error)));
        cds.once('served', checkSchema);
        return super.init();
    }
};
