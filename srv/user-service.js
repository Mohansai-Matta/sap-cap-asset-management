const cds = require('@sap/cds');
const { me } = require('./lib/context');

module.exports = class UserService extends cds.ApplicationService {
    init() {
        this.on('me', () => me());
        return super.init();
    }
};
