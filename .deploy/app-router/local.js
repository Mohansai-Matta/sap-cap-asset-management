// Starts the application router locally to test real XSUAA logins against "cds watch --profile xsuaa-local".
// Not used on Cloud Foundry (there "npm start" uses xs-app.json and the HTML5 Application Repository).
// The XSUAA credentials come from "cds bind --exec" (see npm run approuter:local in the project root).

// everything (UI apps and OData) is served by cds watch on port 4004
process.env.destinations = process.env.destinations || JSON.stringify([
    { name: 'srv-api', url: 'http://localhost:4004', forwardAuthToken: true }
]);

require('@sap/approuter')().start({
    port: process.env.PORT || 5000,
    workingDir: __dirname,
    xsappConfig: require('./xs-app.local.json')
});
