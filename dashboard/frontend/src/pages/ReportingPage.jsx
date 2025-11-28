/**
 * Reporting Page
 *
 * Export-focused report catalog with field selection dialogs.
 * Displays report categories (Network, Wireless, Security, GreenLake, etc.)
 * as clickable cards. Clicking a card opens a CSV export dialog with
 * customizable field selection.
 *
 * Key components:
 * - REPORT_CATEGORIES: Static configuration of available reports
 * - CSVExportDialog: Field selection and CSV generation
 * - ReportCard: Individual report display with record count
 * - ReportSection: Category grouping container
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Card,
  CardActionArea,
  Typography,
  Grid,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Checkbox,
  FormControlLabel,
  TextField,
  InputAdornment,
  CircularProgress,
  Alert,
  Chip,
  Stack,
} from '@mui/material';
import {
  Download as DownloadIcon,
  Search as SearchIcon,
  SelectAll as SelectAllIcon,
  Deselect as DeselectIcon,
  NetworkCheck as NetworkHealthIcon,
  People as ClientsIcon,
  Wifi as WifiIcon,
  Security as SecurityIcon,
  Inventory as InventoryIcon,
  Speed as SpeedIcon,
  Devices as DevicesIcon,
  Warning as WarningIcon,
  Cloud as CloudIcon,
  LocalOffer as TagIcon,
  Subscriptions as SubscriptionIcon,
  Business as WorkspaceIcon,
  VpnKey as RoleIcon,
  LocationOn as LocationIcon,
} from '@mui/icons-material';
import {
  reportingAPI,
  deviceAPI,
  monitoringAPIv2,
  alertsAPI,
  firmwareAPI,
  wlanAPI,
  configAPI,
  greenlakeUserAPI,
  greenlakeDeviceAPI,
  greenlakeTagsAPI,
  greenlakeSubscriptionsAPI,
  greenlakeWorkspacesAPI,
  greenlakeRoleAPI,
} from '../services/api';

/**
 * Format header name from API key for CSV column headers.
 * Transforms camelCase, snake_case, and dot.notation to Title Case.
 *
 * @param {string} key - API field key to format
 * @returns {string} Formatted header name
 *
 * @example
 *   formatHeader('deviceType') -> 'Device Type'
 *   formatHeader('client_count') -> 'Client Count'
 *   formatHeader('gl.subscriptionKey') -> 'Gl > Subscription Key'
 */
const formatHeader = (key) => {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .replace(/\./g, ' > ')
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim();
};

/**
 * Escape a CSV value to prevent injection and formatting issues.
 * Handles commas, quotes, and newlines in values.
 *
 * @param {string} value - Value to escape
 * @returns {string} Escaped value safe for CSV
 */
const escapeCSVValue = (value) => {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

/**
 * Flatten nested object to dot-notation keys for CSV export.
 *
 * Transformation rules:
 * - null/undefined -> '' (empty string)
 * - arrays -> semicolon-separated values
 * - booleans -> 'Yes' or 'No'
 * - nested objects -> recursively flattened with dot notation
 *
 * @param {Object} obj - Object to flatten
 * @param {string} prefix - Key prefix for nested properties
 * @returns {Object} Flat object with dot-notation keys
 */
const flattenObject = (obj, prefix = '') => {
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    const newKey = prefix ? `${prefix}.${key}` : key;
    if (value === null || value === undefined) {
      result[newKey] = '';
    } else if (Array.isArray(value)) {
      result[newKey] = value.join('; ');
    } else if (typeof value === 'object') {
      Object.assign(result, flattenObject(value, newKey));
    } else if (typeof value === 'boolean') {
      result[newKey] = value ? 'Yes' : 'No';
    } else {
      result[newKey] = value;
    }
  }
  return result;
};

/**
 * Get all available fields from data array
 */
const getAvailableFields = (dataArray, priorityKeys = []) => {
  if (!dataArray || dataArray.length === 0) return [];
  const allKeys = new Set();
  dataArray.forEach((item) => {
    const flat = flattenObject(item);
    Object.keys(flat).forEach((key) => allKeys.add(key));
  });
  return Array.from(allKeys).sort((a, b) => {
    const aIdx = priorityKeys.indexOf(a);
    const bIdx = priorityKeys.indexOf(b);
    if (aIdx !== -1 && bIdx !== -1) return aIdx - bIdx;
    if (aIdx !== -1) return -1;
    if (bIdx !== -1) return 1;
    return a.localeCompare(b);
  });
};

/**
 * Export data to CSV with proper escaping and cleanup.
 *
 * @param {Array} data - Array of objects to export
 * @param {Array} selectedFields - Field keys to include in export
 * @param {string} filename - Base filename (date will be appended)
 */
const exportToCSV = (data, selectedFields, filename) => {
  if (!data || data.length === 0 || !selectedFields || selectedFields.length === 0) return;

  const flattenedData = data.map((item) => flattenObject(item));

  // Escape headers to prevent CSV injection
  const header = selectedFields.map((key) => escapeCSVValue(formatHeader(key))).join(',');

  const rows = flattenedData.map((flat) => {
    return selectedFields.map((key) => escapeCSVValue(flat[key])).join(',');
  });

  const csv = [header, ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  // Use try/finally to ensure URL is always revoked (prevent memory leak)
  const link = document.createElement('a');
  try {
    link.href = url;
    link.download = `${filename}_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  } finally {
    URL.revokeObjectURL(url);
  }
};

/**
 * CSV Export Dialog Component
 */
function CSVExportDialog({ open, onClose, title, data, defaultFields, priorityFields, filename }) {
  const [selectedFields, setSelectedFields] = useState(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [availableFields, setAvailableFields] = useState([]);

  useEffect(() => {
    if (open && data && data.length > 0) {
      const fields = getAvailableFields(data, priorityFields || []);
      setAvailableFields(fields);
      const initialSelected = new Set((defaultFields || []).filter((f) => fields.includes(f)));
      if (initialSelected.size === 0 && fields.length > 0) {
        fields.slice(0, 10).forEach((f) => initialSelected.add(f));
      }
      setSelectedFields(initialSelected);
      setSearchTerm('');
    }
  }, [open, data, defaultFields, priorityFields]);

  const handleToggleField = (field) => {
    setSelectedFields((prev) => {
      const next = new Set(prev);
      if (next.has(field)) next.delete(field);
      else next.add(field);
      return next;
    });
  };

  const handleSelectAll = () => {
    const filtered = availableFields.filter(
      (f) =>
        f.toLowerCase().includes(searchTerm.toLowerCase()) ||
        formatHeader(f).toLowerCase().includes(searchTerm.toLowerCase())
    );
    setSelectedFields(new Set([...selectedFields, ...filtered]));
  };

  const handleDeselectAll = () => {
    if (searchTerm) {
      const filtered = availableFields.filter(
        (f) =>
          f.toLowerCase().includes(searchTerm.toLowerCase()) ||
          formatHeader(f).toLowerCase().includes(searchTerm.toLowerCase())
      );
      setSelectedFields((prev) => {
        const next = new Set(prev);
        filtered.forEach((f) => next.delete(f));
        return next;
      });
    } else {
      setSelectedFields(new Set());
    }
  };

  const handleExport = () => {
    exportToCSV(data, Array.from(selectedFields), filename);
    onClose();
  };

  const filteredFields = availableFields.filter(
    (f) =>
      f.toLowerCase().includes(searchTerm.toLowerCase()) ||
      formatHeader(f).toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        {title}
        <Typography variant="body2" color="text.secondary">
          Select fields to include ({selectedFields.size} of {availableFields.length} selected)
        </Typography>
      </DialogTitle>
      <DialogContent>
        {data && data.length > 0 ? (
          <>
            <Box sx={{ mb: 2 }}>
              <TextField
                fullWidth
                size="small"
                placeholder="Search fields..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <SearchIcon fontSize="small" />
                    </InputAdornment>
                  ),
                }}
              />
            </Box>
            <Box sx={{ mb: 1, display: 'flex', gap: 1 }}>
              <Button size="small" startIcon={<SelectAllIcon />} onClick={handleSelectAll}>
                Select All
              </Button>
              <Button size="small" startIcon={<DeselectIcon />} onClick={handleDeselectAll}>
                Deselect All
              </Button>
            </Box>
            <Box
              sx={{
                maxHeight: 350,
                overflow: 'auto',
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 1,
                p: 1,
              }}
            >
              <Grid container spacing={0}>
                {filteredFields.map((field) => (
                  <Grid item xs={6} key={field}>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={selectedFields.has(field)}
                          onChange={() => handleToggleField(field)}
                          size="small"
                          sx={{ py: 0.25 }}
                        />
                      }
                      label={
                        <Typography variant="body2" sx={{ fontSize: '0.75rem' }}>
                          {formatHeader(field)}
                        </Typography>
                      }
                      sx={{ m: 0, width: '100%' }}
                    />
                  </Grid>
                ))}
                {filteredFields.length === 0 && (
                  <Grid item xs={12}>
                    <Typography variant="body2" color="text.secondary" align="center" sx={{ py: 2 }}>
                      No fields match your search
                    </Typography>
                  </Grid>
                )}
              </Grid>
            </Box>
          </>
        ) : (
          <Typography color="text.secondary" align="center" sx={{ py: 4 }}>
            No data available to export
          </Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          onClick={handleExport}
          disabled={selectedFields.size === 0 || !data || data.length === 0}
          startIcon={<DownloadIcon />}
        >
          Export ({selectedFields.size} fields)
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/**
 * Compact Report Card Component - minimal, clean design
 */
function ReportCard({ title, icon, recordCount, onExport, loading, color = 'primary.main' }) {
  const isDisabled = loading || recordCount === 0;

  return (
    <Card
      variant="outlined"
      sx={{
        height: '100%',
        transition: 'all 0.15s ease-in-out',
        borderColor: 'divider',
        opacity: isDisabled ? 0.6 : 1,
        '&:hover': isDisabled ? {} : {
          borderColor: 'primary.main',
          boxShadow: 1,
          bgcolor: 'action.hover',
        },
      }}
    >
      <CardActionArea
        onClick={onExport}
        disabled={isDisabled}
        sx={{ height: '100%', py: 1.25, px: 1.5 }}
      >
        <Stack direction="row" spacing={1} alignItems="center">
          <Box sx={{ color, display: 'flex', fontSize: 18 }}>
            {React.cloneElement(icon, { sx: { fontSize: 18 } })}
          </Box>
          <Typography
            variant="body2"
            fontWeight={500}
            noWrap
            sx={{ flexGrow: 1, fontSize: '0.8rem' }}
          >
            {title}
          </Typography>
          {loading ? (
            <CircularProgress size={14} />
          ) : recordCount !== undefined ? (
            <Chip
              label={recordCount}
              size="small"
              sx={{
                height: 18,
                fontSize: '0.65rem',
                '& .MuiChip-label': { px: 0.75 }
              }}
            />
          ) : null}
        </Stack>
      </CardActionArea>
    </Card>
  );
}

/**
 * Report Category Section - compact header with tight grid
 */
function ReportSection({ title, icon, children }) {
  return (
    <Box sx={{ mb: 3 }}>
      <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mb: 1.5 }}>
        {React.cloneElement(icon, { sx: { fontSize: 18 } })}
        <Typography variant="subtitle2" fontWeight={600} color="text.secondary">
          {title}
        </Typography>
      </Stack>
      <Grid container spacing={1.5}>
        {children}
      </Grid>
    </Box>
  );
}

/**
 * Report definitions organized by category
 */
const REPORT_CATEGORIES = [
  {
    id: 'network',
    title: 'Network Infrastructure',
    icon: <NetworkHealthIcon color="primary" />,
    reports: [
      {
        id: 'devices',
        title: 'All Devices',
        icon: <DevicesIcon />,
        color: 'primary.main',
        defaultFields: ['name', 'serial', 'deviceType', 'model', 'status', 'ipAddress', 'site', 'firmwareVersion'],
        priorityFields: ['name', 'serial', 'deviceType', 'model', 'status', 'ipAddress', 'site'],
        filename: 'device_inventory',
      },
      {
        id: 'devices_greenlake',
        title: 'All Devices + GreenLake',
        icon: <CloudIcon />,
        color: '#01A982',
        defaultFields: [
          'name', 'serial', 'deviceType', 'model', 'status', 'ipAddress', 'site', 'firmwareVersion',
          'gl_subscriptionKey', 'gl_subscriptionTier', 'gl_subscriptionExpiry', 'gl_matched'
        ],
        priorityFields: [
          'name', 'serial', 'deviceType', 'status', 'site', 'gl_subscriptionKey', 'gl_subscriptionTier', 'gl_subscriptionExpiry'
        ],
        filename: 'devices_with_greenlake',
      },
      {
        id: 'sites',
        title: 'Sites',
        icon: <LocationIcon />,
        color: 'info.main',
        defaultFields: ['site_name', 'site_id', 'address', 'city', 'state', 'country'],
        priorityFields: ['site_name', 'site_id', 'address', 'city', 'state', 'country'],
        filename: 'sites',
      },
    ],
  },
  {
    id: 'wireless',
    title: 'Wireless',
    icon: <WifiIcon color="success" />,
    reports: [
      {
        id: 'wlans',
        title: 'WLANs / SSIDs',
        icon: <WifiIcon />,
        color: 'secondary.main',
        defaultFields: ['ssid', 'enabled', 'forwardMode', 'opmode', 'rfBand', 'vlanName', 'hideSsid'],
        priorityFields: ['ssid', 'enabled', 'forwardMode', 'opmode', 'rfBand', 'vlanName'],
        filename: 'wlans',
      },
      {
        id: 'clients',
        title: 'Top APs by Clients',
        icon: <ClientsIcon />,
        color: 'primary.main',
        defaultFields: ['name', 'serial', 'client_count', 'site', 'model'],
        priorityFields: ['name', 'serial', 'client_count', 'site'],
        filename: 'top_aps_by_clients',
      },
      {
        id: 'bandwidth',
        title: 'Top APs by Bandwidth',
        icon: <SpeedIcon />,
        color: 'success.main',
        defaultFields: ['name', 'serial', 'tx_bytes', 'rx_bytes', 'site'],
        priorityFields: ['name', 'serial', 'tx_bytes', 'rx_bytes', 'site'],
        filename: 'top_aps_by_bandwidth',
      },
    ],
  },
  {
    id: 'security',
    title: 'Security & Alerts',
    icon: <SecurityIcon color="error" />,
    reports: [
      {
        id: 'alerts',
        title: 'Alerts',
        icon: <WarningIcon />,
        color: 'error.main',
        defaultFields: ['timestamp', 'type', 'severity', 'description', 'device_serial'],
        priorityFields: ['timestamp', 'type', 'severity', 'description'],
        filename: 'alerts',
      },
      {
        id: 'idps',
        title: 'IDPS Events',
        icon: <SecurityIcon />,
        color: 'error.main',
        defaultFields: ['timestamp', 'threat_name', 'src_ip', 'dst_ip', 'action', 'severity'],
        priorityFields: ['timestamp', 'threat_name', 'src_ip', 'dst_ip', 'action'],
        filename: 'idps_events',
      },
    ],
  },
  {
    id: 'compliance',
    title: 'Compliance & Inventory',
    icon: <InventoryIcon color="warning" />,
    reports: [
      {
        id: 'firmware',
        title: 'Firmware Compliance',
        icon: <InventoryIcon />,
        color: 'warning.main',
        defaultFields: ['name', 'serial', 'device_type', 'firmware_version', 'compliance'],
        priorityFields: ['name', 'serial', 'device_type', 'firmware_version', 'compliance'],
        filename: 'firmware_compliance',
      },
    ],
  },
  {
    id: 'greenlake',
    title: 'GreenLake Platform',
    icon: <CloudIcon sx={{ color: '#01A982' }} />,
    reports: [
      {
        id: 'gl_users',
        title: 'Users',
        icon: <ClientsIcon />,
        color: '#01A982',
        defaultFields: ['email', 'displayName', 'status', 'createdAt', 'lastLogin'],
        priorityFields: ['email', 'displayName', 'status', 'createdAt'],
        filename: 'greenlake_users',
      },
      {
        id: 'gl_devices',
        title: 'Devices',
        icon: <DevicesIcon />,
        color: '#01A982',
        defaultFields: ['serialNumber', 'deviceType', 'model', 'status', 'location'],
        priorityFields: ['serialNumber', 'deviceType', 'model', 'status'],
        filename: 'greenlake_devices',
      },
      {
        id: 'gl_tags',
        title: 'Tags',
        icon: <TagIcon />,
        color: '#01A982',
        defaultFields: ['name', 'description', 'createdAt', 'resourceCount'],
        priorityFields: ['name', 'description', 'createdAt'],
        filename: 'greenlake_tags',
      },
      {
        id: 'gl_subscriptions',
        title: 'Subscriptions',
        icon: <SubscriptionIcon />,
        color: '#01A982',
        defaultFields: ['subscriptionKey', 'productDescription', 'status', 'startDate', 'endDate'],
        priorityFields: ['subscriptionKey', 'productDescription', 'status', 'startDate', 'endDate'],
        filename: 'greenlake_subscriptions',
      },
      {
        id: 'gl_workspaces',
        title: 'Workspaces',
        icon: <WorkspaceIcon />,
        color: '#01A982',
        defaultFields: ['name', 'id', 'status', 'createdAt'],
        priorityFields: ['name', 'id', 'status', 'createdAt'],
        filename: 'greenlake_workspaces',
      },
      {
        id: 'gl_roles',
        title: 'Role Assignments',
        icon: <RoleIcon />,
        color: '#01A982',
        defaultFields: ['userId', 'roleId', 'roleName', 'assignedAt'],
        priorityFields: ['userId', 'roleId', 'roleName'],
        filename: 'greenlake_roles',
      },
    ],
  },
];

function ReportingPage() {
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [activeReport, setActiveReport] = useState(null);
  const [reportData, setReportData] = useState({});
  const [loadingReports, setLoadingReports] = useState({});
  const [error, setError] = useState(null);
  const [glStatus, setGlStatus] = useState({ available: null, error: null });

  // Load record counts with error tracking
  const loadReportCounts = useCallback(async () => {
    const failedAPIs = [];

    try {
      const [devices, wlans, sites, alerts] = await Promise.all([
        monitoringAPIv2.getDevicesMonitoring({ limit: 1000 }).catch((e) => {
          failedAPIs.push('Devices');
          console.error('Devices API failed:', e);
          return { items: [] };
        }),
        wlanAPI.getAll().catch((e) => {
          failedAPIs.push('WLANs');
          console.error('WLANs API failed:', e);
          return { wlans: [] };
        }),
        configAPI.getSites().catch((e) => {
          failedAPIs.push('Sites');
          console.error('Sites API failed:', e);
          return { sites: [] };
        }),
        alertsAPI.getAll(null, 100).catch((e) => {
          failedAPIs.push('Alerts');
          console.error('Alerts API failed:', e);
          return { alerts: [] };
        }),
      ]);

      const deviceList = devices.items || devices.devices || [];
      const wlanList = wlans.wlans || wlans.items || [];
      const siteList = sites.sites || sites.items || [];
      const alertList = alerts.alerts || alerts.items || [];

      setReportData((prev) => ({
        ...prev,
        devices: deviceList,
        wlans: wlanList,
        sites: siteList,
        alerts: alertList,
      }));

      // Show warning if some APIs failed
      if (failedAPIs.length > 0) {
        setError(`Some reports unavailable: ${failedAPIs.join(', ')}`);
      }
    } catch (err) {
      console.error('Failed to load report counts:', err);
      setError('Failed to load report data. Please try refreshing the page.');
    }

    // Load GreenLake counts separately (may fail if not configured)
    try {
      const [glUsers, glDevices, glTags, glSubs, glWorkspaces, glRoles] = await Promise.all([
        greenlakeUserAPI.list({ limit: 1 }).catch(() => null),
        greenlakeDeviceAPI.list({ limit: 1 }).catch(() => null),
        greenlakeTagsAPI.list().catch(() => null),
        greenlakeSubscriptionsAPI.list({ limit: 1 }).catch(() => null),
        greenlakeWorkspacesAPI.list().catch(() => null),
        greenlakeRoleAPI.listAssignments().catch(() => null),
      ]);

      // Check if any GreenLake data was returned
      const hasGlData = glUsers || glDevices || glTags || glSubs || glWorkspaces || glRoles;

      setReportData((prev) => ({
        ...prev,
        gl_users: glUsers?.items || glUsers?.users || [],
        gl_devices: glDevices?.items || glDevices?.devices || [],
        gl_tags: glTags?.items || glTags?.tags || [],
        gl_subscriptions: glSubs?.items || glSubs?.subscriptions || [],
        gl_workspaces: glWorkspaces?.items || glWorkspaces?.tenants || [],
        gl_roles: glRoles?.items || glRoles?.assignments || [],
      }));

      setGlStatus({
        available: hasGlData,
        error: hasGlData ? null : 'GreenLake integration not configured',
      });
    } catch (err) {
      console.error('GreenLake reports not available:', err);
      setGlStatus({
        available: false,
        error: err.response?.status === 401
          ? 'GreenLake authentication required'
          : 'GreenLake integration unavailable',
      });
    }
  }, []);

  // Load record counts on mount
  useEffect(() => {
    loadReportCounts();
  }, [loadReportCounts]);

  const loadReportData = async (reportId) => {
    setLoadingReports((prev) => ({ ...prev, [reportId]: true }));
    setError(null);

    try {
      let data = [];

      switch (reportId) {
        case 'devices': {
          const response = await monitoringAPIv2.getDevicesMonitoring({ limit: 1000 });
          data = response.items || response.devices || [];
          break;
        }
        case 'devices_greenlake': {
          const response = await reportingAPI.getDevicesWithGreenLake();
          if (response.error) {
            throw new Error(response.error);
          }
          data = response.items || response.devices || [];
          // Warn user if GreenLake enrichment failed but devices were returned
          if (response.gl_error && data.length > 0) {
            setError(`Note: ${response.gl_error}. Some GreenLake fields may be missing.`);
          }
          break;
        }
        case 'wlans': {
          const response = await wlanAPI.getAll();
          data = response.wlans || response.items || [];
          break;
        }
        case 'clients': {
          const response = await reportingAPI.getTopAPsByClientCount(null, 100);
          data = response.aps || response.items || [];
          break;
        }
        case 'bandwidth': {
          const response = await reportingAPI.getTopAPsByWirelessUsage(null, 100);
          data = response.aps || response.items || [];
          break;
        }
        case 'sites': {
          const response = await configAPI.getSites();
          data = response.sites || response.items || [];
          break;
        }
        case 'alerts': {
          const response = await alertsAPI.getAll(null, 500);
          data = response.alerts || response.items || [];
          break;
        }
        case 'firmware': {
          const response = await firmwareAPI.getCompliance();
          data = response.devices || response.items || [];
          break;
        }
        case 'idps': {
          const response = await monitoringAPIv2.getIDPSEvents();
          data = response.events || response.items || [];
          break;
        }
        // GreenLake Reports
        case 'gl_users': {
          const response = await greenlakeUserAPI.list({ limit: 1000 });
          data = response.items || response.users || [];
          break;
        }
        case 'gl_devices': {
          const response = await greenlakeDeviceAPI.list({ limit: 1000 });
          data = response.items || response.devices || [];
          break;
        }
        case 'gl_tags': {
          const response = await greenlakeTagsAPI.list();
          data = response.items || response.tags || [];
          break;
        }
        case 'gl_subscriptions': {
          const response = await greenlakeSubscriptionsAPI.list({ limit: 1000 });
          data = response.items || response.subscriptions || [];
          break;
        }
        case 'gl_workspaces': {
          const response = await greenlakeWorkspacesAPI.list();
          data = response.items || response.tenants || [];
          break;
        }
        case 'gl_roles': {
          const response = await greenlakeRoleAPI.listAssignments();
          data = response.items || response.assignments || [];
          break;
        }
        default:
          console.error(`Unknown report type: ${reportId}`);
          throw new Error(`Report type "${reportId}" is not implemented`);
      }

      setReportData((prev) => ({ ...prev, [reportId]: data }));
      return data;
    } catch (err) {
      console.error(`Failed to load ${reportId} report:`, err);
      setError(`Failed to load ${reportId} data: ${err.message}`);
      return [];
    } finally {
      setLoadingReports((prev) => ({ ...prev, [reportId]: false }));
    }
  };

  const handleExportClick = useCallback(async (report) => {
    setActiveReport(report);
    setError(null);

    try {
      if (!reportData[report.id] || reportData[report.id].length === 0) {
        const data = await loadReportData(report.id);
        if (!data || data.length === 0) {
          setError(`No data available for ${report.title}`);
          return; // Don't open dialog with no data
        }
      }
      setExportDialogOpen(true);
    } catch (err) {
      // Error already set by loadReportData, don't open dialog
      console.error(`Export click failed for ${report.id}:`, err);
    }
  }, [reportData]);

  const getRecordCount = (reportId) => {
    const data = reportData[reportId];
    return data ? data.length : undefined;
  };

  return (
    <Box>
      {/* Header */}
      <Box sx={{ mb: 2.5 }}>
        <Typography variant="h5" sx={{ fontWeight: 600, mb: 0.25 }}>
          Reports
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Click a report to export data as CSV
        </Typography>
      </Box>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* GreenLake Status Alert */}
      {glStatus.available === false && glStatus.error && (
        <Alert severity="info" sx={{ mb: 2 }}>
          {glStatus.error}. GreenLake reports will show 0 records.
        </Alert>
      )}

      {/* Report Sections */}
      {REPORT_CATEGORIES.map((category) => (
        <ReportSection key={category.id} title={category.title} icon={category.icon}>
          {category.reports.map((report) => (
            <Grid item xs={6} sm={4} md={3} lg={2} xl={2} key={report.id}>
              <ReportCard
                title={report.title}
                icon={report.icon}
                color={report.color}
                recordCount={getRecordCount(report.id)}
                loading={loadingReports[report.id]}
                onExport={() => handleExportClick(report)}
              />
            </Grid>
          ))}
        </ReportSection>
      ))}

      {/* Export Dialog */}
      {activeReport && (
        <CSVExportDialog
          open={exportDialogOpen}
          onClose={() => {
            setExportDialogOpen(false);
            setActiveReport(null);
          }}
          title={`Export ${activeReport.title}`}
          data={reportData[activeReport.id] || []}
          defaultFields={activeReport.defaultFields}
          priorityFields={activeReport.priorityFields}
          filename={activeReport.filename}
        />
      )}
    </Box>
  );
}

export default ReportingPage;
