import axios from 'axios';

const API = axios.create({
  baseURL: 'http://localhost:5000/api',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

API.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
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
  // Get all patients - filtered by user's site
  getAll: async () => {
    const userStr = localStorage.getItem('user');
    const user = userStr ? JSON.parse(userStr) : null;

    const params = new URLSearchParams();
    if (user?.site_id) params.append('site_id', user.site_id.toString());

    const response = await API.get(`/patients?${params.toString()}`);
    return response.data;
  },

  // Get single patient
  getById: async (id: number) => {
    const response = await API.get(`/patients/${id}`);
    return response.data;
  },

  // Create new patient - auto-include user's site_id
  create: async (patientData: any) => {
    const userStr = localStorage.getItem('user');
    const user = userStr ? JSON.parse(userStr) : null;

    if (user?.site_id) {
      patientData.site_id = user.site_id;
    }

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
};

export const patientProfileAPI = {
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

  // Submit the complete screening + consent record
  submit: async (payload: {
    full_name: string;
    date_of_birth: string;
    gender: string;
    site_id: number;
    screening_status: string;
    eligibility_score: number;
    manual_override: boolean;
    override_reason: string;
    failures: Array<{ criterion_id: number; failure_reason: string; override_approved: boolean }>;
    consent_version: string;
    consent_date: string;
    e_signature_password: string;
    submitted_by_user_id: number;
  }) => {
    const response = await API.post('/screening/submit', payload);
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
    const response = await API.get('/labs');
    return response.data;
  },

  getByPatientId: async (patientId: number) => {
    const response = await API.get(`/patients/${patientId}/labs`);
    return response.data;
  },
};

// Test API connection
export const testAPI = {
  testConnection: async () => {
    const response = await API.get('/test');
    return response.data;
  },
};

export default API;