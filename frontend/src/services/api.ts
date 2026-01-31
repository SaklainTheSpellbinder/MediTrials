import axios from 'axios';

// Create axios instance with base URL
const API = axios.create({
  baseURL: 'http://localhost:5000/api',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000, // 10 second timeout
});

// Add request interceptor for auth tokens (if needed later)
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

// Add response interceptor for error handling
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

    // Auto-set site_id from logged-in user
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

// Visit API functions
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