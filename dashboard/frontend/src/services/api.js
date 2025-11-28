/**
 * API Service Layer
 * Handles all communication with the Flask backend
 * Includes authentication, error handling, and request/response interceptors
 */

import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api';

// Create axios instance with default config
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Session storage key
const SESSION_KEY = 'aruba_session_id';

/**
 * Get stored session ID
 */
const getSessionId = () => {
  return localStorage.getItem(SESSION_KEY);
};

/**
 * Store session ID
 */
const setSessionId = (sessionId) => {
  localStorage.setItem(SESSION_KEY, sessionId);
};

/**
 * Clear session ID
 */
const clearSessionId = () => {
  localStorage.removeItem(SESSION_KEY);
};

// Request interceptor to add session ID
apiClient.interceptors.request.use(
  (config) => {
    const sessionId = getSessionId();
    if (sessionId) {
      config.headers['X-Session-ID'] = sessionId;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Session expired or invalid
      clearSessionId();
      window.location.href = '/login';
    }
    
    // Suppress console errors for expected failures (400/404) on optional endpoints
    // These are handled gracefully by the calling code
    const url = error.config?.url || '';
    const isOptionalEndpoint = 
      url.includes('/switches/') && url.includes('/details') ||
      url.includes('/monitoring/switches/') && url.includes('/power') ||
      url.includes('/monitoring/aps/') && url.includes('/power');
    
    if (isOptionalEndpoint && [400, 404].includes(error.response?.status)) {
      // Silently handle - these are expected for some devices
      // Don't log to console or show error
    } else {
      // Enhance error message with backend error details if available
      if (error.response?.data) {
        const data = error.response.data;
        // If backend provides a detailed error message, use it
        if (data.error && typeof data.error === 'string') {
          error.message = data.error;
        } else if (data.message && typeof data.message === 'string') {
          error.message = data.message;
        } else if (typeof data === 'string') {
          error.message = data;
        }
      }
    }
    
    return Promise.reject(error);
  }
);

/**
 * Authentication API
 */
export const authAPI = {
  login: async () => {
    try {
      const response = await apiClient.post('/auth/login');
      if (response.data.session_id) {
        setSessionId(response.data.session_id);
      }
      return response.data;
    } catch (error) {
      throw new Error(error.response?.data?.error || 'Login failed');
    }
  },

  logout: async () => {
    try {
      await apiClient.post('/auth/logout');
    } finally {
      clearSessionId();
    }
  },

  getStatus: async () => {
    const response = await apiClient.get('/auth/status');
    return response.data;
  },

  isAuthenticated: () => {
    return !!getSessionId();
  },
};

/**
 * Device Management API
 */
export const deviceAPI = {
  getAll: async () => {
    const response = await apiClient.get('/devices');
    return response.data;
  },

  getDetails: async (serial) => {
    const response = await apiClient.get(`/devices/${serial}`);
    return response.data;
  },

  getSwitches: async () => {
    const response = await apiClient.get('/switches');
    return response.data;
  },

  getAccessPoints: async () => {
    const response = await apiClient.get('/aps');
    return response.data;
  },

  getSwitchDetails: async (serial, siteId) => {
    const params = siteId ? { site_id: siteId } : {};
    try {
      // Mark as optional - don't throw on 400/404
      const response = await apiClient.get(`/switches/${serial}/details`, { 
        params,
        validateStatus: (status) => status < 500, // Don't throw on 4xx, only 5xx
      });
      if (response.status >= 400) {
        // Return null for expected failures instead of throwing
        return null;
      }
      return response.data;
    } catch (error) {
      // Only throw for unexpected errors (5xx)
      if (error.response?.status >= 500) {
        throw error;
      }
      // Return null for expected failures
      return null;
    }
  },

  getAPDetails: async (serial) => {
    const response = await apiClient.get(`/aps/${serial}/details`);
    return response.data;
  },

  getSwitchInterfaces: async (serial, siteId) => {
    try {
      const params = siteId ? { 'site-id': siteId } : {};
      const response = await apiClient.get(`/switches/${serial}/interfaces`, {
        params,
        validateStatus: (status) => status < 500,
      });
      if (response.status >= 400) {
        return null;
      }
      return response.data;
    } catch (error) {
      if (error.response?.status >= 500) {
        throw error;
      }
      return null;
    }
  },

  runSwitchShowCommand: async (serial, command) => {
    try {
      const response = await apiClient.post(`/switches/${serial}/show-command`, {
        command: command,
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  getSwitchShowCommandResult: async (serial, taskId) => {
    try {
      const response = await apiClient.get(`/switches/${serial}/show-command/${taskId}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  getDeviceParameters: async (platformModel = null) => {
    const url = platformModel
      ? `/device-parameters/${platformModel}`
      : '/device-parameters';
    const response = await apiClient.get(url);
    return response.data;
  },

  getAPPowerConsumption: async (serial) => {
    const response = await apiClient.get(`/aps/${serial}/power-consumption`);
    return response.data;
  },
};

/**
 * Configuration API (Legacy - use configAPI.* below for network-config/v1alpha1)
 */
export const configAPI = {
  getSites: async () => {
    const response = await apiClient.get('/sites');
    return response.data;
  },

  getSiteDetails: async (siteId) => {
    const response = await apiClient.get(`/sites/${siteId}`);
    return response.data;
  },

  createSite: async (siteData) => {
    const response = await apiClient.post('/sites', siteData);
    return response.data;
  },

  deleteSite: async (siteId) => {
    const response = await apiClient.delete(`/sites/${siteId}`);
    return response.data;
  },

  getGroups: async () => {
    const response = await apiClient.get('/groups');
    return response.data;
  },

  getTemplates: async () => {
    const response = await apiClient.get('/templates');
    return response.data;
  },

  // ============= Network Config v1alpha1 APIs - Organized by Category =============

  // Scope Management
  scopeManagement: {
    getSites: async (params = {}) => {
      const response = await apiClient.get('/config/sites', { params });
      return response.data;
    },
    createSite: async (siteData) => {
      const response = await apiClient.post('/config/sites', siteData);
      return response.data;
    },
    updateSite: async (siteData) => {
      const response = await apiClient.put('/config/sites', siteData);
      return response.data;
    },
    deleteSite: async (scopeId) => {
      const response = await apiClient.delete('/config/sites', {
        params: { 'scope-id': scopeId },
      });
      return response.data;
    },
    bulkDeleteSites: async (scopeIds) => {
      const response = await apiClient.delete('/config/sites/bulk-delete', {
        data: { scopeIds },
      });
      return response.data;
    },
    getSiteCollections: async (params = {}) => {
      const response = await apiClient.get('/config/site-collections', { params });
      return response.data;
    },
    createSiteCollection: async (collectionData) => {
      const response = await apiClient.post('/config/site-collections', collectionData);
      return response.data;
    },
    updateSiteCollection: async (collectionData) => {
      const response = await apiClient.put('/config/site-collections', collectionData);
      return response.data;
    },
    deleteSiteCollection: async (scopeId) => {
      const response = await apiClient.delete('/config/site-collections', {
        params: { 'scope-id': scopeId },
      });
      return response.data;
    },
    addSitesToCollection: async (collectionId, siteIds) => {
      const response = await apiClient.post('/config/site-collections/add-sites', {
        collectionId,
        siteIds,
      });
      return response.data;
    },
    removeSitesFromCollection: async (collectionId, siteIds) => {
      const response = await apiClient.delete('/config/site-collections/remove-sites', {
        data: { collectionId, siteIds },
      });
      return response.data;
    },
    getDeviceGroups: async (params = {}) => {
      const response = await apiClient.get('/config/device-groups', { params });
      return response.data;
    },
    getScopeHierarchy: async (params = {}) => {
      const response = await apiClient.get('/config/scope-hierarchy', { params });
      return response.data;
    },
    getTemplates: async () => {
      const response = await apiClient.get('/config/templates/sites');
      return response.data;
    },
    downloadTemplate: async (templateId) => {
      const response = await apiClient.get(`/config/templates/sites/${templateId}`, {
        responseType: 'blob',
      });
      return response.data;
    },
    import: async (file, templateId, options = {}) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('template_id', templateId);
      Object.entries(options).forEach(([key, value]) => {
        formData.append(key, value);
      });
      const response = await apiClient.post('/config/sites/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return response.data;
    },
    export: async (format = 'csv', filters = {}) => {
      const response = await apiClient.get('/config/sites/export', {
        params: { format, ...filters },
        responseType: 'blob',
      });
      return response.data;
    },
  },

  // Application Experience
  applicationExperience: {
    getAirgroupSystem: async () => {
      const response = await apiClient.get('/config/airgroup-system');
      return response.data;
    },
    createAirgroupSystem: async (systemData) => {
      const response = await apiClient.post('/config/airgroup-system', systemData);
      return response.data;
    },
    updateAirgroupSystem: async (systemData) => {
      const response = await apiClient.patch('/config/airgroup-system', systemData);
      return response.data;
    },
    deleteAirgroupSystem: async () => {
      const response = await apiClient.delete('/config/airgroup-system');
      return response.data;
    },
    getARCProfile: async (name) => {
      const response = await apiClient.get(`/config/app-recog-control/${name}`);
      return response.data;
    },
    createARCProfile: async (name, profileData) => {
      const response = await apiClient.post(`/config/app-recog-control/${name}`, profileData);
      return response.data;
    },
    updateARCProfile: async (name, profileData) => {
      const response = await apiClient.patch(`/config/app-recog-control/${name}`, profileData);
      return response.data;
    },
    deleteARCProfile: async (name) => {
      const response = await apiClient.delete(`/config/app-recog-control/${name}`);
      return response.data;
    },
    getUCCProfile: async (name) => {
      const response = await apiClient.get(`/config/ucc/${name}`);
      return response.data;
    },
    createUCCProfile: async (name, profileData) => {
      const response = await apiClient.post(`/config/ucc/${name}`, profileData);
      return response.data;
    },
    updateUCCProfile: async (name, profileData) => {
      const response = await apiClient.patch(`/config/ucc/${name}`, profileData);
      return response.data;
    },
    deleteUCCProfile: async (name) => {
      const response = await apiClient.delete(`/config/ucc/${name}`);
      return response.data;
    },
    getAirgroupPolicies: async () => {
      const response = await apiClient.get('/config/airgroup-policy');
      return response.data;
    },
    createAirgroupPolicy: async (policyData) => {
      const response = await apiClient.post('/config/airgroup-policy', policyData);
      return response.data;
    },
    updateAirgroupPolicy: async (policyId, policyData) => {
      const response = await apiClient.patch(`/config/airgroup-policy/${policyId}`, policyData);
      return response.data;
    },
    deleteAirgroupPolicy: async (policyId) => {
      const response = await apiClient.delete(`/config/airgroup-policy/${policyId}`);
      return response.data;
    },
  },

  // Central NAC
  centralNAC: {
    getAuthzPolicy: async () => {
      const response = await apiClient.get('/config/cda-authz-policy');
      return response.data;
    },
    createAuthzPolicy: async (policyData) => {
      const response = await apiClient.post('/config/cda-authz-policy', policyData);
      return response.data;
    },
    updateAuthzPolicy: async (policyData) => {
      const response = await apiClient.patch('/config/cda-authz-policy', policyData);
      return response.data;
    },
    deleteAuthzPolicy: async () => {
      const response = await apiClient.delete('/config/cda-authz-policy');
      return response.data;
    },
    getIdentityStore: async () => {
      const response = await apiClient.get('/config/cda-identity-store');
      return response.data;
    },
    createIdentityStore: async (storeData) => {
      const response = await apiClient.post('/config/cda-identity-store', storeData);
      return response.data;
    },
    updateIdentityStore: async (storeData) => {
      const response = await apiClient.patch('/config/cda-identity-store', storeData);
      return response.data;
    },
    deleteIdentityStore: async () => {
      const response = await apiClient.delete('/config/cda-identity-store');
      return response.data;
    },
    getPortalProfile: async (name) => {
      const response = await apiClient.get(`/config/cda-portal-profile/${name}`);
      return response.data;
    },
    createPortalProfile: async (name, profileData) => {
      const response = await apiClient.post(`/config/cda-portal-profile/${name}`, profileData);
      return response.data;
    },
    updatePortalProfile: async (name, profileData) => {
      const response = await apiClient.patch(`/config/cda-portal-profile/${name}`, profileData);
      return response.data;
    },
    deletePortalProfile: async (name) => {
      const response = await apiClient.delete(`/config/cda-portal-profile/${name}`);
      return response.data;
    },
    getAuthProfile: async () => {
      const response = await apiClient.get('/config/cda-auth-profile');
      return response.data;
    },
    createAuthProfile: async (profileData) => {
      const response = await apiClient.post('/config/cda-auth-profile', profileData);
      return response.data;
    },
    updateAuthProfile: async (profileData) => {
      const response = await apiClient.patch('/config/cda-auth-profile', profileData);
      return response.data;
    },
    deleteAuthProfile: async () => {
      const response = await apiClient.delete('/config/cda-auth-profile');
      return response.data;
    },
  },

  // Central NAC Service
  nacService: {
    getMACRegistrations: async (params = {}) => {
      const response = await apiClient.get('/config/nac/mac-registration', { params });
      return response.data;
    },
    createMACRegistration: async (registrationData) => {
      const response = await apiClient.post('/config/nac/mac-registration', registrationData);
      return response.data;
    },
    updateMACRegistration: async (macId, registrationData) => {
      const response = await apiClient.put(`/config/nac/mac-registration/${macId}`, registrationData);
      return response.data;
    },
    deleteMACRegistration: async (macId) => {
      const response = await apiClient.delete(`/config/nac/mac-registration/${macId}`);
      return response.data;
    },
    exportMACRegistrations: async () => {
      const response = await apiClient.get('/config/nac/mac-registration/export', {
        responseType: 'blob',
      });
      return response.data;
    },
    importMACRegistrations: async (file) => {
      const formData = new FormData();
      formData.append('file', file);
      const response = await apiClient.post('/config/nac/mac-registration/import', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return response.data;
    },
    getMPSKRegistrations: async (params = {}) => {
      const response = await apiClient.get('/config/nac/mpsk-registration', { params });
      return response.data;
    },
    createMPSKRegistration: async (registrationData) => {
      const response = await apiClient.post('/config/nac/mpsk-registration', registrationData);
      return response.data;
    },
    deleteMPSKRegistration: async (id) => {
      const response = await apiClient.delete(`/config/nac/mpsk-registration/${id}`);
      return response.data;
    },
    getVisitors: async (params = {}) => {
      const response = await apiClient.get('/config/nac/visitor', { params });
      return response.data;
    },
    createVisitor: async (visitorData) => {
      const response = await apiClient.post('/config/nac/visitor', visitorData);
      return response.data;
    },
    deleteVisitor: async (id) => {
      const response = await apiClient.delete(`/config/nac/visitor/${id}`);
      return response.data;
    },
    getJobs: async (params = {}) => {
      const response = await apiClient.get('/config/nac/job', { params });
      return response.data;
    },
    getImages: async (params = {}) => {
      const response = await apiClient.get('/config/nac/image', { params });
      return response.data;
    },
    deleteImage: async (id) => {
      const response = await apiClient.delete(`/config/nac/image/${id}`);
      return response.data;
    },
    getUserCertificates: async (params = {}) => {
      const response = await apiClient.get('/config/nac/user-certificate', { params });
      return response.data;
    },
    deleteUserCertificate: async (id) => {
      const response = await apiClient.delete(`/config/nac/user-certificate/${id}`);
      return response.data;
    },
  },

  // Config Management
  configManagement: {
    getCheckpoints: async (params = {}) => {
      const response = await apiClient.get('/config/checkpoint', { params });
      return response.data;
    },
    createCheckpoint: async (checkpointData) => {
      const response = await apiClient.post('/config/checkpoint', checkpointData);
      return response.data;
    },
  },

  // Configuration Health
  configHealth: {
    getDeviceHealth: async (deviceId) => {
      const response = await apiClient.get('/config/health/device', {
        params: { device_id: deviceId },
      });
      return response.data;
    },
    getHealthSummary: async (params = {}) => {
      const response = await apiClient.get('/config/health/summary', { params });
      return response.data;
    },
    getActiveIssues: async (serial) => {
      const response = await apiClient.get('/config/health/active-issue', {
        params: { serial },
      });
      return response.data;
    },
  },

  // Wireless
  wireless: {
    getWLANs: async (params = {}) => {
      const response = await apiClient.get('/config/wlan', { params });
      return response.data;
    },
    getWLAN: async (name) => {
      const response = await apiClient.get(`/config/wlan/${name}`);
      return response.data;
    },
    createWLAN: async (name, wlanData, queryParams = {}) => {
      const queryString = Object.keys(queryParams).length > 0
        ? '?' + new URLSearchParams(queryParams).toString()
        : '';
      const response = await apiClient.post(`/config/wlan/${name}${queryString}`, wlanData);
      return response.data;
    },
    updateWLAN: async (name, wlanData) => {
      const response = await apiClient.patch(`/config/wlan/${name}`, wlanData);
      return response.data;
    },
    deleteWLAN: async (name) => {
      const response = await apiClient.delete(`/config/wlan/${name}`);
      return response.data;
    },
    getRadio: async (name) => {
      const response = await apiClient.get(`/config/radio/${name}`);
      return response.data;
    },
  },

  // VLANs & Networks
  vlansNetworks: {
    getVLANs: async (params = {}) => {
      const response = await apiClient.get('/config/vlan', { params });
      return response.data;
    },
    getVLAN: async (vlanId) => {
      const response = await apiClient.get(`/config/vlan/${vlanId}`);
      return response.data;
    },
    createVLAN: async (vlanId, vlanData) => {
      const response = await apiClient.post(`/config/vlan/${vlanId}`, vlanData);
      return response.data;
    },
    // Named VLAN operations
    getNamedVLANs: async (params = {}) => {
      const response = await apiClient.get('/config/named-vlan', { params });
      return response.data;
    },
    getNamedVLAN: async (name) => {
      const response = await apiClient.get(`/config/named-vlan/${name}`);
      return response.data;
    },
    createNamedVLAN: async (name, vlanData) => {
      const response = await apiClient.post(`/config/named-vlan/${name}`, vlanData);
      return response.data;
    },
    // Helper to check if VLAN exists
    vlanExists: async (vlanId) => {
      try {
        await apiClient.get(`/config/vlan/${vlanId}`);
        return true;
      } catch (error) {
        if (error.response?.status === 404) {
          return false;
        }
        throw error;
      }
    },
  },

  // Roles & Policies
  rolesPolicies: {
    // Roles
    getRoles: async (params = {}) => {
      const response = await apiClient.get('/config/roles', { params });
      return response.data;
    },
    getRole: async (roleName) => {
      const response = await apiClient.get(`/config/roles/${roleName}`);
      return response.data;
    },
    createRole: async (roleName, roleData, queryParams = {}) => {
      const queryString = Object.keys(queryParams).length > 0
        ? '?' + new URLSearchParams(queryParams).toString()
        : '';
      const response = await apiClient.post(`/config/roles/${roleName}${queryString}`, roleData);
      return response.data;
    },
    // Role-GPIDs
    createRoleGpid: async (roleName, gpidData) => {
      const response = await apiClient.post(`/config/role-gpids/${roleName}`, gpidData);
      return response.data;
    },
    // Policies
    getPolicies: async (params = {}) => {
      const response = await apiClient.get('/config/policies', { params });
      return response.data;
    },
    getPolicy: async (policyName) => {
      const response = await apiClient.get(`/config/policies/${policyName}`);
      return response.data;
    },
    createPolicy: async (policyName, policyData) => {
      const response = await apiClient.post(`/config/policies/${policyName}`, policyData);
      return response.data;
    },
  },

  // Scope Management
  scopeMaps: {
    getScopeMaps: async (params = {}) => {
      const response = await apiClient.get('/config/scope-maps', { params });
      return response.data;
    },
    /**
     * Create scope map assignment
     * @param {object} scopeMapData - Scope map data in format: { "scope-map": [{ scope-id, persona, resource }] }
     *
     * Example:
     * {
     *   "scope-map": [{
     *     "scope-name": "12345678901",
     *     "scope-id": 12345678901,
     *     "persona": "CAMPUS_AP",
     *     "resource": "wlan-ssids/MyWLAN"
     *   }]
     * }
     */
    createScopeMap: async (scopeMapData) => {
      // POST with JSON body containing scope-map array
      // This automatically assigns related resources (roles, role-gpids)
      const response = await apiClient.post('/config/scope-maps', scopeMapData);
      return response.data;
    },
  },

  // Authentication & Security
  authSecurity: {
    getAuthServers: async (params = {}) => {
      const response = await apiClient.get('/config/auth-servers', { params });
      return response.data;
    },
    getCaptivePortalProfiles: async (params = {}) => {
      const response = await apiClient.get('/config/captive-portal-profiles', { params });
      return response.data;
    },
  },

  // Switch Configuration Profiles
  switchProfiles: {
    // Get switch profile - returns all configuration categories
    getProfile: async (serial) => {
      const response = await apiClient.get(`/config/switch/${serial}/profile`);
      return response.data;
    },
    // Miscellaneous
    getMiscellaneous: async (serial) => {
      const response = await apiClient.get(`/config/switch/${serial}/miscellaneous`);
      return response.data;
    },
    // Named Objects
    getNamedObjects: async (serial) => {
      const response = await apiClient.get(`/config/switch/${serial}/named-objects`);
      return response.data;
    },
    // Network Services
    getNetworkServices: async (serial) => {
      const response = await apiClient.get(`/config/switch/${serial}/network-services`);
      return response.data;
    },
    // Roles and Policies
    getRolesPolicies: async (serial) => {
      const response = await apiClient.get(`/config/switch/${serial}/roles-policies`);
      return response.data;
    },
    // Routing Overlay
    getRoutingOverlay: async (serial) => {
      const response = await apiClient.get(`/config/switch/${serial}/routing-overlay`);
      return response.data;
    },
    // Security
    getSecurity: async (serial) => {
      const response = await apiClient.get(`/config/switch/${serial}/security`);
      return response.data;
    },
    // Services
    getServices: async (serial) => {
      const response = await apiClient.get(`/config/switch/${serial}/services`);
      return response.data;
    },
    // System
    getSystem: async (serial) => {
      const response = await apiClient.get(`/config/switch/${serial}/system`);
      return response.data;
    },
    // Telemetry
    getTelemetry: async (serial) => {
      const response = await apiClient.get(`/config/switch/${serial}/telemetry`);
      return response.data;
    },
    // Tunnels
    getTunnels: async (serial) => {
      const response = await apiClient.get(`/config/switch/${serial}/tunnels`);
      return response.data;
    },
    // VLANs and Networks
    getVLANsNetworks: async (serial) => {
      const response = await apiClient.get(`/config/switch/${serial}/vlans-networks`);
      return response.data;
    },
  },

  // Wireless Configuration Profiles (for APs)
  wirelessProfiles: {
    // Get wireless/AP profile
    getProfile: async (serial) => {
      const response = await apiClient.get(`/config/wireless/${serial}/profile`);
      return response.data;
    },
    // Radio configuration
    getRadios: async (serial) => {
      const response = await apiClient.get(`/config/wireless/${serial}/radios`);
      return response.data;
    },
    // WLAN configuration
    getWLANs: async (serial) => {
      const response = await apiClient.get(`/config/wireless/${serial}/wlans`);
      return response.data;
    },
    // System configuration
    getSystem: async (serial) => {
      const response = await apiClient.get(`/config/wireless/${serial}/system`);
      return response.data;
    },
  },
};

/**
 * Sites Configuration API (network-config/v1alpha1)
 */
export const sitesConfigAPI = {
  getSites: async (params = {}) => {
    const response = await apiClient.get('/sites/config', { params });
    return response.data;
  },

  createSite: async (siteData) => {
    const response = await apiClient.post('/sites/config', siteData);
    return response.data;
  },

  updateSite: async (siteData) => {
    const response = await apiClient.put('/sites/config', siteData);
    return response.data;
  },

  deleteSite: async (scopeId) => {
    const response = await apiClient.delete('/sites/config', {
      params: { 'scope-id': scopeId },
    });
    return response.data;
  },
};

/**
 * User Management API
 */
export const userAPI = {
  getAll: async () => {
    const response = await apiClient.get('/users');
    return response.data;
  },
};

/**
 * HPE GreenLake User Management API
 * Backend routes implemented in dashboard/backend/app.py under /api/greenlake/*
 */
export const greenlakeUserAPI = {
  list: async ({ filter = null, limit = 100, offset = 0 } = {}) => {
    const params = { limit, offset };
    if (filter) params.filter = filter;
    const response = await apiClient.get('/greenlake/users', { params });
    return response.data;
  },

  get: async (userId) => {
    const response = await apiClient.get(`/greenlake/users/${encodeURIComponent(userId)}`);
    return response.data;
  },

  update: async (userId, updateBody = {}) => {
    const response = await apiClient.put(`/greenlake/users/${encodeURIComponent(userId)}`, updateBody);
    return response.data;
  },

  delete: async (userId) => {
    const response = await apiClient.delete(`/greenlake/users/${encodeURIComponent(userId)}`);
    return response.data;
  },

  invite: async ({ email, sendWelcomeEmail = true }) => {
    const response = await apiClient.post('/greenlake/users/invite', {
      email,
      sendWelcomeEmail: !!sendWelcomeEmail,
    });
    return response.data;
  },
};

/**
 * GreenLake Role API - Platform role management
 */
export const greenlakeRoleAPI = {
  listAssignments: async () => {
    const response = await apiClient.get('/greenlake/role-assignments');
    return response.data;
  },

  listUsers: async () => {
    const response = await apiClient.get('/greenlake/users', { params: { limit: 1000 } });
    return response.data;
  },

  assignRole: async ({ userId, roleId }) => {
    const response = await apiClient.post('/greenlake/role-assignments', {
      userId,
      roleId,
    });
    return response.data;
  },

  unassignRole: async (assignmentId) => {
    const response = await apiClient.delete(`/greenlake/role-assignments/${encodeURIComponent(assignmentId)}`);
    return response.data;
  },
};

/**
 * GreenLake Device API
 */
export const greenlakeDeviceAPI = {
  list: async (params = {}) => {
    const response = await apiClient.get('/greenlake/devices', { params });
    return response.data;
  },
};

/**
 * GreenLake Tags API
 */
export const greenlakeTagsAPI = {
  list: async () => {
    const response = await apiClient.get('/greenlake/tags');
    return response.data;
  },
};

/**
 * GreenLake Subscriptions API
 */
export const greenlakeSubscriptionsAPI = {
  list: async (params = {}) => {
    const response = await apiClient.get('/greenlake/subscriptions', { params });
    return response.data;
  },
};

/**
 * GreenLake Workspaces API
 */
export const greenlakeWorkspacesAPI = {
  list: async () => {
    const response = await apiClient.get('/greenlake/workspaces');
    return response.data;
  },
};

/**
 * Monitoring API
 */
export const monitoringAPI = {
  getNetworkHealth: async () => {
    const response = await apiClient.get('/monitoring/network-health');
    return response.data;
  },
};

/**
 * API Explorer
 */
export const explorerAPI = {
  executeRequest: async (endpoint, method = 'GET', params = {}, body = {}) => {
    const response = await apiClient.post('/explore', {
      endpoint,
      method,
      params,
      body,
    });
    return response.data;
  },
};

/**
 * Client Management API
 * Get connected wireless and wired clients
 * If siteId is not provided, uses monitoring API to get all clients (same approach as SitesPage)
 */
export const getClients = async (siteId) => {
  const params = siteId ? { site_id: siteId } : {};
  try {
    const response = await apiClient.get('/clients', { params });
    const data = response.data;
    
    // Check if this is an empty response from monitoring API (no site_id provided)
    // Backend returns { count: 0, items: [], message: '...' } when monitoring endpoint not available
    if (!siteId && data && data.count === 0 && (!data.items || data.items.length === 0) && data.message) {
      // This is the "monitoring endpoint not available" response - throw to trigger fallback
      throw new Error('Monitoring clients endpoint not available');
    }
    
    return data;
  } catch (error) {
    // If no siteId and request fails, throw to allow fallback logic
    if (!siteId && error.response?.status === 400) {
      throw new Error('Monitoring clients endpoint not available');
    }
    throw error;
  }
};

export const getClientTrends = async (siteId) => {
  const params = siteId ? { site_id: siteId } : {};
  const response = await apiClient.get('/clients/trends', { params });
  return response.data;
};

export const getTopClients = async (siteId) => {
  const params = siteId ? { site_id: siteId } : {};
  const response = await apiClient.get('/clients/usage/topn', { params });
  return response.data;
};

/**
 * NAC (Network Access Control) API
 */
export const nacAPI = {
  getUserRoles: async () => {
    const response = await apiClient.get('/nac/user-roles');
    return response.data;
  },

  getDeviceProfiles: async () => {
    const response = await apiClient.get('/nac/device-profiles');
    return response.data;
  },

  getClientAuth: async (siteId) => {
    const params = siteId ? { site_id: siteId } : {};
    const response = await apiClient.get('/nac/client-auth', { params });
    return response.data;
  },

  getPolicies: async () => {
    const response = await apiClient.get('/nac/policies');
    return response.data;
  },

  getCertificates: async () => {
    const response = await apiClient.get('/nac/certificates');
    return response.data;
  },

  getRadiusProfiles: async () => {
    const response = await apiClient.get('/nac/radius-profiles');
    return response.data;
  },

  getOnboardingRules: async () => {
    const response = await apiClient.get('/nac/onboarding-rules');
    return response.data;
  },
};

/**
 * Scope Management API
 */
export const scopeAPI = {
  getLabels: async () => {
    const response = await apiClient.get('/scope/labels');
    return response.data;
  },

  createLabel: async (labelData) => {
    const response = await apiClient.post('/scope/labels', labelData);
    return response.data;
  },

  deleteLabel: async (labelId) => {
    const response = await apiClient.delete(`/scope/labels/${labelId}`);
    return response.data;
  },

  getLabelAssociations: async (labelId) => {
    const response = await apiClient.get('/scope/label-associations', {
      params: { label_id: labelId },
    });
    return response.data;
  },

  getGeofences: async () => {
    const response = await apiClient.get('/scope/geofences');
    return response.data;
  },

  getSiteHierarchy: async () => {
    const response = await apiClient.get('/scope/site-hierarchy');
    return response.data;
  },
};

/**
 * Application Experience API
 */
export const appExperienceAPI = {
  getApplications: async () => {
    const response = await apiClient.get('/appexperience/applications');
    return response.data;
  },

  getAppCategories: async () => {
    const response = await apiClient.get('/appexperience/app-categories');
    return response.data;
  },

  getTrafficAnalysis: async (filters = {}) => {
    const response = await apiClient.get('/appexperience/traffic-analysis', {
      params: filters,
    });
    return response.data;
  },

  getQoSPolicies: async () => {
    const response = await apiClient.get('/appexperience/qos-policies');
    return response.data;
  },

  getDPISettings: async () => {
    const response = await apiClient.get('/appexperience/dpi-settings');
    return response.data;
  },

  getAppVisibility: async (group = 'all') => {
    const response = await apiClient.get('/appexperience/app-visibility', {
      params: { group },
    });
    return response.data;
  },
};

/**
 * Troubleshooting API
 */
export const troubleshootAPI = {
  ping: async (deviceSerial, target) => {
    // Ping can take up to 30 seconds due to async polling, so use longer timeout
    const response = await apiClient.post('/troubleshoot/ping', {
      device_serial: deviceSerial,
      target: target,
    }, {
      timeout: 35000, // 35 seconds to allow for async operation polling
    });
    return response.data;
  },

  traceroute: async (deviceSerial, target) => {
    const response = await apiClient.post('/troubleshoot/traceroute', {
      device_serial: deviceSerial,
      target: target,
    });
    return response.data;
  },

  getDeviceLogs: async (serial) => {
    const response = await apiClient.get('/troubleshoot/device-logs', {
      params: { serial },
    });
    return response.data;
  },

  getClientSession: async (mac) => {
    const response = await apiClient.get('/troubleshoot/client-session', {
      params: { mac },
    });
    return response.data;
  },

  getAPDiagnostics: async (serial) => {
    const response = await apiClient.get('/troubleshoot/ap-diagnostics', {
      params: { serial },
    });
    return response.data;
  },

  getAPRadioStats: async (serial) => {
    const response = await apiClient.get('/troubleshoot/ap-radio-stats', {
      params: { serial },
    });
    return response.data;
  },

  getAPInterference: async (serial) => {
    const response = await apiClient.get('/troubleshoot/ap-interference', {
      params: { serial },
    });
    return response.data;
  },

  troubleshootClientConnectivity: async (macAddress) => {
    const response = await apiClient.post('/troubleshoot/client-connectivity', {
      mac_address: macAddress,
    });
    return response.data;
  },

  bandwidthTest: async (deviceSerial, testData = {}) => {
    const response = await apiClient.post('/troubleshoot/bandwidth-test', {
      device_serial: deviceSerial,
      ...testData,
    });
    return response.data;
  },

  getSwitchPortStatus: async (serial, port = null) => {
    const params = { serial };
    if (port) params.port = port;
    const response = await apiClient.get('/troubleshoot/switch-port-status', {
      params,
    });
    return response.data;
  },

  // CX Switch Troubleshooting Operations
  cxPing: async (deviceSerial, target) => {
    const response = await apiClient.post('/troubleshoot/ping', {
      device_serial: deviceSerial,
      target: target,
    }, {
      timeout: 35000,
    });
    return response.data;
  },

  cxTraceroute: async (deviceSerial, target) => {
    const response = await apiClient.post('/troubleshoot/traceroute', {
      device_serial: deviceSerial,
      target: target,
    }, {
      timeout: 65000,
    });
    return response.data;
  },

  cxPoeBounce: async (deviceSerial, port) => {
    const response = await apiClient.post('/troubleshoot/cx/poe-bounce', {
      device_serial: deviceSerial,
      port: port,
    }, {
      timeout: 35000,
    });
    return response.data;
  },

  cxPortBounce: async (deviceSerial, port) => {
    const response = await apiClient.post('/troubleshoot/cx/port-bounce', {
      device_serial: deviceSerial,
      port: port,
    }, {
      timeout: 35000,
    });
    return response.data;
  },

  cxCableTest: async (deviceSerial, port) => {
    const response = await apiClient.post('/troubleshoot/cx/cable-test', {
      device_serial: deviceSerial,
      port: port,
    }, {
      timeout: 125000,
    });
    return response.data;
  },

  cxHttpTest: async (deviceSerial, url) => {
    const response = await apiClient.post('/troubleshoot/cx/http-test', {
      device_serial: deviceSerial,
      url: url,
    }, {
      timeout: 35000,
    });
    return response.data;
  },

  cxAaaTest: async (deviceSerial, username, password) => {
    const response = await apiClient.post('/troubleshoot/cx/aaa-test', {
      device_serial: deviceSerial,
      username: username,
      password: password,
    }, {
      timeout: 35000,
    });
    return response.data;
  },

  cxListShowCommands: async (deviceSerial) => {
    const response = await apiClient.get('/troubleshoot/cx/show-commands', {
      params: { device_serial: deviceSerial },
    });
    return response.data;
  },

  cxRunShowCommand: async (deviceSerial, command) => {
    const response = await apiClient.post('/troubleshoot/cx/show-command', {
      device_serial: deviceSerial,
      command: command,
    }, {
      timeout: 35000,
    });
    return response.data;
  },

  cxLocate: async (deviceSerial, enable = true) => {
    const response = await apiClient.post('/troubleshoot/cx/locate', {
      device_serial: deviceSerial,
      enable: enable,
    });
    return response.data;
  },

  cxReboot: async (deviceSerial) => {
    const response = await apiClient.post('/troubleshoot/cx/reboot', {
      device_serial: deviceSerial,
    });
    return response.data;
  },
};

/**
 * WLAN Management API
 */
export const wlanAPI = {
  getAll: async () => {
    const response = await apiClient.get('/wlans');
    return response.data;
  },

  getDetails: async (ssidName) => {
    const response = await apiClient.get(`/wlans/${ssidName}`);
    return response.data;
  },

  create: async (wlanData) => {
    const response = await apiClient.post('/wlans', wlanData);
    return response.data;
  },

  delete: async (ssidName) => {
    const response = await apiClient.delete(`/wlans/${ssidName}`);
    return response.data;
  },
};

/**
 * Alerts and Events API
 */
export const alertsAPI = {
  getAll: async (severity, limit = 100) => {
    const params = { limit };
    if (severity) params.severity = severity;
    const response = await apiClient.get('/alerts', { params });
    return response.data;
  },

  getDetails: async (alertId) => {
    const response = await apiClient.get(`/alerts/${alertId}`);
    return response.data;
  },

  acknowledge: async (alertId) => {
    const response = await apiClient.post(`/alerts/${alertId}/acknowledge`);
    return response.data;
  },

  getEvents: async (type, limit = 100) => {
    const params = { limit };
    if (type) params.type = type;
    const response = await apiClient.get('/events', { params });
    return response.data;
  },
};

/**
 * Firmware Management API
 */
export const firmwareAPI = {
  getVersions: async (deviceType = 'IAP') => {
    const response = await apiClient.get('/firmware/versions', {
      params: { device_type: deviceType },
    });
    return response.data;
  },

  getCompliance: async () => {
    const response = await apiClient.get('/firmware/compliance');
    return response.data;
  },

  scheduleUpgrade: async (upgradeData) => {
    const response = await apiClient.post('/firmware/upgrade', upgradeData);
    return response.data;
  },
};

/**
 * Analytics and Reports API
 */
export const analyticsAPI = {
  getBandwidth: async (timeframe = '1d') => {
    const response = await apiClient.get('/analytics/bandwidth', {
      params: { timeframe },
    });
    return response.data;
  },

  getClientCount: async (timeframe = '1d') => {
    const response = await apiClient.get('/analytics/client-count', {
      params: { timeframe },
    });
    return response.data;
  },

  getDeviceUptime: async () => {
    const response = await apiClient.get('/analytics/device-uptime');
    return response.data;
  },

  getAPPerformance: async () => {
    const response = await apiClient.get('/analytics/ap-performance');
    return response.data;
  },
};

/**
 * Reporting API
 * Comprehensive reporting endpoints for network analytics and usage
 */
export const reportingAPI = {
  getTopAPsByWirelessUsage: async (siteId = null, count = 10, fromTimestamp = null, toTimestamp = null) => {
    const params = { count };
    if (siteId) params.site_id = siteId;
    if (fromTimestamp) params.from_timestamp = fromTimestamp;
    if (toTimestamp) params.to_timestamp = toTimestamp;
    const response = await apiClient.get('/reporting/top-aps-by-wireless-usage', { params });
    return response.data;
  },

  getTopAPsByClientCount: async (siteId = null, count = 10) => {
    const params = { count };
    if (siteId) params.site_id = siteId;
    const response = await apiClient.get('/reporting/top-aps-by-client-count', { params });
    return response.data;
  },

  /**
   * Get all devices enriched with GreenLake subscription data.
   * Matches devices by serial number to include license and subscription info.
   *
   * @returns {Promise<Object>} Object with:
   *   - items: Array of device objects with gl_* prefixed GreenLake fields
   *   - count: Total number of devices
   *   - gl_matched_count: Number of devices with GreenLake data
   *   - gl_available: Boolean indicating if GreenLake data was fetched
   *   - gl_error: Error message if GreenLake enrichment failed (optional)
   *   - warnings: Array of warnings about fallback behavior (optional)
   */
  getDevicesWithGreenLake: async () => {
    const response = await apiClient.get('/reporting/devices-with-greenlake');
    return response.data;
  },

  getNetworkUsage: async (siteId = null, timeframe = '1d') => {
    const params = { timeframe };
    if (siteId) params.site_id = siteId;
    const response = await apiClient.get('/reporting/network-usage', { params });
    return response.data;
  },

  getDeviceInventory: async () => {
    const response = await apiClient.get('/reporting/device-inventory');
    return response.data;
  },

  getWirelessHealth: async (siteId = null) => {
    const params = {};
    if (siteId) params.site_id = siteId;
    const response = await apiClient.get('/reporting/wireless-health', { params });
    return response.data;
  },

  getTopSSIDsByUsage: async (siteId = null, count = 10) => {
    const params = { count };
    if (siteId) params.site_id = siteId;
    const response = await apiClient.get('/reporting/top-ssids-by-usage', { params });
    return response.data;
  },
};

/**
 * Services API
 * Service health, subscriptions, and capacity management
 */
export const servicesAPI = {
  getHealth: async () => {
    const response = await apiClient.get('/services/health');
    return response.data;
  },

  getSubscriptions: async () => {
    const response = await apiClient.get('/services/subscriptions');
    return response.data;
  },

  getAuditLogs: async (limit = 100, offset = 0) => {
    const response = await apiClient.get('/services/audit-logs', {
      params: { limit, offset },
    });
    return response.data;
  },

  getCapacity: async () => {
    const response = await apiClient.get('/services/capacity');
    return response.data;
  },
};

/**
 * Workspace Management API
 */
export const workspaceAPI = {
  switch: async (clientId, clientSecret, customerId, baseUrl) => {
    const response = await apiClient.post('/workspace/switch', {
      client_id: clientId,
      client_secret: clientSecret,
      customer_id: customerId,
      base_url: baseUrl,
    });
    return response.data;
  },

  getInfo: async () => {
    const response = await apiClient.get('/workspace/info');
    return response.data;
  },
};

/**
 * Advanced Monitoring API
 */
export const monitoringAPIv2 = {
  // Site Health
  getSitesHealth: async (params = {}) => {
    try {
      const response = await apiClient.get('/sites/health', { params });
      console.log('🔍 getSitesHealth raw response:', response);
      console.log('🔍 getSitesHealth response.data:', response.data);
      console.log('🔍 getSitesHealth response.status:', response.status);
      if (!response.data) {
        console.warn('⚠️ getSitesHealth: response.data is null/undefined');
      }
      return response.data;
    } catch (error) {
      console.error('❌ getSitesHealth error:', error);
      console.error('❌ getSitesHealth error.response:', error.response);
      throw error;
    }
  },

  getSiteHealth: async (siteId) => {
    const response = await apiClient.get(`/sites/${siteId}/health`);
    return response.data;
  },

  getSitesDeviceHealth: async (params = {}) => {
    try {
      const response = await apiClient.get('/sites/device-health', { params });
      console.log('🔍 getSitesDeviceHealth raw response:', response);
      console.log('🔍 getSitesDeviceHealth response.data:', response.data);
      if (!response.data) {
        console.warn('⚠️ getSitesDeviceHealth: response.data is null/undefined');
      }
      return response.data;
    } catch (error) {
      console.error('❌ getSitesDeviceHealth error:', error);
      console.error('❌ getSitesDeviceHealth error.response:', error.response);
      throw error;
    }
  },

  getTenantDeviceHealth: async (params = {}) => {
    const response = await apiClient.get('/tenant/device-health', { params });
    return response.data;
  },

  // Access Points Monitoring
  getTopAPsByBandwidth: async (params = {}) => {
    const response = await apiClient.get('/monitoring/aps/top-bandwidth', { params });
    return response.data;
  },

  getAPsMonitoring: async (params = {}) => {
    const response = await apiClient.get('/monitoring/aps', { params });
    return response.data;
  },

  getAPMonitoringDetails: async (serial) => {
    const response = await apiClient.get(`/monitoring/aps/${serial}`);
    return response.data;
  },

  getAPCPU: async (serial, params = {}) => {
    const response = await apiClient.get(`/monitoring/aps/${serial}/cpu`, { params });
    return response.data;
  },

  getAPMemory: async (serial, params = {}) => {
    const response = await apiClient.get(`/monitoring/aps/${serial}/memory`, { params });
    return response.data;
  },

  getAPPower: async (serial, params = {}) => {
    // Mark as optional - don't throw on 404
    const response = await apiClient.get(`/monitoring/aps/${serial}/power`, { 
      params,
      validateStatus: (status) => status < 500, // Don't throw on 4xx, only 5xx
    });
    if (response.status >= 400) {
      throw { response: { status: response.status, data: response.data } };
    }
    return response.data;
  },

  getAPThroughput: async (serial, params = {}) => {
    const response = await apiClient.get(`/monitoring/aps/${serial}/throughput`, { params });
    return response.data;
  },

  getAPRadios: async (serial) => {
    const response = await apiClient.get(`/monitoring/aps/${serial}/radios`);
    return response.data;
  },

  getRadioChannelUtil: async (serial, radioId, params = {}) => {
    const response = await apiClient.get(`/monitoring/aps/${serial}/radios/${radioId}/channel-util`, { params });
    return response.data;
  },

  getAPPorts: async (serial) => {
    const response = await apiClient.get(`/monitoring/aps/${serial}/ports`);
    return response.data;
  },

  // WLANs Monitoring
  getWLANsMonitoring: async (params = {}) => {
    const response = await apiClient.get('/monitoring/wlans', { params });
    return response.data;
  },

  getWLANThroughput: async (wlanName, params = {}) => {
    const response = await apiClient.get(`/monitoring/wlans/${wlanName}/throughput`, { params });
    return response.data;
  },

  // Switch Monitoring
  getSwitchesMonitoring: async (params = {}) => {
    const response = await apiClient.get('/monitoring/switches', { params });
    return response.data;
  },

  getSwitchMonitoringDetails: async (serial) => {
    const response = await apiClient.get(`/monitoring/switches/${serial}`);
    return response.data;
  },

  getSwitchCPU: async (serial, params = {}) => {
    const response = await apiClient.get(`/monitoring/switches/${serial}/cpu`, { params });
    return response.data;
  },

  getSwitchMemory: async (serial, params = {}) => {
    const response = await apiClient.get(`/monitoring/switches/${serial}/memory`, { params });
    return response.data;
  },

  getSwitchPower: async (serial, params = {}) => {
    try {
      // Mark as optional - don't throw on 404
      const response = await apiClient.get(`/monitoring/switches/${serial}/power`, { 
        params,
        validateStatus: (status) => status < 500, // Don't throw on 4xx, only 5xx
      });
      if (response.status >= 400) {
        // Return null for expected failures instead of throwing
        return null;
      }
      return response.data;
    } catch (error) {
      // Only throw for unexpected errors (5xx)
      if (error.response?.status >= 500) {
        throw error;
      }
      // Return null for expected failures
      return null;
    }
  },

  getSwitchPorts: async (serial) => {
    const response = await apiClient.get(`/monitoring/switches/${serial}/ports`);
    return response.data;
  },

  // Gateway Monitoring
  getGatewaysMonitoring: async (params = {}) => {
    const response = await apiClient.get('/monitoring/gateways', { params });
    return response.data;
  },

  getGatewayMonitoringDetails: async (serial) => {
    const response = await apiClient.get(`/monitoring/gateways/${serial}`);
    return response.data;
  },

  getGatewayTunnels: async (serial) => {
    const response = await apiClient.get(`/monitoring/gateways/${serial}/tunnels`);
    return response.data;
  },

  getGatewayVlans: async (serial) => {
    const response = await apiClient.get(`/monitoring/gateways/${serial}/vlans`);
    return response.data;
  },

  // Device Monitoring (Generic)
  getDevicesMonitoring: async (params = {}) => {
    const response = await apiClient.get('/monitoring/devices', { params });
    return response.data;
  },

  // Client Monitoring
  getClientSession: async (mac) => {
    const response = await apiClient.get(`/monitoring/clients/${mac}/session`);
    return response.data;
  },

  // Firewall Sessions
  getFirewallSessions: async (params = {}) => {
    const response = await apiClient.get('/monitoring/firewall/sessions', { params });
    return response.data;
  },

  // IDPS Events
  getIDPSEvents: async (params = {}) => {
    const response = await apiClient.get('/monitoring/idps/events', { params });
    return response.data;
  },

  // Application Visibility
  getApplications: async (params = {}) => {
    const response = await apiClient.get('/monitoring/applications', { params });
    return response.data;
  },

  getTopApplications: async (params = {}) => {
    const response = await apiClient.get('/monitoring/applications/top', { params });
    return response.data;
  },

  // Swarms (AP Groups)
  getSwarms: async (params = {}) => {
    const response = await apiClient.get('/monitoring/swarms', { params });
    return response.data;
  },

  getSwarmDetails: async (swarmId) => {
    const response = await apiClient.get(`/monitoring/swarms/${swarmId}`);
    return response.data;
  },
};

/**
 * Health Check
 */
export const healthAPI = {
  check: async () => {
    const response = await apiClient.get('/health');
    return response.data;
  },
};

/**
 * Rate Limiting API
 */
export const rateLimitAPI = {
  getStatus: async () => {
    const response = await apiClient.get('/rate-limit/status');
    return response.data;
  },
};

/**
 * Token Management API
 */
export const tokenAPI = {
  getInfo: async () => {
    const response = await apiClient.get('/token/info');
    return response.data;
  },
  refresh: async () => {
    const response = await apiClient.post('/token/refresh');
    return response.data;
  },
};

/**
 * Cluster Information API
 */
export const clusterAPI = {
  getInfo: async () => {
    // This endpoint doesn't require authentication
    const response = await axios.get(`${API_BASE_URL}/cluster/info`);
    return response.data;
  },
};

/**
 * Bulk Configuration API
 */
export const bulkConfigAPI = {
  bulkAPRename: async (mappings) => {
    const response = await apiClient.post('/config/bulk-ap-rename', { mappings });
    return response.data;
  },
  bulkGroupAssign: async (mappings) => {
    const response = await apiClient.post('/config/bulk-group-assign', { mappings });
    return response.data;
  },
  bulkSiteAssign: async (mappings) => {
    const response = await apiClient.post('/config/bulk-site-assign', { mappings });
    return response.data;
  },
};

/**
 * Show Commands / Configuration Export API
 */
export const showCommandsAPI = {
  getRunConfig: async (serial) => {
    const response = await apiClient.get('/troubleshoot/show-run-config', {
      params: { serial },
    });
    return response.data;
  },
  getTechSupport: async (serial) => {
    const response = await apiClient.get('/troubleshoot/show-tech-support', {
      params: { serial },
    });
    return response.data;
  },
  getVersion: async (serial) => {
    const response = await apiClient.get('/troubleshoot/show-version', {
      params: { serial },
    });
    return response.data;
  },
  getInterfaces: async (serial) => {
    const response = await apiClient.get('/troubleshoot/show-interfaces', {
      params: { serial },
    });
    return response.data;
  },
  exportConfig: async (serial) => {
    const response = await apiClient.get('/config/export', {
      params: { serial },
      responseType: 'blob',
    });
    return response.data;
  },
};

export default apiClient;
