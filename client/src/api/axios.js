import axios from 'axios';

// Create Axios instance pointing to server URL
const api = axios.create({
  baseURL: import.meta.env.VITE_SERVER_URL || 'http://localhost:5000'
});

// Request Interceptor: Attach JWT token if present in sessionStorage
api.interceptors.request.use(
  (config) => {
    const token = sessionStorage.getItem('nexmeet_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response Interceptor: Redirect to login if 401 Unauthorized occurs
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      console.warn('Session unauthorized. Clearing credentials and redirecting...');
      sessionStorage.removeItem('nexmeet_token');
      sessionStorage.removeItem('nexmeet_user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;
