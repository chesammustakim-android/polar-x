/**
 * POLAR-X API Client Service
 * Connects React frontend to FastAPI backend with authentication & graceful fallback.
 */

const rawBaseUrl = 
  import.meta.env.VITE_API_URL || 
  import.meta.env.VITE_API_BASE_URL || 
  (import.meta.env.PROD ? '' : 'http://127.0.0.1:8000');

const BASE_URL = rawBaseUrl ? rawBaseUrl.replace(/\/$/, '') : '';

const TOKEN_KEY = 'polar_x_auth_token';
const USER_KEY = 'polar_x_auth_user';

function getAuthHeader() {
  const token = localStorage.getItem(TOKEN_KEY);
  return token ? { 'Authorization': `Bearer ${token}` } : {};
}

async function handleResponse(response) {
  if (response.status === 401) {
    // If unauthorized, clear invalid token
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }
  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage = `HTTP Error ${response.status}: ${response.statusText}`;
    try {
      const errorJson = JSON.parse(errorText);
      if (errorJson.detail) {
        errorMessage = typeof errorJson.detail === 'string' ? errorJson.detail : JSON.stringify(errorJson.detail);
      }
    } catch {
      if (errorText) errorMessage = errorText;
    }
    throw new Error(errorMessage);
  }
  return await response.json();
}

async function authFetch(url, options = {}) {
  const headers = {
    ...getAuthHeader(),
    ...(options.headers || {})
  };
  return fetch(url, { ...options, headers });
}

export const api = {
  // ─── Authentication & RBAC ────────────────────────────────────────────────
  getStoredToken() {
    return localStorage.getItem(TOKEN_KEY);
  },

  getStoredUser() {
    try {
      const u = localStorage.getItem(USER_KEY);
      return u ? JSON.parse(u) : null;
    } catch {
      return null;
    }
  },

  isAuthenticated() {
    return !!localStorage.getItem(TOKEN_KEY);
  },

  async login(username, password) {
    const res = await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await handleResponse(res);
    if (data.access_token) {
      localStorage.setItem(TOKEN_KEY, data.access_token);
      localStorage.setItem(USER_KEY, JSON.stringify(data.user));
    }
    return data;
  },

  async logout() {
    try {
      await authFetch(`${BASE_URL}/api/auth/logout`, { method: 'POST' });
    } catch (err) {
      console.warn('[POLAR-X API] Backend logout notice:', err.message);
    } finally {
      localStorage.removeItem(TOKEN_KEY);
      localStorage.removeItem(USER_KEY);
    }
    return { status: 'logged_out' };
  },

  async getCurrentUser() {
    try {
      const res = await authFetch(`${BASE_URL}/api/auth/me`);
      const user = await handleResponse(res);
      if (user) {
        localStorage.setItem(USER_KEY, JSON.stringify(user));
      }
      return user;
    } catch (err) {
      console.warn('[POLAR-X API] Failed to fetch current user profile:', err.message);
      return null;
    }
  },

  async getDemoUsers() {
    try {
      const res = await fetch(`${BASE_URL}/api/auth/demo-users`);
      return await handleResponse(res);
    } catch (err) {
      console.warn('[POLAR-X API] Failed to fetch demo users list:', err.message);
      return [];
    }
  },

  // System Health
  async getHealth() {
    try {
      const res = await authFetch(`${BASE_URL}/`);
      return await handleResponse(res);
    } catch (err) {
      console.warn('[POLAR-X API] Backend health check failed:', err.message);
      return null;
    }
  },

  // Dashboard Consolidated Endpoint
  async getDashboardData() {
    try {
      const res = await authFetch(`${BASE_URL}/api/dashboard`);
      return await handleResponse(res);
    } catch (err) {
      console.warn('[POLAR-X API] Failed to fetch dashboard data from backend:', err.message);
      return null;
    }
  },

  // Expeditions
  async getExpeditions() {
    try {
      const res = await authFetch(`${BASE_URL}/api/expeditions`);
      return await handleResponse(res);
    } catch (err) {
      console.warn('[POLAR-X API] Failed to fetch expeditions:', err.message);
      return null;
    }
  },

  async getExpeditionById(id) {
    const res = await authFetch(`${BASE_URL}/api/expeditions/${id}`);
    return await handleResponse(res);
  },

  async createExpedition(expeditionData) {
    const res = await authFetch(`${BASE_URL}/api/expeditions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(expeditionData)
    });
    return await handleResponse(res);
  },

  // Cargo & Asset Management
  async getCargo(filters = {}) {
    try {
      const params = new URLSearchParams();
      if (filters.status && filters.status !== 'ALL') params.append('status', filters.status);
      if (filters.priority && filters.priority !== 'ALL') params.append('priority', filters.priority);
      if (filters.expedition_id) params.append('expedition_id', filters.expedition_id);
      if (filters.search) params.append('search', filters.search);

      const queryString = params.toString() ? `?${params.toString()}` : '';
      const res = await authFetch(`${BASE_URL}/api/cargo${queryString}`);
      return await handleResponse(res);
    } catch (err) {
      console.warn('[POLAR-X API] Failed to fetch cargo list:', err.message);
      return null;
    }
  },

  async getCargoStats() {
    try {
      const res = await authFetch(`${BASE_URL}/api/cargo/stats`);
      return await handleResponse(res);
    } catch (err) {
      console.warn('[POLAR-X API] Failed to fetch cargo stats:', err.message);
      return null;
    }
  },

  async getCargoById(id) {
    try {
      const res = await authFetch(`${BASE_URL}/api/cargo/${id}`);
      return await handleResponse(res);
    } catch (err) {
      console.warn(`[POLAR-X API] Failed to fetch cargo ${id}:`, err.message);
      return null;
    }
  },

  async createCargo(cargoData) {
    const res = await authFetch(`${BASE_URL}/api/cargo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cargoData)
    });
    return await handleResponse(res);
  },

  async updateCargo(id, cargoData) {
    const res = await authFetch(`${BASE_URL}/api/cargo/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(cargoData)
    });
    return await handleResponse(res);
  },

  async getCargoHistory(id) {
    try {
      const res = await authFetch(`${BASE_URL}/api/cargo/${id}/history`);
      return await handleResponse(res);
    } catch (err) {
      console.warn(`[POLAR-X API] Failed to fetch history for cargo ${id}:`, err.message);
      return [];
    }
  },

  async addCargoMovement(id, movementData) {
    const res = await authFetch(`${BASE_URL}/api/cargo/${id}/movement`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(movementData)
    });
    return await handleResponse(res);
  },

  async getCargoQRData(id) {
    try {
      const res = await authFetch(`${BASE_URL}/api/cargo/${id}/qr-data`);
      return await handleResponse(res);
    } catch (err) {
      console.warn(`[POLAR-X API] Failed to fetch QR data for cargo ${id}:`, err.message);
      return null;
    }
  },

  async getCargoLocations() {
    try {
      const res = await authFetch(`${BASE_URL}/api/cargo/locations`);
      return await handleResponse(res);
    } catch (err) {
      console.warn('[POLAR-X API] Failed to fetch cargo locations:', err.message);
      return [];
    }
  },

  // Smart Inventory Management
  async getInventory(filters = {}) {
    try {
      const params = new URLSearchParams();
      if (filters.status && filters.status !== 'ALL') params.append('status', filters.status);
      if (filters.category && filters.category !== 'ALL') params.append('category', filters.category);
      if (filters.expedition_id) params.append('expedition_id', filters.expedition_id);
      if (filters.search) params.append('search', filters.search);
      if (filters.skip) params.append('skip', filters.skip);
      if (filters.limit) params.append('limit', filters.limit);

      const queryString = params.toString() ? `?${params.toString()}` : '';
      const res = await authFetch(`${BASE_URL}/api/inventory${queryString}`);
      return await handleResponse(res);
    } catch (err) {
      console.warn('[POLAR-X API] Failed to fetch inventory:', err.message);
      return null;
    }
  },

  async getInventorySummary() {
    try {
      const res = await authFetch(`${BASE_URL}/api/inventory/summary`);
      return await handleResponse(res);
    } catch (err) {
      console.warn('[POLAR-X API] Failed to fetch inventory summary:', err.message);
      return null;
    }
  },

  async getInventoryById(id) {
    try {
      const res = await authFetch(`${BASE_URL}/api/inventory/${id}`);
      return await handleResponse(res);
    } catch (err) {
      console.warn(`[POLAR-X API] Failed to fetch inventory item ${id}:`, err.message);
      return null;
    }
  },

  async createInventory(itemData) {
    const res = await authFetch(`${BASE_URL}/api/inventory`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(itemData)
    });
    return await handleResponse(res);
  },

  async updateInventory(id, itemData) {
    const res = await authFetch(`${BASE_URL}/api/inventory/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(itemData)
    });
    return await handleResponse(res);
  },

  async updateInventoryStock(id, stockData) {
    const res = await authFetch(`${BASE_URL}/api/inventory/${id}/stock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(stockData)
    });
    return await handleResponse(res);
  },

  async getInventoryHistory(id) {
    try {
      const res = await authFetch(`${BASE_URL}/api/inventory/${id}/history`);
      return await handleResponse(res);
    } catch (err) {
      console.warn(`[POLAR-X API] Failed to fetch history for inventory item ${id}:`, err.message);
      return [];
    }
  },

  async getExpeditionReadiness(expeditionId = null) {
    try {
      const endpoint = expeditionId 
        ? `${BASE_URL}/api/inventory/readiness/${expeditionId}` 
        : `${BASE_URL}/api/inventory/readiness`;
      const res = await fetch(endpoint);
      return await handleResponse(res);
    } catch (err) {
      console.warn('[POLAR-X API] Failed to fetch expedition readiness:', err.message);
      return [];
    }
  },

  // Personnel Management & Movement Tracking
  async getPersonnel(filters = {}) {
    try {
      const params = new URLSearchParams();
      if (filters.status && filters.status !== 'ALL') params.append('status', filters.status);
      if (filters.role && filters.role !== 'ALL') params.append('role', filters.role);
      if (filters.expedition_id) params.append('expedition_id', filters.expedition_id);
      if (filters.search) params.append('search', filters.search);
      if (filters.skip) params.append('skip', filters.skip);
      if (filters.limit) params.append('limit', filters.limit);

      const queryString = params.toString() ? `?${params.toString()}` : '';
      const res = await authFetch(`${BASE_URL}/api/personnel${queryString}`);
      return await handleResponse(res);
    } catch (err) {
      console.warn('[POLAR-X API] Failed to fetch personnel:', err.message);
      return null;
    }
  },

  async getPersonnelSummary() {
    try {
      const res = await authFetch(`${BASE_URL}/api/personnel/summary`);
      return await handleResponse(res);
    } catch (err) {
      console.warn('[POLAR-X API] Failed to fetch personnel summary:', err.message);
      return null;
    }
  },

  async getPersonnelLocations() {
    try {
      const res = await authFetch(`${BASE_URL}/api/personnel/locations`);
      return await handleResponse(res);
    } catch (err) {
      console.warn('[POLAR-X API] Failed to fetch personnel locations:', err.message);
      return [];
    }
  },

  async getPersonnelById(id) {
    try {
      const res = await authFetch(`${BASE_URL}/api/personnel/${id}`);
      return await handleResponse(res);
    } catch (err) {
      console.warn(`[POLAR-X API] Failed to fetch personnel #${id}:`, err.message);
      return null;
    }
  },

  async createPersonnel(personData) {
    const res = await authFetch(`${BASE_URL}/api/personnel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(personData)
    });
    return await handleResponse(res);
  },

  async updatePersonnel(id, personData) {
    const res = await authFetch(`${BASE_URL}/api/personnel/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(personData)
    });
    return await handleResponse(res);
  },

  async updatePersonnelLocation(id, locationData) {
    const res = await authFetch(`${BASE_URL}/api/personnel/${id}/location`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(locationData)
    });
    return await handleResponse(res);
  },

  async getPersonnelHistory(id) {
    try {
      const res = await authFetch(`${BASE_URL}/api/personnel/${id}/history`);
      return await handleResponse(res);
    } catch (err) {
      console.warn(`[POLAR-X API] Failed to fetch movement history for personnel #${id}:`, err.message);
      return [];
    }
  },

  // Alerts
  async getAlerts() {
    try {
      const res = await authFetch(`${BASE_URL}/api/alerts`);
      return await handleResponse(res);
    } catch (err) {
      console.warn('[POLAR-X API] Failed to fetch alerts:', err.message);
      return null;
    }
  },

  async createAlert(alertData) {
    const res = await authFetch(`${BASE_URL}/api/alerts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(alertData)
    });
    return await handleResponse(res);
  },

  async updateAlert(id, alertData) {
    const res = await authFetch(`${BASE_URL}/api/alerts/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(alertData)
    });
    return await handleResponse(res);
  },

  // Polar Stations & Facilities
  async getStations(filters = {}) {
    try {
      const params = new URLSearchParams();
      if (filters.type && filters.type !== 'ALL') params.append('type', filters.type);
      if (filters.region && filters.region !== 'ALL') params.append('region', filters.region);
      const qs = params.toString() ? `?${params.toString()}` : '';
      const res = await authFetch(`${BASE_URL}/api/stations${qs}`);
      return await handleResponse(res);
    } catch (err) {
      console.warn('[POLAR-X API] Failed to fetch stations:', err.message);
      return [];
    }
  },

  async createStation(stationData) {
    const res = await authFetch(`${BASE_URL}/api/stations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(stationData)
    });
    return await handleResponse(res);
  },

  async updateStation(stationId, stationData) {
    const res = await authFetch(`${BASE_URL}/api/stations/${stationId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(stationData)
    });
    return await handleResponse(res);
  },

  async deactivateStation(stationId) {
    const res = await authFetch(`${BASE_URL}/api/stations/${stationId}/deactivate`, {
      method: 'PATCH'
    });
    return await handleResponse(res);
  },

  async reactivateStation(stationId) {
    const res = await authFetch(`${BASE_URL}/api/stations/${stationId}/reactivate`, {
      method: 'PATCH'
    });
    return await handleResponse(res);
  },

  // Station Resource Requirements
  async getStationRequirements(stationId, activeOnly = true) {
    try {
      const res = await authFetch(`${BASE_URL}/api/stations/${stationId}/requirements?active_only=${activeOnly}`);
      return await handleResponse(res);
    } catch (err) {
      console.warn(`[POLAR-X API] Failed to fetch requirements for station ${stationId}:`, err.message);
      return [];
    }
  },

  async createStationRequirement(stationId, reqData) {
    const res = await authFetch(`${BASE_URL}/api/stations/${stationId}/requirements`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reqData)
    });
    return await handleResponse(res);
  },

  async updateStationRequirement(stationId, reqId, reqData) {
    const res = await authFetch(`${BASE_URL}/api/stations/${stationId}/requirements/${reqId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(reqData)
    });
    return await handleResponse(res);
  },

  async deactivateStationRequirement(stationId, reqId) {
    const res = await authFetch(`${BASE_URL}/api/stations/${stationId}/requirements/${reqId}`, {
      method: 'DELETE'
    });
    return await handleResponse(res);
  },

  // Station Daily Consumption Registry
  async getStationConsumption(stationId, filters = {}) {
    try {
      const params = new URLSearchParams();
      if (filters.start_date) params.append('start_date', filters.start_date);
      if (filters.end_date) params.append('end_date', filters.end_date);
      if (filters.limit) params.append('limit', String(filters.limit));
      const qs = params.toString() ? `?${params.toString()}` : '';
      const res = await authFetch(`${BASE_URL}/api/stations/${stationId}/consumption${qs}`);
      return await handleResponse(res);
    } catch (err) {
      console.warn(`[POLAR-X API] Failed to fetch consumption for station ${stationId}:`, err.message);
      return [];
    }
  },

  async createDailyConsumption(stationId, data) {
    const res = await authFetch(`${BASE_URL}/api/stations/${stationId}/consumption`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return await handleResponse(res);
  },

  // ─── TASK 7: Emergency Incidents ───────────────────────────────────────────

  async getIncidents(filters = {}) {
    try {
      const params = new URLSearchParams();
      if (filters.status && filters.status !== 'ALL') params.append('status', filters.status);
      if (filters.severity && filters.severity !== 'ALL') params.append('severity', filters.severity);
      if (filters.incident_type && filters.incident_type !== 'ALL') params.append('incident_type', filters.incident_type);
      if (filters.is_active !== undefined && filters.is_active !== null) params.append('is_active', filters.is_active);
      if (filters.assigned !== undefined && filters.assigned !== null) params.append('assigned', filters.assigned);
      if (filters.search) params.append('search', filters.search);
      if (filters.skip) params.append('skip', filters.skip);
      if (filters.limit) params.append('limit', filters.limit);
      const qs = params.toString() ? `?${params.toString()}` : '';
      const res = await authFetch(`${BASE_URL}/api/incidents${qs}`);
      return await handleResponse(res);
    } catch (err) {
      console.warn('[POLAR-X API] Failed to fetch incidents:', err.message);
      return null;
    }
  },

  async getActiveIncidents() {
    try {
      const res = await authFetch(`${BASE_URL}/api/incidents/active`);
      return await handleResponse(res);
    } catch (err) {
      console.warn('[POLAR-X API] Failed to fetch active incidents:', err.message);
      return [];
    }
  },

  async getIncidentSummary() {
    try {
      const res = await authFetch(`${BASE_URL}/api/incidents/summary`);
      return await handleResponse(res);
    } catch (err) {
      console.warn('[POLAR-X API] Failed to fetch incident summary:', err.message);
      return null;
    }
  },

  async getIncidentLocations() {
    try {
      const res = await authFetch(`${BASE_URL}/api/incidents/locations`);
      return await handleResponse(res);
    } catch (err) {
      console.warn('[POLAR-X API] Failed to fetch incident locations:', err.message);
      return [];
    }
  },

  async getIncidentById(id) {
    try {
      const res = await authFetch(`${BASE_URL}/api/incidents/${id}`);
      return await handleResponse(res);
    } catch (err) {
      console.warn(`[POLAR-X API] Failed to fetch incident #${id}:`, err.message);
      return null;
    }
  },

  async createIncident(incidentData) {
    const res = await authFetch(`${BASE_URL}/api/incidents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(incidentData)
    });
    return await handleResponse(res);
  },

  async updateIncident(id, updateData) {
    const res = await authFetch(`${BASE_URL}/api/incidents/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updateData)
    });
    return await handleResponse(res);
  },

  async getIncidentHistory(id) {
    try {
      const res = await authFetch(`${BASE_URL}/api/incidents/${id}/history`);
      return await handleResponse(res);
    } catch (err) {
      console.warn(`[POLAR-X API] Failed to fetch history for incident #${id}:`, err.message);
      return [];
    }
  },

  async getRecommendedUnits(incidentId) {
    try {
      const res = await authFetch(`${BASE_URL}/api/incidents/${incidentId}/recommend-units`);
      return await handleResponse(res);
    } catch (err) {
      console.warn(`[POLAR-X API] Failed to fetch unit recommendations for incident #${incidentId}:`, err.message);
      return [];
    }
  },

  async acknowledgeIncident(id, body = {}) {
    const res = await authFetch(`${BASE_URL}/api/incidents/${id}/acknowledge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    return await handleResponse(res);
  },

  async triageIncident(id, body) {
    const res = await authFetch(`${BASE_URL}/api/incidents/${id}/triage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    return await handleResponse(res);
  },

  async assignIncidentUnit(id, body) {
    const res = await authFetch(`${BASE_URL}/api/incidents/${id}/assign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    return await handleResponse(res);
  },

  async dispatchIncident(id, body = {}) {
    const res = await authFetch(`${BASE_URL}/api/incidents/${id}/dispatch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    return await handleResponse(res);
  },

  async startIncident(id, body = {}) {
    const res = await authFetch(`${BASE_URL}/api/incidents/${id}/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    return await handleResponse(res);
  },

  async resolveIncident(id, body) {
    const res = await authFetch(`${BASE_URL}/api/incidents/${id}/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    return await handleResponse(res);
  },

  async cancelIncident(id, body = {}) {
    const res = await authFetch(`${BASE_URL}/api/incidents/${id}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    return await handleResponse(res);
  },

  // ─── TASK 7: Response Units ─────────────────────────────────────────────────

  async getResponseUnits(filters = {}) {
    try {
      const params = new URLSearchParams();
      if (filters.status && filters.status !== 'ALL') params.append('status', filters.status);
      if (filters.unit_type && filters.unit_type !== 'ALL') params.append('unit_type', filters.unit_type);
      if (filters.search) params.append('search', filters.search);
      const qs = params.toString() ? `?${params.toString()}` : '';
      const res = await authFetch(`${BASE_URL}/api/response-units${qs}`);
      return await handleResponse(res);
    } catch (err) {
      console.warn('[POLAR-X API] Failed to fetch response units:', err.message);
      return null;
    }
  },

  async getResponseUnitLocations() {
    try {
      const res = await authFetch(`${BASE_URL}/api/response-units/locations`);
      return await handleResponse(res);
    } catch (err) {
      console.warn('[POLAR-X API] Failed to fetch response unit locations:', err.message);
      return [];
    }
  },

  async getResponseUnitById(id) {
    try {
      const res = await authFetch(`${BASE_URL}/api/response-units/${id}`);
      return await handleResponse(res);
    } catch (err) {
      console.warn(`[POLAR-X API] Failed to fetch response unit #${id}:`, err.message);
      return null;
    }
  },

  async createResponseUnit(unitData) {
    const res = await authFetch(`${BASE_URL}/api/response-units`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(unitData)
    });
    return await handleResponse(res);
  },

  async updateResponseUnit(id, updateData) {
    const res = await authFetch(`${BASE_URL}/api/response-units/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updateData)
    });
    return await handleResponse(res);
  },

  // ─── TASK 7: Personnel SOS ─────────────────────────────────────────────────

  async triggerPersonnelSOS(personnelId, body = {}) {
    const res = await authFetch(`${BASE_URL}/api/personnel/${personnelId}/sos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    return await handleResponse(res);
  },

  // ─── TASK 8: Reports & Analytics ───────────────────────────────────────────

  async getReportsSummary() {
    try {
      const res = await authFetch(`${BASE_URL}/api/reports/summary`);
      return await handleResponse(res);
    } catch (err) {
      console.warn('[POLAR-X API] Failed to fetch reports summary:', err.message);
      return null;
    }
  },

  async getReportsExpeditions(filters = {}) {
    try {
      const params = new URLSearchParams();
      if (filters.status && filters.status !== 'ALL') params.append('status', filters.status);
      if (filters.search) params.append('search', filters.search);
      const qs = params.toString() ? `?${params.toString()}` : '';
      const res = await authFetch(`${BASE_URL}/api/reports/expeditions${qs}`);
      return await handleResponse(res);
    } catch (err) {
      console.warn('[POLAR-X API] Failed to fetch expeditions report:', err.message);
      return [];
    }
  },

  async getReportsCargo(filters = {}) {
    try {
      const params = new URLSearchParams();
      if (filters.expedition_id && filters.expedition_id !== 'ALL') params.append('expedition_id', filters.expedition_id);
      if (filters.status && filters.status !== 'ALL') params.append('status', filters.status);
      if (filters.category && filters.category !== 'ALL') params.append('category', filters.category);
      if (filters.priority && filters.priority !== 'ALL') params.append('priority', filters.priority);
      if (filters.search) params.append('search', filters.search);
      const qs = params.toString() ? `?${params.toString()}` : '';
      const res = await authFetch(`${BASE_URL}/api/reports/cargo${qs}`);
      return await handleResponse(res);
    } catch (err) {
      console.warn('[POLAR-X API] Failed to fetch cargo report:', err.message);
      return [];
    }
  },

  async getReportsInventory(filters = {}) {
    try {
      const params = new URLSearchParams();
      if (filters.expedition_id && filters.expedition_id !== 'ALL') params.append('expedition_id', filters.expedition_id);
      if (filters.category && filters.category !== 'ALL') params.append('category', filters.category);
      if (filters.status && filters.status !== 'ALL') params.append('status', filters.status);
      if (filters.search) params.append('search', filters.search);
      const qs = params.toString() ? `?${params.toString()}` : '';
      const res = await authFetch(`${BASE_URL}/api/reports/inventory${qs}`);
      return await handleResponse(res);
    } catch (err) {
      console.warn('[POLAR-X API] Failed to fetch inventory report:', err.message);
      return [];
    }
  },

  async getReportsPersonnel(filters = {}) {
    try {
      const params = new URLSearchParams();
      if (filters.expedition_id && filters.expedition_id !== 'ALL') params.append('expedition_id', filters.expedition_id);
      if (filters.role && filters.role !== 'ALL') params.append('role', filters.role);
      if (filters.department && filters.department !== 'ALL') params.append('department', filters.department);
      if (filters.status && filters.status !== 'ALL') params.append('status', filters.status);
      if (filters.search) params.append('search', filters.search);
      const qs = params.toString() ? `?${params.toString()}` : '';
      const res = await authFetch(`${BASE_URL}/api/reports/personnel${qs}`);
      return await handleResponse(res);
    } catch (err) {
      console.warn('[POLAR-X API] Failed to fetch personnel report:', err.message);
      return [];
    }
  },

  async getReportsIncidents(filters = {}) {
    try {
      const params = new URLSearchParams();
      if (filters.severity && filters.severity !== 'ALL') params.append('severity', filters.severity);
      if (filters.status && filters.status !== 'ALL') params.append('status', filters.status);
      if (filters.incident_type && filters.incident_type !== 'ALL') params.append('incident_type', filters.incident_type);
      if (filters.is_active !== undefined && filters.is_active !== null && filters.is_active !== 'ALL') {
        params.append('is_active', filters.is_active);
      }
      if (filters.search) params.append('search', filters.search);
      const qs = params.toString() ? `?${params.toString()}` : '';
      const res = await authFetch(`${BASE_URL}/api/reports/incidents${qs}`);
      return await handleResponse(res);
    } catch (err) {
      console.warn('[POLAR-X API] Failed to fetch incidents report:', err.message);
      return [];
    }
  },

  // ─── TASK 10: Smart Automation & Predictive Operations ─────────────────────

  async getAutomationSummary() {
    try {
      const res = await authFetch(`${BASE_URL}/api/automation/summary`);
      return await handleResponse(res);
    } catch (err) {
      console.warn('[POLAR-X API] Failed to fetch automation summary:', err.message);
      return null;
    }
  },

  async getExpeditionReadinessAnalysis() {
    try {
      const res = await authFetch(`${BASE_URL}/api/automation/expedition-readiness`);
      return await handleResponse(res);
    } catch (err) {
      console.warn('[POLAR-X API] Failed to fetch expedition readiness analysis:', err.message);
      return [];
    }
  },

  async getInventoryRiskAnalysis() {
    try {
      const res = await authFetch(`${BASE_URL}/api/automation/inventory-risk`);
      return await handleResponse(res);
    } catch (err) {
      console.warn('[POLAR-X API] Failed to fetch inventory risk analysis:', err.message);
      return [];
    }
  },

  async getCargoRiskAnalysis() {
    try {
      const res = await authFetch(`${BASE_URL}/api/automation/cargo-risk`);
      return await handleResponse(res);
    } catch (err) {
      console.warn('[POLAR-X API] Failed to fetch cargo risk analysis:', err.message);
      return [];
    }
  },

  async getPersonnelRiskAnalysis() {
    try {
      const res = await authFetch(`${BASE_URL}/api/automation/personnel-risk`);
      return await handleResponse(res);
    } catch (err) {
      console.warn('[POLAR-X API] Failed to fetch personnel risk analysis:', err.message);
      return [];
    }
  },

  async getEmergencyPriorityQueue() {
    try {
      const res = await authFetch(`${BASE_URL}/api/automation/emergency-priority`);
      return await handleResponse(res);
    } catch (err) {
      console.warn('[POLAR-X API] Failed to fetch emergency priority queue:', err.message);
      return [];
    }
  },

  async getAutomationRecommendations() {
    try {
      const res = await authFetch(`${BASE_URL}/api/automation/recommendations`);
      return await handleResponse(res);
    } catch (err) {
      console.warn('[POLAR-X API] Failed to fetch automation recommendations:', err.message);
      return [];
    }
  },

  // ─── System Settings (Task 11) ──────────────────────────────────────────
  async getSettings() {
    try {
      const res = await authFetch(`${BASE_URL}/api/settings`);
      return await handleResponse(res);
    } catch (err) {
      console.warn('[POLAR-X API] Failed to fetch settings:', err.message);
      throw err;
    }
  },

  async getSettingsDetail() {
    try {
      const res = await authFetch(`${BASE_URL}/api/settings/all`);
      return await handleResponse(res);
    } catch (err) {
      console.warn('[POLAR-X API] Failed to fetch detailed settings list:', err.message);
      throw err;
    }
  },

  async updateSettings(updates) {
    // updates can be array of {key, value} or { updates: [...] } or key/value dict
    const payload = Array.isArray(updates) ? { updates } : (updates.updates ? updates : { updates: Object.entries(updates).map(([k, v]) => ({ key: k, value: String(v) })) });
    const res = await authFetch(`${BASE_URL}/api/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return await handleResponse(res);
  },

  async patchSettings(updates) {
    const payload = Array.isArray(updates) ? { updates } : (updates.updates ? updates : { updates: Object.entries(updates).map(([k, v]) => ({ key: k, value: String(v) })) });
    const res = await authFetch(`${BASE_URL}/api/settings`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return await handleResponse(res);
  },

  async getSettingsDefaults() {
    try {
      const res = await authFetch(`${BASE_URL}/api/settings/defaults`);
      return await handleResponse(res);
    } catch (err) {
      console.warn('[POLAR-X API] Failed to fetch defaults:', err.message);
      throw err;
    }
  }
};




