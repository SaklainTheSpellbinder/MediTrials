import axios from 'axios';

const API = axios.create({
  baseURL: 'http://localhost:5000/api',
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true, // Include httpOnly cookies in requests
  timeout: 10000,
});
//localhost:5000/api/patients

API.interceptors.request.use(
  (config) => {
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

API.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error.response?.data || error.message);
    return Promise.reject(error);
  }
);

// Patient API functions
export const patientAPI = {
  //get all patients of users site id
  getAll: async () => {
    // Backend automatically filters by authenticated user's site_id from JWT
    const response = await API.get(`/patients`);
    return response.data;
  },

  // Get single patient
  getById: async (id: number) => {
    const response = await API.get(`/patients/${id}`);
    return response.data;
  },

  // Create new patient - backend auto-includes user's site_id from JWT
  create: async (patientData: any) => {
    const response = await API.post('/patients', patientData);
    return response.data;
  },

  // Update patient
  update: async (id: number, patientData: any) => {
    const response = await API.put(`/patients/${id}`, patientData);
    return response.data;
  },

  // Delete patient
  delete: async (id: number) => {
    const response = await API.delete(`/patients/${id}`);
    return response.data;
  },

  // Record informed consent (coordinator action)
  recordConsent: async (patientId: number, payload: any) => {
    const response = await API.post(`/patients/${patientId}/record-consent`, payload);
    return response.data;
  },
};

export const patientProfileAPI = {
  //this calls from patientProfileRoutes
  getHeader: async (patientId: number) => {
    const response = await API.get(`/patients/${patientId}/profile`);
    return response.data;
  },
  getTimeline: async (patientId: number) => {
    const response = await API.get(`/patients/${patientId}/timeline`);
    return response.data;
  },
  getClinical: async (patientId: number) => {
    const response = await API.get(`/patients/${patientId}/clinical`);
    return response.data;
  },
  getSafety: async (patientId: number) => {
    const response = await API.get(`/patients/${patientId}/safety`);
    return response.data;
  },
  getLabs: async (patientId: number) => {
    const response = await API.get(`/patients/${patientId}/labs`);
    return response.data;
  },
  getDocuments: async (patientId: number) => {
    const response = await API.get(`/patients/${patientId}/documents`);
    return response.data;
  },
};

export const screeningAPI = {
  // Fetch eligibility criteria for a site's trial
  getCriteria: async (siteId: number) => {
    const response = await API.get(`/screening/criteria?site_id=${siteId}`);
    return response.data;
  },

  // Fetch available consent/protocol versions for a site's trial
  getProtocolVersions: async (siteId: number) => {
    const response = await API.get(`/screening/protocol-versions?site_id=${siteId}`);
    return response.data;
  },

  // Submit the complete screening + consent record (or draft)
  submit: async (payload: any) => {
    const response = await API.post('/screening/submit', payload);
    return response.data;
  },

  // Get a draft screening
  getDraft: async (patientId: number) => {
    const response = await API.get(`/screening/${patientId}`);
    return response.data;
  },

  // Submit consent for a drafted patient
  submitConsent: async (patientId: number, payload: any) => {
    const response = await API.post(`/screening/${patientId}/consent`, payload);
    return response.data;
  },

  getPendingPiReview: async (siteId: number) => {
    const response = await API.get(`/screening/pending-pi-review?site_id=${siteId}`);
    return response.data;
  },

  saveChecklistDraft: async (patientId: number, payload: any) => {
    const response = await API.put(`/screening/checklist/${patientId}`, payload); //this one is in screeningRoutes
    return response.data;
  },
  //called from screening.tsx
  submitForPiReview: async (patientId: number, payload: any) => {
    const response = await API.post(`/screening/submit-for-review/${patientId}`, payload);
    return response.data;
  },

  piEnroll: async (patientId: number, payload: any) => {
    const response = await API.post(`/screening/pi-enroll/${patientId}`, payload);
    return response.data;
  },
};

export const visitAPI = {
  getAll: async () => {
    const response = await API.get('/visits');
    return response.data;
  },

  getByPatientId: async (patientId: number) => {
    const response = await API.get(`/patients/${patientId}/visits`);
    return response.data;
  },
};

// Lab API functions
export const labAPI = {
  getAll: async () => {
    const response = await API.get('/labs'); //this is in labroutes.ts
    return response.data;
  },

  getSiteLabs: async (siteId: number) => {
    const response = await API.get(`/labs?site_id=${siteId}`); //labroutes.ts
    return response.data;
  },

  review: async (resultId: number) => {
    const response = await API.post(`/labs/${resultId}/review`); //this is in labroutes.ts
    return response.data;
  },

  getByPatientId: async (patientId: number) => {
    const response = await API.get(`/patients/${patientId}/labs`);
    return response.data;
  },
};

export const ecrfAPI = {
  submit: async (data: any) => {
    const response = await API.post('/ecrf/submit', data);
    return response.data;
  }
};


export const safetyAPI = {
  
  getPiDashboard: async () => {
    const response = await API.get('/pi-safety/dashboard'); //calls from piSafetyRoutes
    return response.data;
  },

  acknowledgeAlert: async (alertId: number, reason: string) => {
    const response = await API.put(`/pi-safety/alerts/${alertId}/acknowledge`, { reason }); 
    return response.data; //from piSafetyRoutes
  },
};


export const coordinatorAPI = {
    getStats: async () => {
      //called from coordinatorDashboard
        const res = await API.get('/coordinator/stats');
        return res.data;
    },
    //called from coordinatorDashboard
    getTodaysVisits: async () => {
        const res = await API.get('/coordinator/visits/today');
        return res.data;
    }
};

//this is actually safetyMonitor
export const safetyManagerAPI ={

  getSites: async () => { //called from safetyManager/AllPatients, safetyManager/safetyAlerts.tsx
    const response = await API.get('/safety/sites'); //this route is in safetyManagerRoutes
    return response.data;
  },

  getPatients: async (params: any) => { //called from safetyManager/AllPatients
    const response = await API.get('/safety/patients', { params }); //this route is in safetyManagerRoutes
    return response.data;
  },

  
  getTrials: async () => {
    const response = await API.get('/safety/trials'); //called from safetyMontior/ adverseEvents.tsx, DSMBMeetings.tsx
    return response.data;
  },

  getAes: async (params: any) => {
    const response = await API.get('/safety/ae', { params }); //called from safetyMontior/ adverseEvents.tsx
    return response.data;
  },

  getAeById: async (id: number) => {
    const response = await API.get(`/safety/ae/${id}`); //called from safetyMontior/ adverseEvents.tsx
    return response.data;
  },

  updateAe: async (id: number, data: any) => {
    const response = await API.put(`/safety/ae/${id}`, data); //called from safetyMontior/ adverseEvents.tsx
    return response.data;
  },

  //called from safetyMonitor/SAEManagement.tsx
  getSaes: async (params?: Record<string, any>) => {
      const res = await API.get('/safety/sae', { params }); // params = { sae_status, etc. }
      return res.data;
  },
    //called from SAEManagement.tsx
  getSaeById: async (id: number) => {
      const res = await API.get(`/safety/sae/${id}`);
      return res.data;
  },
  //called from SAEManagement.tsx
  updateSae: async (id: number, data: any) => {
      const res = await API.put(`/safety/sae/${id}`, data);
      return res.data;
  },

  //called from AdverseEvents.tsx, SAEManagerment.tsx
  verifyPassword: async (password: string) => {
    const response = await API.post('/safety/verify-password', { password });
    return response.data;
  },

  getDsmbMeetings: async () => { //called from safetyMonitor/DSMBMeetings.tsx
      const res = await API.get('/safety/dsmb');
      return res.data;
  },
  getDsmbMeetingById: async (id: number) => {
      const res = await API.get(`/safety/dsmb/${id}`); //called from safetyMonitor/DSMBMeetings.tsx
      return res.data;
  },
  scheduleDsmbMeeting: async (data: any) => {
      const res = await API.post('/safety/dsmb', data); //called from safetyMonitor/DSMBMeetings.tsx
      return res.data;
  },
  updateDsmbMeeting: async (id: number, data: any) => {
      const res = await API.put(`/safety/dsmb/${id}`, data); //called from safetyMonitor/DSMBMeetings.tsx
      return res.data;
  },


  //called from safetyMonitor/SafetyAlerts.tsx
  getAlerts: async (params?: Record<string, any>) => {
        const res = await API.get('/safety/alerts', { params }); // params = { severity, status, site_id, etc. }
        return res.data;
    },
    //called from safetyMonitor/SafetyAlerts.tsx
    acknowledgeAlert: async (id: number, data: any) => {
        const res = await API.put(`/safety/alerts/${id}/acknowledge`, data);
        return res.data;
    },
    //called from safetyMonitor/SafetyAlerts.tsx
    escalateAlert: async (id: number, data: any) => {
        const res = await API.put(`/safety/alerts/${id}/escalate`, data);
        return res.data;
    },
    //called from safetyMonitor/SafetyAlerts.tsx
    dismissAlert: async (id: number, data: any) => {
        const res = await API.put(`/safety/alerts/${id}/dismiss`, data);
        return res.data;
    },


    // called from SafetyMonitorDashboard.tsx — fetches full dashboard payload
    getSafetyMonitorDashboard: async () => {
        const res = await API.get('/safety/safety-monitor');
        return res.data;
    },

    // called from SafetySignals.tsx — runs PRR signal detection for a trial
    getSignals: async (params?: Record<string, any>) => {
        const res = await API.get('/safety/signals', { params }); // params = { trial_id }
        return res.data;
    },

    // called from SafetySignals.tsx (DrilldownPanel) — gets individual AE cases for a signal
    getSignalDrilldown: async (params?: Record<string, any>) => {
        const res = await API.get('/safety/signals/drilldown', { params }); // params = { ae_term, trial_id }
        return res.data;
    },

    // called from SafetyReports.tsx — generates a full safety report via sp_generate_safety_report
    generateReport: async (params?: Record<string, any>) => {
        const res = await API.get('/safety/reports/generate', { params }); // params = { trial_id, cutoff_date }
        return res.data;
    },

    // called from Unblinding.tsx — looks up a patient for emergency unblinding
    getUnblindingPatient: async (searchTerm: string) => {
        const res = await API.get(`/safety/unblinding/${searchTerm}`); // safetyMonitorRoutes
        return res.data;
    },

    // called from Unblinding.tsx — submits the emergency unblinding action (irreversible, fully audited)
    submitUnblinding: async (data: any) => {
        const res = await API.post('/safety/unblind', data); // safetyMonitorRoutes
        return res.data;
    },
};

export const dataManagerAPI = {
    getDashboard: async () => {
        //called from datamanagerDashboard
        const res = await API.get('/data-management/data-manager');
        return res.data;
    },

    //called from dataquery
    getPatients: async () => {
        const res = await API.get('/data-management/patients');
        return res.data;
    },
    //called from dataquery
    getPatientVisits: async (patientId: string) => {
        const res = await API.get(`/data-management/patients/${patientId}/visits`);
        return res.data;
    },
    //called from dataquery
    getVisitForms: async (visitId: string) => {
        const res = await API.get(`/data-management/visits/${visitId}/forms`);
        return res.data;
    },
    //called from dataquery
    raiseQuery: async (data: { ecrf_instance_id: number; field_name: string; query_text: string }) => {
        const res = await API.post('/data-management/queries', data);
        return res.data;
    },
    //called from dataquery
    getQueryDetail: async (queryId: number) => {
        const res = await API.get(`/data-management/queries/${queryId}`);
        return res.data;
    },
    //called from dataquery
    updateQuery: async (queryId: number, data: { action: string; rejection_comment?: string; reason: string }) => {
        const res = await API.put(`/data-management/queries/${queryId}`, data);
        return res.data;
    },
    //called from dataquery
    getQueries: async (params: any) => {
        const res = await API.get('/data-management/queries', { params });
        return res.data;
    },
    //called from dataquery, datareview
    getSites: async () => {
        const res = await API.get('/data-management/sites');
        return res.data;
    },
    //called from dataquery
    getSitePerformance: async () => {
        const res = await API.get('/data-management/site-performance');
        return res.data;
    },

    //called from database lock, datareview, called from protocols as well
    getTrials: async () => {
        const res = await API.get('/data-management/trials');
        return res.data;
    },
    //called from database lock
    getLockReadiness: async (trialId: string) => {
        const res = await API.get(`/data-management/lock-readiness/${trialId}`);
        return res.data;
    },
    //called from database lock
    getLocks: async () => {
        const res = await API.get('/data-management/locks');
        return res.data;
    },
    //called from database lock
    initiateLock: async (data: { trial_id: number; lock_type: string; lock_scope?: string; reason: string }) => {
        const res = await API.post('/data-management/lock', data);
        return res.data;
    },
    // called from datareview
    getCompleteness: async (trialId: string) => {
        const res = await API.get('/data-management/completeness', { params: { trial_id: trialId } });
        return res.data;
    },
    // called from datareview
    getCompletenessTrend: async (trialId: string) => {
        const res = await API.get(`/data-management/trend/${trialId}`);
        return res.data;
    },
    // called from datareview
    getMissingData: async (trialId: string) => {
        const res = await API.get('/data-management/missing-data', { params: { trial_id: trialId } });
        return res.data;
    },
    // called from datareview
    getDeviations: async (params: any) => {
        const res = await API.get('/data-management/deviations', { params });
        return res.data;
    },
    // called from datareview
    updateDeviation: async (deviationId: number, data: { reported_to_irb: boolean; reason: string }) => {
        const res = await API.put(`/data-management/deviations/${deviationId}`, data);
        return res.data;
    },
    //called from CDISCExport
    generateDMSDTMExport: async (data: { trial_id: number; domains: string[]; cutoff_date: string }) => {
        const res = await API.post('/data-management/export/sdtm', data);
        return res.data;
    },
    //called from CDISCExport
    generateCustomExport: async (data: { columns: string[]; conditions: any[]; preview: boolean }) => {
        const res = await API.post('/data-management/export/custom', data);
        return res.data;
    },
    //called from CDISCExport
    getDatasets: async (trialId: string) => {
        const res = await API.get('/data-management/datasets', { params: { trial_id: trialId } });
        return res.data;
    },
    //called from CDISCExport
    createDataset: async (data: any) => {
        const res = await API.post('/data-management/datasets', data);
        return res.data;
    },

    //called from auditTrail
    getAuditLog: async (params: any) => {
        const res = await API.get('/data-management/audit', { params });
        return {
            data: res.data,
            totalCount: parseInt(res.headers['x-total-count'] ?? '0', 10)
        };
    },
    //called from auditTrail, protocols
    getAuditUsers: async () => {
        const res = await API.get('/data-management/audit/users');
        return res.data;
    },
    //called from auditTrail
    getAuditSignatures: async () => {
        const res = await API.get('/data-management/audit/signatures');
        return res.data;
    },
    // called from protocols
    getProtocols: async (trialId: string) => {
        const res = await API.get(`/data-management/protocols/${trialId}`);
        return res.data;
    },
    //called from protocols
    uploadProtocol: async (data: { 
        trial_id: number; 
        version_number: string; 
        amendment_number: number; 
        approval_date: string | null; 
        approved_by_user_id: number; 
        protocol_document: Record<string, any>; 
        reason: string 
    }) => {
        const res = await API.post('/data-management/protocols', data);
        return res.data;
    }
};

export const statisticsAPI = {
  //all of these are inside statistician routes

    //called from statistician dashboard
    getDashboard: async () => {
        const res = await API.get('/statistics/statistician');
        return res.data;
    },

    getTrials: async () => { //called from AnalysisDatasets, PowerAnalysis, randomizationBalance, pages/SafetyStatistics
        const res = await API.get('/statistics/trials');
        return res.data;
    },
    getDatasets: async (trialId?: string) => { //called from AnalysisDatasets
        const res = await API.get('/statistics/datasets', { 
            params: { trialId: trialId || undefined } 
        });
        return res.data;
    },
    getDatasetAudit: async (id: number) => {//called from AnalysisDatasets
        const res = await API.get(`/statistics/datasets/${id}/audit`);
        return res.data;
    },
    createDataset: async (data: any) => {//called from AnalysisDatasets
        const res = await API.post('/statistics/datasets', data);
        return res.data;
    },

    getSurvivalAnalyses: async (trialId: string) => {//called from SurvivalAnalysis
        const res = await API.get(`/statistics/survival/${trialId}`);
        return res.data;
    },
    //called from SurvivalAnalysis
    getSubgroupSurvival: async (trialId: string, stratificationFactor: string) => {
        const res = await API.post('/statistics/survival/subgroup', {
            trial_id: parseInt(trialId),
            stratification_factor: stratificationFactor
        });
        return res.data;
    },
    //called from SurvivalAnalysis
    runSurvivalAnalysis: async (data: { trial_id: number; endpoint_type: string }) => {
        const res = await API.post('/statistics/survival', data);
        return res.data;
    },

    //called from power analysis
    getEnrollmentContext: async (trialId: string) => {
        const res = await API.get(`/statistics/enrollment/${trialId}`);
        return res.data;
    },
    //called from powerAnalysis in pages/poweranalysis folder
    runPowerAnalysis: async (data: { trial_id: number; effect_size: number; alpha: number; power_target: number }) => {
        const res = await API.post('/statistics/power', data);
        return res.data;
    },
    //called from pages/RandomizationBalance folders file
    getRandomizationBalance: async (trialId: string) => {
        const res = await API.get(`/statistics/balance/${trialId}`);
        return res.data;
    },

    //called from pages/SafetyStatistics folder
    getSafetyStats: async (trialId: string) => {
        const res = await API.get(`/statistics/safety-stats/${trialId}`);
        return res.data;
    },
    //callled from pages/SafetyStatistics folder
    getExposureRates: async (trialId: string) => {
        const res = await API.get(`/statistics/safety-stats/incidence/${trialId}`);
        return res.data;
    },
    // Called from interim analysis 
    getInterimLocks: async (trialId: string) => {
        const res = await API.get(`/statistics/interim/locks/${trialId}`);
        return res.data;
    },
    // Called from interim analysis 
    getInterimContext: async (trialId: string) => {
        const res = await API.get(`/statistics/interim/context/${trialId}`);
        return res.data;
    },
    // Called from interim analysis 
    getLatestDSMB: async (trialId: string) => {
        const res = await API.get(`/statistics/dsmb/${trialId}/latest`);
        return res.data;
    },
    //called from CDISC stats
    getExportCounts: async (trialId: string) => {
        const res = await API.get(`/statistics/export/counts/${trialId}`);
        return res.data;
    },
    //called from CDISC stats
    generateSDTMExport: async (data: { trial_id: number; domains: string[] }) => {
        const res = await API.post('/statistics/export/sdtm', data);
        return res.data;
    }
};


export const adminAPI = {
  //called from adminDashboard
    getDashboard: async () => {
        const res = await API.get('/admin/admin');
        return res.data;
    },
    //called from adminDashboard
    refreshMVs: async () => {
        const res = await API.post('/admin/mv/refresh');
        return res.data;
    },
    // called from trialManagement, lockManagement
    getTrials: async () => {
        const res = await API.get('/admin/trials');
        return res.data;
    },
    // called from trialManagement
    archiveTrial: async (id: number) => {
        const res = await API.delete(`/admin/trials/${id}`);
        return res.data;
    },

    //called from user management
  getUsers: async (params?: Record<string, any>) => {
    const res = await API.get('/admin/users', { params });
    return res.data;
  },
  //called from user managerment when create user
  createUser: async (data: any) => {
    const res = await API.post('/admin/users', data);
    return res.data;
  },
  //called from user management when update user
  updateUser: async (id: number, data: any) => {
    const res = await API.put(`/admin/users/${id}`, data);
    return res.data;
  },

  //called from user management
  toggleUserStatus: async (id: number, active: boolean) => {
    const res = await API.put(`/admin/users/${id}/${active ? 'activate' : 'deactivate'}`);
    return res.data;
  },
//called from user management
  resetUserPassword: async (id: number, newPassword: string) => {
    const res = await API.post(`/admin/users/${id}/reset-password`, { new_password: newPassword });
    return res.data;
  },
//called from user management, sites_management
  // Sites dropdowns
  getSites: async (params?: Record<string, any>) => {
    const res = await API.get('/admin/sites', { params });
    return res.data;
  },
  // called from TrialForm (Get Single Trial)
  getTrial: async (id: string | number) => {
    const res = await API.get(`/admin/trials/${id}`);
    return res.data;
  },
  // called from TrialForm (Create Trial)
  createTrial: async (data: any) => {
    const res = await API.post('/admin/trials', data);
    return res.data;
  },
  // called from TrialForm (Update Trial)
  updateTrial: async (id: string | number, data: any) => {
    const res = await API.put(`/admin/trials/${id}`, data);
    return res.data;
  },
  // Fetch all trial details (overview, sites, protocols, etc.)
  getTrialFull: async (id: string | number) => {
    const res = await API.get(`/admin/trials/${id}`);
    return res.data;
  },
  
  // Generic method to add related trial data (sites, arms, labs, etc.)
  addTrialEntity: async (trialId: string | number, path: string, data: any) => {
    const res = await API.post(`/admin/trials/${trialId}/${path}`, data);
    return res.data;
  },

  // Generic method to delete a related trial entity (like an eligibility criterion)
  deleteTrialEntity: async (trialId: string | number, path: string, entityId: string | number) => {
    const res = await API.delete(`/admin/trials/${trialId}/${path}/${entityId}`);
    return res.data;
  },

  //called frm siteDetails
    getSiteDetails: async (id: string | number) => {
        const res = await API.get(`/admin/sites/${id}`);
        return res.data;
    },
    //callled from siteDetails
    suspendSite: async (id: string | number, data: { reason: string }) => {
        const res = await API.put(`/admin/sites/${id}/suspend`, data);
        return res.data;
    },

    //called from siteedit
    // Inside your existing adminAPI object in api.ts:
    updateSite: async (id: string | number, data: any) => {
        const res = await API.put(`/admin/sites/${id}`, data);
        return res.data;
    },

    //called from lock management
    getLocks: async () => {
        const res = await API.get('/admin/locks');
        return res.data;
    },
    //called from lock management
    createLock: async (data: { trial_id: number; lock_type: string }) => {
        const res = await API.post('/admin/locks', data);
        return res.data;
    },
    //called from lock management
    unlockTrial: async (id: number | string, reason: string) => {
        const res = await API.put(`/admin/locks/${id}/unlock`, { reason });
        return res.data;
    },
    //called from lock management
    verifyLock: async (id: number | string) => {
        const res = await API.get(`/admin/locks/${id}/verify`);
        return res.data;
    },

    //called from SystemSettings (NOT USED)
    getSettings: async () => {
        const res = await API.get('/admin/settings');
        return res.data;
    },
    //not used either
    updateSetting: async (key: string, value: any) => {
        const res = await API.put('/admin/settings', { key, value });
        return res.data;
    },
    refreshMaterializedViews: async () => {
        const res = await API.post('/admin/mv/refresh');
        return res.data;
    },
    //called from adminAuditTrail
    getAuditLogs: async (params?: any) => {
        const res = await API.get('/admin/audit', { params });
        return res.data;
    },

    //called from useraccesslog
    getUserAccessLog: async (userId: string | number) => {
    const res = await API.get(`/admin/users/${userId}/access-log`);
    return res.data;
  }

};


// Test API connection
export const testAPI = {
  testConnection: async () => {
    const response = await API.get('/test');
    return response.data;
  },
};



export default API;