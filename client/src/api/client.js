import axios from 'axios';

const TOKEN_KEY = 'hiresense_token';

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (token) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

const api = axios.create({
  baseURL: `${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api`,
  timeout: 60000, // free hosting can take time to wake up
});

// Attach the login token to every request
api.interceptors.request.use((config) => {
  const token = tokenStore.get();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Turns any API error into { message, fields } for the forms
export function readError(err) {
  if (err.response?.data) {
    return {
      message: err.response.data.message || 'Request failed.',
      fields: err.response.data.fields || {},
    };
  }
  if (err.code === 'ECONNABORTED') {
    return { message: 'The server is taking too long to respond. Please try again.', fields: {} };
  }
  return { message: 'Cannot reach the server. Check your connection and try again.', fields: {} };
}

export default api;
