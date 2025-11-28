/**
 * WLANs Management Page
 * View and manage wireless networks (SSIDs) with full configuration details
 */

import { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  CircularProgress,
  Alert,
  Button,
  Chip,
  Grid,
  Tooltip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Checkbox,
  FormControlLabel,
  TextField,
  InputAdornment,
} from '@mui/material';
import {
  Search as SearchIcon,
  SelectAll as SelectAllIcon,
  Deselect as DeselectIcon,
} from '@mui/icons-material';
import {
  Wifi as WifiIcon,
  Refresh as RefreshIcon,
  Security as SecurityIcon,
  SignalWifi4Bar as SignalIcon,
  Add as AddIcon,
  Download as DownloadIcon,
  Router as RouterIcon,
  Lan as LanIcon,
} from '@mui/icons-material';
import { wlanAPI } from '../services/api';
import WLANWizard from './wlans/WLANWizard';

/**
 * Format forward mode for display
 */
const formatForwardMode = (mode) => {
  if (!mode) return 'N/A';
  if (mode === 'FORWARD_MODE_BRIDGE') return 'Bridge Overlay';
  if (mode === 'FORWARD_MODE_TUNNEL') return 'Tunnel';
  if (mode === 'FORWARD_MODE_SPLIT_TUNNEL') return 'Split Tunnel';
  if (mode === 'FORWARD_MODE_L2') return 'Tunnel Underlay';
  if (mode === 'FORWARD_MODE_L3') return 'Tunnel Overlay';
  return mode.replace('FORWARD_MODE_', '');
};

/**
 * Format encryption/opmode for display
 * If wpa3TransitionMode is enabled, append /OWE to indicate transition mode
 */
const formatEncryption = (opmode, wpa3TransitionMode = false) => {
  if (!opmode) return 'N/A';
  const opmodeMap = {
    'OPEN': 'Open',
    'WPA2_PERSONAL': 'WPA2-PSK',
    'WPA2_ENTERPRISE': 'WPA2-Enterprise',
    'ENHANCED_OPEN': 'Enhanced Open',
    'WPA3_SAE': 'WPA3-SAE',
    'WPA3_ENTERPRISE_CCM_128': 'WPA3-Ent (CCM-128)',
    'WPA3_ENTERPRISE_GCM_256': 'WPA3-Ent (GCM-256)',
    'WPA3_ENTERPRISE_CNSA': 'WPA3-Ent (CNSA)',
    'WPA_ENTERPRISE': 'WPA-Enterprise',
    'WPA_PERSONAL': 'WPA-PSK',
    'WPA2_MPSK_AES': 'WPA2-MPSK',
    'WPA2_MPSK_LOCAL': 'WPA2-MPSK (Local)',
    'DPP': 'DPP',
    'WPA2_PSK_AES_DPP': 'WPA2-PSK+DPP',
    'WPA2_AES_DPP': 'WPA2-Ent+DPP',
    'WPA3_SAE_DPP': 'WPA3-SAE+DPP',
    'WPA3_AES_CCM_128_DPP': 'WPA3-Ent+DPP (CCM)',
    'WPA3_AES_GCM_256_DPP': 'WPA3-Ent+DPP (GCM)',
    'BOTH_WPA_WPA2_PSK': 'WPA/WPA2-PSK',
    'BOTH_WPA_WPA2_DOT1X': 'WPA/WPA2-Enterprise',
    'STATIC_WEP': 'WEP (Static)',
    'DYNAMIC_WEP': 'WEP (Dynamic)',
  };
  let result = opmodeMap[opmode] || opmode;

  // If WPA3 transition mode is enabled, show as SAE/OWE
  if (wpa3TransitionMode) {
    result = 'WPA3-SAE/OWE';
  }

  return result;
};

/**
 * Format RF band for display
 */
const formatRfBand = (band) => {
  if (!band) return 'N/A';
  const bandMap = {
    '24GHZ_5GHZ': '2.4 & 5 GHz',
    '24GHZ_5GHZ_6GHZ': '2.4, 5 & 6 GHz',
    '5GHZ': '5 GHz Only',
    '24GHZ': '2.4 GHz Only',
    '6GHZ': '6 GHz Only',
    '5GHZ_6GHZ': '5 & 6 GHz',
  };
  return bandMap[band] || band;
};

/**
 * Format VLAN for display
 */
const formatVlan = (wlan) => {
  if (wlan.vlanName) return wlan.vlanName;
  if (wlan.vlanIdRange && wlan.vlanIdRange.length > 0) {
    return wlan.vlanIdRange.join(', ');
  }
  return 'N/A';
};

/**
 * Get security features as chips
 */
const getSecurityFeatures = (wlan) => {
  const features = [];
  if (wlan.macAuthentication) features.push('MAC Auth');
  if (wlan.wpa3TransitionMode) features.push('WPA3');
  if (wlan.mfpRequired) features.push('MFP Required');
  else if (wlan.mfpCapable) features.push('MFP Capable');
  if (wlan.captivePortalType && wlan.captivePortalType !== 'NONE') {
    features.push('Captive Portal');
  }
  return features;
};

/**
 * Get 802.11 features as string
 */
const get80211Features = (wlan) => {
  const features = [];
  if (wlan.dot11k) features.push('11k');
  if (wlan.dot11r) features.push('11r');
  if (wlan.dot11v) features.push('11v');
  return features.length > 0 ? features.join('/') : 'None';
};

/**
 * Flatten nested object to dot-notation keys
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
 * Format header name from API key (kebab-case to Title Case)
 */
const formatHeader = (key) => {
  return key
    .replace(/\./g, ' > ')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
};

/**
 * Get all available fields from WLANs for export
 */
const getAvailableFields = (wlans) => {
  if (!wlans || wlans.length === 0) return [];

  // Flatten all raw configs to get all possible keys
  const allKeys = new Set();
  wlans.forEach(wlan => {
    const rawConfig = wlan._rawConfig || {};
    const flat = flattenObject(rawConfig);
    Object.keys(flat).forEach(key => allKeys.add(key));
  });

  // Sort keys for consistent output (basic fields first, then alphabetical)
  const priorityKeys = ['ssid', 'essid.name', 'description', 'enable', 'forward-mode', 'opmode', 'rf-band'];
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
 * Export WLANs to CSV with selected fields
 */
const exportToCSV = (wlans, selectedFields) => {
  if (!wlans || wlans.length === 0 || !selectedFields || selectedFields.length === 0) return;

  // Flatten all raw configs
  const flattenedWlans = wlans.map(wlan => {
    const rawConfig = wlan._rawConfig || {};
    return flattenObject(rawConfig);
  });

  // Build CSV header
  const header = selectedFields.map(key => formatHeader(key)).join(',');

  // Build CSV rows
  const rows = flattenedWlans.map(flat => {
    return selectedFields.map(key => {
      let value = flat[key];

      // Handle null/undefined
      if (value === null || value === undefined) {
        value = '';
      }

      // Escape quotes and wrap in quotes if contains comma
      value = String(value);
      if (value.includes(',') || value.includes('"') || value.includes('\n')) {
        value = `"${value.replace(/"/g, '""')}"`;
      }

      return value;
    }).join(',');
  });

  // Combine and download
  const csv = [header, ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `wlans_export_${new Date().toISOString().split('T')[0]}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/**
 * CSV Export Dialog Component
 */
function CSVExportDialog({ open, onClose, wlans }) {
  const [selectedFields, setSelectedFields] = useState(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [availableFields, setAvailableFields] = useState([]);

  // Default fields to pre-select
  const defaultFields = [
    'ssid', 'description', 'enable', 'forward-mode', 'opmode', 'rf-band',
    'hide-ssid', 'vlan-name', 'vlan-id-range', 'mac-authentication',
    'captive-portal-type', 'wpa3-transition-mode-enable', 'dot11k', 'dot11r', 'dot11v'
  ];

  useEffect(() => {
    if (open && wlans.length > 0) {
      const fields = getAvailableFields(wlans);
      setAvailableFields(fields);
      // Pre-select default fields that exist
      const initialSelected = new Set(defaultFields.filter(f => fields.includes(f)));
      setSelectedFields(initialSelected);
    }
  }, [open, wlans]);

  const handleToggleField = (field) => {
    setSelectedFields(prev => {
      const next = new Set(prev);
      if (next.has(field)) {
        next.delete(field);
      } else {
        next.add(field);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    const filtered = availableFields.filter(f =>
      f.toLowerCase().includes(searchTerm.toLowerCase()) ||
      formatHeader(f).toLowerCase().includes(searchTerm.toLowerCase())
    );
    setSelectedFields(new Set([...selectedFields, ...filtered]));
  };

  const handleDeselectAll = () => {
    if (searchTerm) {
      // Only deselect filtered items
      const filtered = availableFields.filter(f =>
        f.toLowerCase().includes(searchTerm.toLowerCase()) ||
        formatHeader(f).toLowerCase().includes(searchTerm.toLowerCase())
      );
      setSelectedFields(prev => {
        const next = new Set(prev);
        filtered.forEach(f => next.delete(f));
        return next;
      });
    } else {
      setSelectedFields(new Set());
    }
  };

  const handleExport = () => {
    exportToCSV(wlans, Array.from(selectedFields));
    onClose();
  };

  const filteredFields = availableFields.filter(f =>
    f.toLowerCase().includes(searchTerm.toLowerCase()) ||
    formatHeader(f).toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        Export WLANs to CSV
        <Typography variant="body2" color="text.secondary">
          Select fields to include ({selectedFields.size} of {availableFields.length} selected)
        </Typography>
      </DialogTitle>
      <DialogContent>
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
            {filteredFields.map(field => (
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
          </Grid>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          onClick={handleExport}
          disabled={selectedFields.size === 0}
          startIcon={<DownloadIcon />}
        >
          Export ({selectedFields.size} fields)
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function WLANsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [wlans, setWlans] = useState([]);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);

  useEffect(() => {
    fetchWLANs();
  }, []);

  const fetchWLANs = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await wlanAPI.getAll();
      console.log('WLANs API Response:', response);
      // Handle new response format with 'wlans' array
      setWlans(response.wlans || response.items || response.data || []);
    } catch (err) {
      setError(err.message || 'Failed to load WLANs');
    } finally {
      setLoading(false);
    }
  };

  const handleWizardSuccess = () => {
    setWizardOpen(false);
    fetchWLANs();
  };

  // Count statistics
  const enabledCount = wlans.filter(w => w.enabled).length;
  const tunnelCount = wlans.filter(w =>
    w.forwardMode === 'FORWARD_MODE_TUNNEL' ||
    w.forwardMode === 'FORWARD_MODE_L2' ||
    w.forwardMode === 'FORWARD_MODE_L3' ||
    w.forwardMode === 'FORWARD_MODE_SPLIT_TUNNEL'
  ).length;
  const bridgeCount = wlans.filter(w => w.forwardMode === 'FORWARD_MODE_BRIDGE').length;

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
            WLANs / SSIDs
          </Typography>
          <Typography variant="body1" color="text.secondary">
            View and manage wireless networks with full configuration details
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <Button
            startIcon={<DownloadIcon />}
            onClick={() => setExportDialogOpen(true)}
            variant="outlined"
            disabled={wlans.length === 0}
          >
            Export CSV
          </Button>
          <Button
            startIcon={<RefreshIcon />}
            onClick={fetchWLANs}
            variant="outlined"
          >
            Refresh
          </Button>
          <Button
            startIcon={<AddIcon />}
            onClick={() => setWizardOpen(true)}
            variant="contained"
          >
            Create WLAN
          </Button>
        </Box>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {/* Summary Cards */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center">
                <Box>
                  <Typography color="textSecondary" gutterBottom>
                    Total WLANs
                  </Typography>
                  <Typography variant="h4">{wlans.length}</Typography>
                </Box>
                <WifiIcon sx={{ fontSize: 40, color: '#FF6600' }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center">
                <Box>
                  <Typography color="textSecondary" gutterBottom>
                    Enabled
                  </Typography>
                  <Typography variant="h4">{enabledCount}</Typography>
                </Box>
                <SignalIcon sx={{ fontSize: 40, color: '#4caf50' }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center">
                <Box>
                  <Typography color="textSecondary" gutterBottom>
                    Bridge Mode
                  </Typography>
                  <Typography variant="h4">{bridgeCount}</Typography>
                </Box>
                <LanIcon sx={{ fontSize: 40, color: '#2196f3' }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <Card>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center">
                <Box>
                  <Typography color="textSecondary" gutterBottom>
                    Tunnel Mode
                  </Typography>
                  <Typography variant="h4">{tunnelCount}</Typography>
                </Box>
                <RouterIcon sx={{ fontSize: 40, color: '#9c27b0' }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* WLANs Table */}
      <Card>
        <CardContent>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell>SSID</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Forward Mode</TableCell>
                  <TableCell>Encryption</TableCell>
                  <TableCell>RF Band</TableCell>
                  <TableCell>VLAN</TableCell>
                  <TableCell>Security Features</TableCell>
                  <TableCell>802.11</TableCell>
                  <TableCell>Broadcast</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {wlans.length > 0 ? (
                  wlans.map((wlan, index) => (
                    <TableRow key={wlan.ssid || index} hover>
                      <TableCell>
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {wlan.ssid || 'Unknown'}
                          </Typography>
                          {wlan.description && (
                            <Typography variant="caption" color="text.secondary">
                              {wlan.description}
                            </Typography>
                          )}
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={wlan.enabled ? 'Enabled' : 'Disabled'}
                          color={wlan.enabled ? 'success' : 'default'}
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={formatForwardMode(wlan.forwardMode)}
                          color={wlan.forwardMode === 'FORWARD_MODE_TUNNEL' ? 'secondary' : 'primary'}
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {formatEncryption(wlan.opmode, wlan.wpa3TransitionMode)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {formatRfBand(wlan.rfBand)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2">
                          {formatVlan(wlan)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                          {getSecurityFeatures(wlan).map((feature, i) => (
                            <Chip
                              key={i}
                              size="small"
                              label={feature}
                              color="info"
                              variant="outlined"
                              sx={{ fontSize: '0.7rem' }}
                            />
                          ))}
                          {getSecurityFeatures(wlan).length === 0 && (
                            <Typography variant="body2" color="text.secondary">
                              Basic
                            </Typography>
                          )}
                        </Box>
                      </TableCell>
                      <TableCell>
                        <Tooltip title="802.11k/r/v Fast Roaming Features">
                          <Typography variant="body2">
                            {get80211Features(wlan)}
                          </Typography>
                        </Tooltip>
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={wlan.hideSsid ? 'Hidden' : 'Visible'}
                          variant="outlined"
                          color={wlan.hideSsid ? 'warning' : 'default'}
                        />
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={9} align="center">
                      <Typography variant="body2" color="text.secondary">
                        No WLANs found
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* WLAN Creation Wizard */}
      <WLANWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onSuccess={handleWizardSuccess}
      />

      {/* CSV Export Dialog */}
      <CSVExportDialog
        open={exportDialogOpen}
        onClose={() => setExportDialogOpen(false)}
        wlans={wlans}
      />
    </Box>
  );
}

export default WLANsPage;
