import axios from 'axios';

/**
 * Single axios instance for every API call.
 * - baseURL '/api' (Vite proxies this to the Express backend on :5000 in dev;
 *   the production single-service deploy serves both from one origin)
 * - withCredentials: cookies (customer/admin JWTs) ride along automatically
 * - Never stores tokens in JS-readable storage — the server sets httpOnly cookies.
 */

const api = axios.create({
  baseURL: 'https://scentora-api.onrender.com/api',
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
