import axios from 'axios';

const api = axios.create({
 baseURL: import.meta.env.VITE_API_URL || '/api',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response && err.response.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      if (!window.location.pathname.startsWith('/login') && !window.location.pathname.startsWith('/register')) {
        window.location.href = '/login';
      }
    }
    // A session issued before private mode was enabled is rejected centrally.
    if (
      err.response &&
      err.response.status === 403 &&
      err.response.data &&
      err.response.data.code === 'PRIVATE_MODE_ADMIN_REQUIRED'
    ) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  }
);

const errorMessage = (err, fallback = 'Something went wrong') =>
  (err && err.response && err.response.data && err.response.data.message) || fallback;

export { api, errorMessage };
