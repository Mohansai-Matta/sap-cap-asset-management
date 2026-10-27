#!/usr/bin/env node
/*
 * Local run with the real SAP BTP login (XSUAA) instead of the test-user popup:
 *   npm run watch:btp
 *
 * Starts two processes:
 *   - port 4004: cds watch --profile xsuaa-local  (accepts XSUAA tokens only)
 *   - port 5000: local application router         (SAP login, forwards apps and OData to port 4004)
 * Open port 5000. Your roles come from the role collections assigned in the BTP cockpit.
 *
 * First run: installs @sap/approuter in .deploy/app-router and binds the deployed
 * XSUAA instance (cds bind; requires "cf login" and one "cf deploy" of this version).
 */
const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const routerDir = path.join(root, '.deploy', 'app-router');
const PROFILE = 'xsuaa-local';
const XSUAA_INSTANCE = 'asset-management-auth';

const run = (cmd, args) => spawnSync(cmd, args, { cwd: root, stdio: 'inherit', shell: process.platform === 'win32' }).status === 0;

const isBound = () => {
    try {
        const conf = JSON.parse(fs.readFileSync(path.join(root, '.cdsrc-private.json'), 'utf8'));
        return !!conf.requires?.[`[${PROFILE}]`]?.auth?.binding;
    } catch (e) {
        return false;
    }
};

// 1. application router dependencies
if (!fs.existsSync(path.join(routerDir, 'node_modules', '@sap', 'approuter'))) {
    console.log('> Installing the application router (once)...');
    if (!run('npm', ['install', '--prefix', routerDir, '--no-audit', '--no-fund'])) process.exit(1);
}

// 2. binding to the deployed XSUAA instance (skipped if VCAP_SERVICES is provided)
const useEnv = !!process.env.VCAP_SERVICES;
if (!useEnv && !isBound()) {
    console.log(`> Binding to the XSUAA instance "${XSUAA_INSTANCE}" (once)...`);
    if (!run('npx', ['cds', 'bind', '-2', XSUAA_INSTANCE, '--for', PROFILE])) {
        console.error(`\nBinding failed. Log in with "cf login" (org/space of the deployed app) and deploy the app once, then try again.`);
        process.exit(1);
    }
}

// 3. start CAP (port 4004) and the application router (port 5000), each in its own process group
const options = { cwd: root, stdio: 'inherit', detached: process.platform !== 'win32', shell: process.platform === 'win32' };
const children = [
    spawn('npx', ['cds', 'watch', '--profile', PROFILE], options),
    useEnv
        ? spawn('node', [path.join(routerDir, 'local.js')], options)
        : spawn('npx', ['cds', 'bind', '--exec', '--profile', PROFILE, '--', 'node', path.join(routerDir, 'local.js')], options)
];

setTimeout(() => console.log('\n> Open port 5000 (in SAP Business Application Studio: "Open in New Tab" for port 5000) - not port 4004.\n'), 8000);

// stops both process trees (npx does not forward signals to its children)
let stopping = false;
const stop = () => {
    if (stopping) return;
    stopping = true;
    for (const child of children) {
        try {
            if (options.detached) process.kill(-child.pid, 'SIGTERM');
            else child.kill('SIGTERM');
        } catch (e) { /* already stopped */ }
    }
    setTimeout(() => process.exit(0), 1000);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
for (const child of children) child.on('exit', (code) => { if (code) stop(); });
