import axios from 'axios';

// Get backend API base URL from Vite environment variables
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// Create a pre-configured Axios instance
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000, // 10 second request timeout
});

// Request interceptor (can be used later to attach JWT tokens)
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor for centralized error handling and auth expiry
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Handle expired or invalid authentication on protected routes
    if (
      error.response?.status === 401 &&
      error.config &&
      !error.config.url.includes('/auth/login') &&
      !error.config.url.includes('/auth/register')
    ) {
      console.warn('Session token expired or invalidated. Clearing credentials.');
      localStorage.removeItem('token');
      if (typeof window !== 'undefined' && window.location.pathname !== '/auth') {
        window.location.href = '/auth';
      }
    }
    console.error('API Error:', error.response?.data?.message || error.message);
    return Promise.reject(error);
  }
);

export default api;
