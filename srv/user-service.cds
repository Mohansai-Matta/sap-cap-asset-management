using { asset.management.api as api } from './types';

/** Available to every logged-in user: who am I and which dashboards may I open */
@path    : '/odata/v4/user'
@requires: 'authenticated-user'
service UserService {
    function me() returns api.UserInfo;
}
