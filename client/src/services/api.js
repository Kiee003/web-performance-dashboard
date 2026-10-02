// ─────────────────────────────────────────────────────────────────────────────
// The ONE place the frontend talks to the backend.
//
// Requests use relative paths like '/api/audit' — no host or port here.
//   • Development: the React dev server forwards /api/* to the backend
//     (see src/setupProxy.js, which reads PORT from server/.env).
//   • Production:  the backend serves this app itself, so /api is same-origin.
// ─────────────────────────────────────────────────────────────────────────────
import axios from 'axios';

export const TOKEN_KEY = 'auth_token';

const API = axios.create({
    baseURL: '',
    timeout: 120000
});

// Attach the login token (if any) to every request
API.interceptors.request.use((config) => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

// If the session expires mid-use, clear the token and reload to the login page.
// Login/register/me are excluded: a wrong password should show an error, not reload.
const AUTH_PATHS = ['/api/auth/login', '/api/auth/register', '/api/auth/me'];

API.interceptors.response.use(
    (response) => response,
    (error) => {
        const url = error.config?.url || '';
        if (error.response?.status === 401 && !AUTH_PATHS.includes(url)) {
            localStorage.removeItem(TOKEN_KEY);
            window.location.reload();
        }
        return Promise.reject(error);
    }
);

// ─── AUTH ────────────────────────────────────────────────────────────────────

export const loginUser = async (email, password) => {
    const response = await API.post('/api/auth/login', { email, password });
    return response.data;
};

export const registerUser = async (username, email, password) => {
    const response = await API.post('/api/auth/register', { username, email, password });
    return response.data;
};

export const getCurrentUser = async () => {
    const response = await API.get('/api/auth/me');
    return response.data;
};

// ─── SYSTEM ──────────────────────────────────────────────────────────────────

export const testConnection = async () => {
    try {
        const response = await API.get('/api/test');
        console.log('✅ Backend connected:', response.data);
        return response.data;
    } catch (error) {
        console.error('❌ Connection failed:', error.message);
        throw error;
    }
};

// ─── AUDITS ──────────────────────────────────────────────────────────────────

export const runAudit = async (url) => {
    try {
        console.log('📤 Sending audit request for:', url);

        let auditUrl = url;
        if (!url.startsWith('http://') && !url.startsWith('https://')) {
            auditUrl = 'https://' + url;
            console.log('🔧 Added https://, now:', auditUrl);
        }

        const response = await API.post('/api/audit', { url: auditUrl });
        console.log('✅ Audit complete:', response.data);
        return response.data;
    } catch (error) {
        console.error('❌ Audit failed:', error.response?.data || error.message);
        if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
            throw new Error('Audit took too long. Please try again.');
        }
        throw error;
    }
};

export const getTrendData = async (url, limit = 10) => {
    const response = await API.get(`/api/trend/${encodeURIComponent(url)}?limit=${limit}`);
    return response.data;
};

export const getAuditHistory = async (url, limit = 20) => {
    const response = await API.get(`/api/history/${encodeURIComponent(url)}?limit=${limit}`);
    return response.data;
};

export const getAllAudits = async (limit = 50) => {
    const response = await API.get(`/api/audits?limit=${limit}`);
    return response.data;
};

export const getAuditById = async (id) => {
    const response = await API.get(`/api/audit/${id}`);
    return response.data;
};

export const getWebsiteStats = async (url) => {
    const response = await API.get(`/api/website/${encodeURIComponent(url)}/stats`);
    return response.data;
};

export const getAllWebsites = async () => {
    const response = await API.get('/api/websites');
    return response.data;
};

export const getStatistics = async () => {
    const response = await API.get('/api/statistics');
    return response.data;
};

// ─── COMPARE & CRAWLER ───────────────────────────────────────────────────────

export const compareAudits = async (auditIds) => {
    const response = await API.post('/api/compare', { auditIds });
    return response.data;
};

export const crawlUrl = async (url) => {
    const response = await API.post('/api/crawl/analyze', { url });
    return response.data;
};

export default API;
