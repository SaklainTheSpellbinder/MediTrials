const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api';

const USERS = {
    PI: { user_id: 1, role: 'Principal_Investigator', site_id: 1 },
    Coordinator: { user_id: 2, role: 'Study_Coordinator', site_id: 1 },
    Safety: { user_id: 3, role: 'Safety_Monitor' },
    DataManager: { user_id: 4, role: 'Data_Manager' },
    Statistician: { user_id: 5, role: 'Statistician' },
    Admin: { user_id: 6, role: 'System_Admin' }
};

const getHeaders = (user) => ({
    'X-User-Data': Buffer.from(JSON.stringify(user)).toString('base64')
});

async function testEndpoint(name, url, user) {
    try {
        const res = await axios.get(url, { headers: getHeaders(user), validateStatus: () => true });
        console.log(`[${res.status === 200 ? 'SUCCESS\t' : 'FAILED ' + res.status}] ${name.padEnd(45)} ${url}`);
    } catch (err) {
        console.log(`[ERROR] ${name.padEnd(45)} ${url} -> ${err.message}`);
    }
}

async function runTests() {
    console.log('\n=== TESTING PI ROUTES ===');
    await testEndpoint('Dashboard Stats', `${BASE_URL}/dashboard/stats?site_id=1`, USERS.PI);
    await testEndpoint('Patient List', `${BASE_URL}/patients?site_id=1`, USERS.PI);

    console.log('\n=== TESTING COORDINATOR ROUTES ===');
    await testEndpoint('Coord Stats', `${BASE_URL}/coordinator/stats?site_id=1`, USERS.Coordinator);
    await testEndpoint('Coord Visits Today', `${BASE_URL}/coordinator/visits/today?site_id=1`, USERS.Coordinator);
    await testEndpoint('Coord Pending Labs', `${BASE_URL}/coordinator/labs/pending?site_id=1`, USERS.Coordinator);

    console.log('\n=== TESTING SAFETY MONITOR ROUTES ===');
    await testEndpoint('Safety Dashboard', `${BASE_URL}/dashboard/safety-monitor`, USERS.Safety);
    await testEndpoint('Safety Alerts', `${BASE_URL}/safety/alerts`, USERS.Safety);
    await testEndpoint('Safety AEs', `${BASE_URL}/safety/ae`, USERS.Safety);
    await testEndpoint('Safety SAEs', `${BASE_URL}/safety/sae`, USERS.Safety);
    await testEndpoint('Safety Signals', `${BASE_URL}/safety/signals?trial_id=1`, USERS.Safety);
    await testEndpoint('Safety Reports', `${BASE_URL}/safety/reports/generate?trial_id=1`, USERS.Safety);

    console.log('\n=== TESTING DATA MANAGER ROUTES ===');
    await testEndpoint('DM Dashboard', `${BASE_URL}/dashboard/data-manager`, USERS.DataManager);
    await testEndpoint('DM Queries', `${BASE_URL}/data-management/queries`, USERS.DataManager);
    await testEndpoint('DM Completeness', `${BASE_URL}/data-management/completeness?trial_id=1`, USERS.DataManager);
    await testEndpoint('DM Locks', `${BASE_URL}/data-management/locks`, USERS.DataManager);
    await testEndpoint('DM Export SDTM', `${BASE_URL}/data-management/export/sdtm?trial_id=1`, USERS.DataManager);

    console.log('\n=== TESTING STATISTICIAN ROUTES ===');
    await testEndpoint('Stat Dashboard', `${BASE_URL}/dashboard/statistician`, USERS.Statistician);
    await testEndpoint('Stat Datasets', `${BASE_URL}/statistics/datasets`, USERS.Statistician);
    await testEndpoint('Stat Survival', `${BASE_URL}/statistics/survival?trial_id=1`, USERS.Statistician);
    await testEndpoint('Stat Balance', `${BASE_URL}/statistics/balance?trial_id=1`, USERS.Statistician);
    await testEndpoint('Stat AE Incidence', `${BASE_URL}/statistics/ae-incidence?trial_id=1`, USERS.Statistician);
    await testEndpoint('Stat Export SDTM', `${BASE_URL}/export/sdtm?trial_id=1`, USERS.Statistician);

    console.log('\n=== TESTING ADMIN ROUTES ===');
    await testEndpoint('Admin Dashboard', `${BASE_URL}/dashboard/admin`, USERS.Admin);
    await testEndpoint('Admin Trials', `${BASE_URL}/admin/trials`, USERS.Admin);
    await testEndpoint('Admin Sites', `${BASE_URL}/admin/sites`, USERS.Admin);
    await testEndpoint('Admin Users', `${BASE_URL}/admin/users`, USERS.Admin);
    await testEndpoint('Admin Locks', `${BASE_URL}/admin/locks`, USERS.Admin);
    await testEndpoint('Admin Audit', `${BASE_URL}/admin/audit`, USERS.Admin);  // Wait, is this mapped correctly? It was /api/audit -> adminRoutes
    await testEndpoint('Root Audit', `${BASE_URL}/audit`, USERS.Admin);
    await testEndpoint('Admin Settings', `${BASE_URL}/admin/settings`, USERS.Admin);
}

runTests();
