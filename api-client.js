/**
 * AgriTrace X — Frontend API Client
 * Replaces all mock/session data with real backend calls.
 */

const API_BASE = 'http://localhost:3000/api';

const AgriAPI = (() => {

  // ── Token management ─────────────────────────────────────────────────────
  const getToken  = () => localStorage.getItem('agriToken');
  const setToken  = (t) => localStorage.setItem('agriToken', t);
  const clearAuth = () => { localStorage.removeItem('agriToken'); localStorage.removeItem('agriUser'); };

  const headers = () => ({
    'Content-Type': 'application/json',
    ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
  });

  const request = async (method, path, body = null) => {
    try {
      const opts = { method, headers: headers() };
      if (body) opts.body = JSON.stringify(body);
      const res = await fetch(`${API_BASE}${path}`, opts);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Request failed');
      return data;
    } catch (err) {
      console.error(`API [${method} ${path}]:`, err.message);
      throw err;
    }
  };

  // ── Auth ─────────────────────────────────────────────────────────────────
  const login = async (userId, password) => {
    const data = await request('POST', '/auth/login', { userId, password });
    setToken(data.token);
    localStorage.setItem('agriUser', JSON.stringify(data.user));
    return data.user;
  };

  const logout = () => { clearAuth(); window.location.href = 'index.html'; };

  const getCurrentUser = () => {
    try { return JSON.parse(localStorage.getItem('agriUser')); }
    catch { return null; }
  };

  const verifyToken = async () => {
    if (!getToken()) return null;
    try { const d = await request('GET', '/auth/me'); return d.user; }
    catch { clearAuth(); return null; }
  };

  // ── Farmer ───────────────────────────────────────────────────────────────
  const getFarmerDashboard = () => request('GET', '/farmer/dashboard');
  const saveFarm   = (data)       => request('POST', '/farmer/farm', data);
  const updateFarm = (id, data)   => request('PUT', `/farmer/farm/${id}`, data);
  const saveCrop   = (data)       => request('POST', '/farmer/crop', data);
  const updateCrop = (id, data)   => request('PUT', `/farmer/crop/${id}`, data);
  const addFertilizer = (cropId, entry) => request('POST', `/farmer/crop/${cropId}/fertilizer`, entry);
  const logIrrigation = (cropId, entry) => request('POST', `/farmer/crop/${cropId}/irrigation`, entry);
  const fileClaim = (data)        => request('POST', '/farmer/claim', data);

  // ── Drone ────────────────────────────────────────────────────────────────
  const getMissions    = ()         => request('GET', '/drone/missions');
  const createMission  = (data)     => request('POST', '/drone/mission', data);
  const updateMission  = (id, data) => request('PUT', `/drone/mission/${id}/status`, data);
  const uploadImage    = (id, data) => request('POST', `/drone/mission/${id}/image`, data);

  // ── Analyst ──────────────────────────────────────────────────────────────
  const getSurveys       = () => request('GET', '/analyst/surveys');
  const getDistrictSummary = () => request('GET', '/analyst/district-summary');

  // ── Insurance ────────────────────────────────────────────────────────────
  const getClaims     = ()         => request('GET', '/insurance/claims');
  const updateClaim   = (id, data) => request('PUT', `/insurance/claim/${id}`, data);

  // ── Admin ─────────────────────────────────────────────────────────────────
  const getUsers      = ()         => request('GET', '/admin/users');
  const createUser    = (data)     => request('POST', '/admin/user', data);
  const updateUser    = (id, data) => request('PUT', `/admin/user/${id}`, data);
  const getOverview   = ()         => request('GET', '/admin/overview');

  // ── AI Intelligence ────────────────────────────────────────────────────────
  const getAIFull       = (cropId) => request('GET', cropId ? `/ai/full?cropId=${cropId}` : '/ai/full');
  const getAIIrrigation = (cropId) => request('GET', cropId ? `/ai/irrigation?cropId=${cropId}` : '/ai/irrigation');
  const getAIFertilizer = (cropId) => request('GET', cropId ? `/ai/fertilizer?cropId=${cropId}` : '/ai/fertilizer');
  const getAIYield      = (cropId) => request('GET', cropId ? `/ai/yield?cropId=${cropId}` : '/ai/yield');
  const getAIDisaster   = (cropId) => request('GET', cropId ? `/ai/disaster?cropId=${cropId}` : '/ai/disaster');
  const getAIDistrict   = ()       => request('GET', '/ai/district');
  const analyzeCustom   = (payload)=> request('POST', '/ai/analyze', payload);

  return {
    login, logout, getCurrentUser, verifyToken, getToken,
    getFarmerDashboard, saveFarm, updateFarm, saveCrop, updateCrop, addFertilizer, logIrrigation, fileClaim,
    getMissions, createMission, updateMission, uploadImage,
    getSurveys, getDistrictSummary,
    getClaims, updateClaim,
    getUsers, createUser, updateUser, getOverview,
    getAIFull, getAIIrrigation, getAIFertilizer, getAIYield, getAIDisaster, getAIDistrict, analyzeCustom,
  };
})();
