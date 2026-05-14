const BASE = import.meta.env.VITE_API_URL || '';

async function request(url, options = {}) {
  const token = localStorage.getItem('sagecrm_token');
  const headers = { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
  const res = await fetch(`${BASE}${url}`, { headers, ...options });
  if (res.status === 204) return null;
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Erro ${res.status}`);
  }
  return res.json();
}

// Auth
export const loginApi = (data) => request('/api/auth/login', { method: 'POST', body: JSON.stringify(data) });
export const registerApi = (data) => request('/api/auth/register', { method: 'POST', body: JSON.stringify(data) });
export const getMe = () => request('/api/auth/me');

// Companies
export const getCompanies = () => request('/api/companies');
export const createCompany = (data) => request('/api/companies', { method: 'POST', body: JSON.stringify(data) });
export const updateCompany = (id, data) => request(`/api/companies/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteCompany = (id) => request(`/api/companies/${id}`, { method: 'DELETE' });

// Contacts
export const getContacts = () => request('/api/contacts');
export const getContact = (id) => request(`/api/contacts/${id}`);
export const createContact = (data) => request('/api/contacts', { method: 'POST', body: JSON.stringify(data) });
export const updateContact = (id, data) => request(`/api/contacts/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteContact = (id) => request(`/api/contacts/${id}`, { method: 'DELETE' });

// Deals
export const getDeals = () => request('/api/deals');
export const getDeal = (id) => request(`/api/deals/${id}`);
export const createDeal = (data) => request('/api/deals', { method: 'POST', body: JSON.stringify(data) });
export const updateDeal = (id, data) => request(`/api/deals/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteDeal = (id) => request(`/api/deals/${id}`, { method: 'DELETE' });

// Tasks
export const getTasks = () => request('/api/tasks');
export const createTask = (data) => request('/api/tasks', { method: 'POST', body: JSON.stringify(data) });
export const updateTask = (id, data) => request(`/api/tasks/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteTask = (id) => request(`/api/tasks/${id}`, { method: 'DELETE' });

// Activities
export const getActivities = (params = '') => request(`/api/activities${params}`);
export const createActivity = (data) => request('/api/activities', { method: 'POST', body: JSON.stringify(data) });
export const deleteActivity = (id) => request(`/api/activities/${id}`, { method: 'DELETE' });

// Dashboard
export const getDashboard = () => request('/api/dashboard');

// Reports
export const getReportPipeline = () => request('/api/reports/pipeline');
export const getReportRevenue = () => request('/api/reports/revenue');
export const getReportConversion = () => request('/api/reports/conversion');
export const getReportTopContacts = () => request('/api/reports/top-contacts');
export const getReportSummary = () => request('/api/reports/summary');

// Search
export const globalSearch = (q) => request(`/api/search?q=${encodeURIComponent(q)}`);

// Notifications
export const getNotifications = () => request('/api/notifications');
