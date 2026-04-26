import axios from "axios";

// In production (build_and_run.bat), React is served by FastAPI on the same port —
// use current origin. In dev (port 3000), point explicitly to the backend port 8001.
export const BACKEND_URL = window.location.port === "3000"
  ? `https://${window.location.hostname}:8001`
  : window.location.origin;

const api = axios.create({ baseURL: `${BACKEND_URL}/api` });

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (err) => Promise.reject(err)
);

// Normalize error messages from backend detail field
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      const hadToken = !!localStorage.getItem("token");
      localStorage.removeItem("token");
      if (hadToken) {
        window.dispatchEvent(new CustomEvent("auth:expired"));
      }
    }
    if (err.response?.data?.detail) {
      err.message = err.response.data.detail;
    }
    return Promise.reject(err);
  }
);

export const seedData = () => api.post("/seed");
export const getDashboard = () => api.get("/dashboard");
let _customersCache = null;
let _customersCacheTime = 0;
const CUSTOMERS_CACHE_TTL = 60000;
export const getCustomers = () => {
  const now = Date.now();
  if (_customersCache && now - _customersCacheTime < CUSTOMERS_CACHE_TTL) {
    return Promise.resolve(_customersCache);
  }
  return api.get("/customers").then(res => {
    _customersCache = res;
    _customersCacheTime = Date.now();
    return res;
  });
};
export const getPendingCustomers = () => api.get("/customers", { params: { pending_only: true } });
export const invalidateCustomersCache = () => { _customersCache = null; };
let _itemsCache = null;
let _itemsCacheTime = 0;
let _itemsCacheKey = "";
const ITEMS_CACHE_TTL = 30000; // 30 seconds
export const getItems = (params) => {
  const key = JSON.stringify(params || {});
  const now = Date.now();
  if (_itemsCache && key === _itemsCacheKey && now - _itemsCacheTime < ITEMS_CACHE_TTL) {
    return Promise.resolve(_itemsCache);
  }
  return api.get("/items", { params }).then(res => {
    _itemsCache = res;
    _itemsCacheKey = key;
    _itemsCacheTime = Date.now();
    return res;
  });
};
export const invalidateItemsCache = () => { _itemsCache = null; };
export const getItem = (id) => api.get(`/items/${id}`);
export const getRefs = (name) => api.get("/refs", { params: { name } });
export const getPendingRefs = (name) => api.get("/refs", { params: { name, pending_only: true } });
export const getOrders = () => api.get("/orders");
export const getPendingOrders = () => api.get("/orders", { params: { pending_only: true } });
export const getOrderStatus = (params) => api.get("/orders/status", { params });
export const markOrderDelivered = (order_no) => api.post("/orders/deliver", { order_no });

export const createBill = (data) => api.post("/bills", data);

export const getAwaitingOrders = () => api.get("/tailoring/awaiting");
export const assignTailoring = (data) => api.post("/tailoring/assign", data);
export const splitTailoring = (data) => api.post("/tailoring/split", data);

export const addAddons = (data) => api.post("/addons", data);

export const getJobwork = (params) => api.get("/jobwork", { params });
export const moveJobwork = (data) => api.post("/jobwork/move", data);
export const moveJobworkBack = (data) => api.post("/jobwork/move-back", data);
export const moveJobworkEmb = (data) => api.post("/jobwork/move-emb", data);
export const editJobworkEmb = (data) => api.post("/jobwork/edit-emb", data);
export const getJobworkFilters = () => api.get("/jobwork/filters");

export const getBalances = (params) => api.get("/settlements/balances", { params });
export const processSettlement = (data) => api.post("/settlements/pay", data);

export const getDaybook = (params) => api.get("/daybook", { params });
export const getDaybookDates = () => api.get("/daybook/dates");
export const getDaybookPendingCount = () => api.get("/daybook/pending-count");
export const tallyEntries = (data) => api.post("/daybook/tally", data);

export const getLabourItems = (params) => api.get("/labour", { params });
export const getKarigars = () => api.get("/labour/karigars");
export const payLabour = (data) => api.post("/labour/pay", data);
export const deleteLabourPayment = (data) => api.post("/labour/delete-payment", data);

export const getAdvances = (params) => api.get("/advances", { params });
export const createAdvance = (data) => api.post("/advances", data);
export const updateAdvance = (id, data) => api.put(`/advances/${id}`, data);
export const deleteAdvance = (id) => api.delete(`/advances/${id}`);

// Edit & Delete
export const updateItem = (id, data) => api.put(`/items/${id}`, data);
export const deleteItem = (id) => api.delete(`/items/${id}`);
export const bulkDeleteItems = (ids) => api.delete("/items/bulk/delete", { data: ids });
export const createItem = (data) => api.post("/items", data);

// Search
export const searchItems = (params) => api.get("/search", { params });

// Auth token helper for direct URL links (iframe / anchor href)
const _authToken = () => { try { return localStorage.getItem("token") || ""; } catch { return ""; } };

// Invoice (HTML only) — include token so iframe/direct links authenticate
export const getInvoiceUrl = (ref) => { const t = _authToken(); return `${BACKEND_URL}/api/invoice?ref=${encodeURIComponent(ref)}${t ? `&token=${encodeURIComponent(t)}` : ''}`; };

// Reports
export const getRevenueReport = (params) => api.get("/reports/revenue", { params });
export const getCustomerReport = () => api.get("/reports/customers");
export const getSummaryReport = (params) => api.get("/reports/summary", { params });

// Import / Export / Backup
export const importExcel = (formData, mode) => api.post(`/import/excel?mode=${mode}`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
export const exportExcelUrl = () => { const t = _authToken(); return `${BACKEND_URL}/api/export/excel${t ? `?token=${encodeURIComponent(t)}` : ''}`; };
export const backupUrl = () => { const t = _authToken(); return `${BACKEND_URL}/api/backup${t ? `?token=${encodeURIComponent(t)}` : ''}`; };
export const restoreBackup = (formData) => api.post("/restore", formData, { headers: { 'Content-Type': 'multipart/form-data' } });
export const getDbStats = () => api.get("/db/stats");
export const getDbAudit = (params) => api.get("/db/audit", { params });
export const normalizeDbData = (params) => api.post("/db/normalize", null, { params });
export const repairDbData = (params) => api.post("/db/repair", null, { params });

// Settings
export const getPublicSettings = () => api.get("/settings/public").then(r => r.data);
export const getSettings = () => api.get("/settings");
export const updateSettings = (data) => api.put("/settings", data);
export const uploadLogo = (formData) => api.post("/upload/logo", formData, {
  headers: { 'Content-Type': 'multipart/form-data' }
});

// Auth
export const login = (username, password) => api.post("/auth/login", { username, password }).then(r => r.data);
export const getMe = () => api.get("/auth/me").then(r => r.data);
export const registerUser = (data) => api.post("/auth/register", data);
export const listUsers = () => api.get("/auth/users").then(r => r.data);
export const updateUser = (username, data) => api.put(`/auth/users/${username}`, data);
export const deleteUser = (username) => api.delete(`/auth/users/${username}`);
export const listAuditLogs = (params) => api.get("/audit-logs", { params });

export default api;