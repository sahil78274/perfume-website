import axios from 'axios';

/**
 * Single axios instance for every API call.
 * - dev uses the Vite /api proxy; production calls the separate Render API origin
 * - withCredentials: cross-origin HttpOnly cookies (customer/admin JWTs) ride along automatically
 * - Never stores tokens in JS-readable storage — the server sets httpOnly cookies.
 */

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.PROD ? 'https://scentora-api.onrender.com/api' : '/api');

const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  timeout: 15000,
  headers: { Accept: 'application/json' }
});


/** Normalise axios errors into a single Error shape: { message, status, code, data } */
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const err = new Error(
      (error.response && error.response.data && error.response.data.error) ||
        (error.code === 'ERR_NETWORK'
          ? 'Cannot reach the server. Is the backend running on port 5000?'
          : `Request failed (${(error.response && error.response.status) || 'unknown'})`)
    );
    err.status = error.response ? error.response.status : 0;
    err.code = (error.response && error.response.data && error.response.data.code) || error.code;
    err.data = (error.response && error.response.data) || null;
    err.isNetworkError = !error.response;
    return Promise.reject(err);
  }
);

export default api;
