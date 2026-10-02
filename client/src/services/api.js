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

// options: { formFactor: 'mobile' | 'desktop', runs: 1 | 3 | 5 }
export const runAudit = async (url, { formFactor = 'mobile', runs = 1 } = {}) => {
    let auditUrl = url.trim();
    if (!auditUrl.startsWith('http://') && !auditUrl.startsWith('https://')) {
        auditUrl = 'https://' + auditUrl;
    }

    try {
        const response = await API.post(
            '/api/audit',
            { url: auditUrl, formFactor, runs },
            // Each Lighthouse run can take up to ~2 minutes
            { timeout: runs * 130000 + 30000 }
        );
        return response.data;
    } catch (error) {
        if (error.code === 'ECONNABORTED') {
            throw new Error('The audit took too long. Try fewer runs.');
        }
        // Prefer the server's explanation (e.g. "Lighthouse could not audit this page: ...")
        throw new Error(error.response?.data?.error || error.message);
    }
};

// formFactor keeps mobile and desktop results apart (they are not comparable)
export const getTrendData = async (url, limit = 10, formFactor = null) => {
    const ff = formFactor ? `&formFactor=${formFactor}` : '';
    const response = await API.get(`/api/trend/${encodeURIComponent(url)}?limit=${limit}${ff}`);
    return response.data;
};

export const getAuditHistory = async (url, limit = 20, formFactor = null) => {
    const ff = formFactor ? `&formFactor=${formFactor}` : '';
    const response = await API.get(`/api/history/${encodeURIComponent(url)}?limit=${limit}${ff}`);
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

// ─── FULL LIGHTHOUSE REPORT ──────────────────────────────────────────────────

// Opens the original Lighthouse HTML report in a new tab. The report endpoint
// needs the login token, so it is fetched here and shown from memory.
export const openLighthouseReport = async (auditId) => {
    // Open the tab immediately (inside the click) so pop-up blockers allow it
    const tab = window.open('', '_blank');
    try {
        const response = await API.get(`/api/audit/${auditId}/report`, { responseType: 'blob' });
        const blobUrl = URL.createObjectURL(new Blob([response.data], { type: 'text/html' }));
        if (tab) tab.location.href = blobUrl; else window.location.href = blobUrl;
        setTimeout(() => URL.revokeObjectURL(blobUrl), 60000);
    } catch (error) {
        if (tab) tab.close();
        let message = error.message;
        try { message = JSON.parse(await error.response.data.text()).error; } catch {}
        throw new Error(message);
    }
};

// Downloads the raw Lighthouse result (opens in https://googlechrome.github.io/lighthouse/viewer/)
export const downloadLighthouseJson = async (auditId) => {
    const response = await API.get(`/api/audit/${auditId}/report.json`, { responseType: 'blob' });
    const blobUrl = URL.createObjectURL(response.data);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = `lighthouse_audit_${auditId}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
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
