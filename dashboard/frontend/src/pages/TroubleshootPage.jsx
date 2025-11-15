/**
 * Troubleshooting Page Component - Enhanced with Show Commands
 * Tools for diagnosing network issues and viewing device configurations
 */

import { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Paper,
  Alert,
  CircularProgress,
  Tabs,
  Tab,
  Divider,
  Autocomplete,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  NetworkCheck as NetworkCheckIcon,
  BugReport as BugReportIcon,
  PhonelinkRing as PhonelinkRingIcon,
  Description as DescriptionIcon,
  Code as CodeIcon,
  Info as InfoIcon,
  Settings as SettingsIcon,
  ViewModule as ViewModuleIcon,
  Download as DownloadIcon,
  ContentCopy as ContentCopyIcon,
} from '@mui/icons-material';
import { troubleshootAPI, deviceAPI, showCommandsAPI } from '../services/api';

function TroubleshootPage() {
  const [tabValue, setTabValue] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [success, setSuccess] = useState('');

  // Device lists
  const [switches, setSwitches] = useState([]);
  const [accessPoints, setAccessPoints] = useState([]);
  const [devicesLoading, setDevicesLoading] = useState(true);

  // Ping test state
  const [deviceSerial, setDeviceSerial] = useState('');
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [pingTarget, setPingTarget] = useState('');

  // Device logs state
  const [logsSerial, setLogsSerial] = useState('');
  const [selectedLogsDevice, setSelectedLogsDevice] = useState(null);

  // Client session state
  const [clientMac, setClientMac] = useState('');

  // AP diagnostics state
  const [apSerial, setApSerial] = useState('');
  const [selectedAP, setSelectedAP] = useState(null);

  // Show commands state
  const [showCmdSerial, setShowCmdSerial] = useState('');
  const [selectedShowDevice, setSelectedShowDevice] = useState(null);

  // Fetch devices on component mount
  useEffect(() => {
    fetchDevices();
  }, []);

  const fetchDevices = async () => {
    try {
      setDevicesLoading(true);
      const [switchesData, apsData] = await Promise.allSettled([
        deviceAPI.getSwitches(),
        deviceAPI.getAccessPoints(),
      ]);

      if (switchesData.status === 'fulfilled') {
        const switchList = switchesData.value.switches || switchesData.value.items || [];
        setSwitches(switchList);
      }

      if (apsData.status === 'fulfilled') {
        const apList = apsData.value.aps || apsData.value.items || [];
        setAccessPoints(apList);
      }
    } catch (err) {
      console.error('Error fetching devices:', err);
    } finally {
      setDevicesLoading(false);
    }
  };

  const handlePingTest = async () => {
    if (!deviceSerial || !pingTarget) {
      setError('Please enter both device serial and target');
      return;
    }

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const response = await troubleshootAPI.ping(deviceSerial, pingTarget);
      setResult(response);
    } catch (err) {
      setError(err.message || 'Ping test failed');
    } finally {
      setLoading(false);
    }
  };

  const handleGetDeviceLogs = async () => {
    if (!logsSerial) {
      setError('Please enter device serial');
      return;
    }

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const response = await troubleshootAPI.getDeviceLogs(logsSerial);
      setResult(response);
    } catch (err) {
      setError(err.message || 'Failed to fetch device logs');
    } finally {
      setLoading(false);
    }
  };

  const handleGetClientSession = async () => {
    if (!clientMac) {
      setError('Please enter client MAC address');
      return;
    }

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const response = await troubleshootAPI.getClientSession(clientMac);
      setResult(response);
    } catch (err) {
      setError(err.message || 'Failed to fetch client session');
    } finally {
      setLoading(false);
    }
  };

  const handleGetAPDiagnostics = async () => {
    if (!apSerial) {
      setError('Please enter AP serial');
      return;
    }

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const response = await troubleshootAPI.getAPDiagnostics(apSerial);
      setResult(response);
    } catch (err) {
      setError(err.message || 'Failed to fetch AP diagnostics');
    } finally {
      setLoading(false);
    }
  };

  // Show Commands Handlers
  const handleShowRunConfig = async () => {
    if (!showCmdSerial) {
      setError('Please enter device serial');
      return;
    }

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const response = await showCommandsAPI.getRunConfig(showCmdSerial);
      setResult(response);
    } catch (err) {
      setError(err.message || 'Failed to fetch running config');
    } finally {
      setLoading(false);
    }
  };

  const handleShowTechSupport = async () => {
    if (!showCmdSerial) {
      setError('Please enter device serial');
      return;
    }

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const response = await showCommandsAPI.getTechSupport(showCmdSerial);
      setResult(response);
    } catch (err) {
      setError(err.message || 'Failed to fetch tech-support');
    } finally {
      setLoading(false);
    }
  };

  const handleShowVersion = async () => {
    if (!showCmdSerial) {
      setError('Please enter device serial');
      return;
    }

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const response = await showCommandsAPI.getVersion(showCmdSerial);
      setResult(response);
    } catch (err) {
      setError(err.message || 'Failed to fetch version info');
    } finally {
      setLoading(false);
    }
  };

  const handleShowInterfaces = async () => {
    if (!showCmdSerial) {
      setError('Please enter device serial');
      return;
    }

    setLoading(true);
    setError('');
    setResult(null);

    try {
      const response = await showCommandsAPI.getInterfaces(showCmdSerial);
      setResult(response);
    } catch (err) {
      setError(err.message || 'Failed to fetch interfaces');
    } finally {
      setLoading(false);
    }
  };

  const handleExportConfig = async () => {
    if (!showCmdSerial) {
      setError('Please enter device serial');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const blob = await showCommandsAPI.exportConfig(showCmdSerial);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${showCmdSerial}_config.txt`;
      a.click();
      window.URL.revokeObjectURL(url);
      setSuccess('Configuration exported successfully');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(err.message || 'Failed to export config');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    const text = JSON.stringify(result, null, 2);
    navigator.clipboard.writeText(text);
    setSuccess('Copied to clipboard!');
    setTimeout(() => setSuccess(''), 2000);
  };

  return (
    <Box>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
          Network Troubleshooting
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Diagnostic tools for troubleshooting network connectivity and viewing device configurations
        </Typography>
      </Box>

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Tabs
                value={tabValue}
                onChange={(e, v) => setTabValue(v)}
                sx={{ mb: 3 }}
                variant="scrollable"
                scrollButtons="auto"
              >
                <Tab icon={<NetworkCheckIcon />} label="Ping" />
                <Tab icon={<DescriptionIcon />} label="Logs" />
                <Tab icon={<PhonelinkRingIcon />} label="Client" />
                <Tab icon={<BugReportIcon />} label="AP Diag" />
                <Tab icon={<CodeIcon />} label="Show Cmd" />
              </Tabs>

              {/* Ping Test Tab */}
              {tabValue === 0 && (
                <Box>
                  <Typography variant="h6" gutterBottom>
                    Ping Test from Device
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                    Test network connectivity by running ping from a device
                  </Typography>

                  <Autocomplete
                    fullWidth
                    options={[...switches, ...accessPoints]}
                    getOptionLabel={(option) => option.deviceName || option.serialNumber || 'Unknown Device'}
                    value={selectedDevice}
                    onChange={(event, newValue) => {
                      setSelectedDevice(newValue);
                      if (newValue) {
                        setDeviceSerial(newValue.serialNumber || '');
                      }
                    }}
                    loading={devicesLoading}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Select Device by Name"
                        placeholder="Choose a switch or AP"
                      />
                    )}
                    renderOption={(props, option) => (
                      <li {...props} key={option.serialNumber}>
                        <Box>
                          <Typography variant="body2">{option.deviceName || 'N/A'}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {option.serialNumber} - {option.model || 'N/A'}
                          </Typography>
                        </Box>
                      </li>
                    )}
                    sx={{ mb: 2 }}
                  />

                  <TextField
                    fullWidth
                    label="Device Serial Number"
                    value={deviceSerial}
                    onChange={(e) => {
                      setDeviceSerial(e.target.value);
                      setSelectedDevice(null);
                    }}
                    sx={{ mb: 2 }}
                    placeholder="e.g., CNXXXXXXXX or select device above"
                    helperText="Auto-populated when selecting a device by name"
                  />

                  <TextField
                    fullWidth
                    label="Target IP or Hostname"
                    value={pingTarget}
                    onChange={(e) => setPingTarget(e.target.value)}
                    sx={{ mb: 3 }}
                    placeholder="e.g., 8.8.8.8 or google.com"
                  />

                  <Button
                    variant="contained"
                    fullWidth
                    onClick={handlePingTest}
                    disabled={loading}
                    startIcon={loading ? <CircularProgress size={20} /> : <NetworkCheckIcon />}
                  >
                    {loading ? 'Running Ping...' : 'Run Ping Test'}
                  </Button>
                </Box>
              )}

              {/* Device Logs Tab */}
              {tabValue === 1 && (
                <Box>
                  <Typography variant="h6" gutterBottom>
                    Device Logs
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                    Retrieve recent logs from a device for troubleshooting
                  </Typography>

                  <Autocomplete
                    fullWidth
                    options={[...switches, ...accessPoints]}
                    getOptionLabel={(option) => option.deviceName || option.serialNumber || 'Unknown Device'}
                    value={selectedLogsDevice}
                    onChange={(event, newValue) => {
                      setSelectedLogsDevice(newValue);
                      if (newValue) {
                        setLogsSerial(newValue.serialNumber || '');
                      }
                    }}
                    loading={devicesLoading}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Select Device by Name"
                        placeholder="Choose a switch or AP"
                      />
                    )}
                    renderOption={(props, option) => (
                      <li {...props} key={option.serialNumber}>
                        <Box>
                          <Typography variant="body2">{option.deviceName || 'N/A'}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {option.serialNumber} - {option.model || 'N/A'}
                          </Typography>
                        </Box>
                      </li>
                    )}
                    sx={{ mb: 2 }}
                  />

                  <TextField
                    fullWidth
                    label="Device Serial Number"
                    value={logsSerial}
                    onChange={(e) => {
                      setLogsSerial(e.target.value);
                      setSelectedLogsDevice(null);
                    }}
                    sx={{ mb: 3 }}
                    placeholder="e.g., CNXXXXXXXX or select device above"
                    helperText="Auto-populated when selecting a device by name"
                  />

                  <Button
                    variant="contained"
                    fullWidth
                    onClick={handleGetDeviceLogs}
                    disabled={loading}
                    startIcon={loading ? <CircularProgress size={20} /> : <DescriptionIcon />}
                  >
                    {loading ? 'Fetching Logs...' : 'Get Device Logs'}
                  </Button>
                </Box>
              )}

              {/* Client Session Tab */}
              {tabValue === 2 && (
                <Box>
                  <Typography variant="h6" gutterBottom>
                    Client Session Details
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                    View detailed session information for a connected client
                  </Typography>

                  <TextField
                    fullWidth
                    label="Client MAC Address"
                    value={clientMac}
                    onChange={(e) => setClientMac(e.target.value)}
                    sx={{ mb: 3 }}
                    placeholder="e.g., aa:bb:cc:dd:ee:ff"
                  />

                  <Button
                    variant="contained"
                    fullWidth
                    onClick={handleGetClientSession}
                    disabled={loading}
                    startIcon={loading ? <CircularProgress size={20} /> : <PhonelinkRingIcon />}
                  >
                    {loading ? 'Fetching Session...' : 'Get Client Session'}
                  </Button>
                </Box>
              )}

              {/* AP Diagnostics Tab */}
              {tabValue === 3 && (
                <Box>
                  <Typography variant="h6" gutterBottom>
                    Access Point Diagnostics
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                    Get detailed diagnostic information for an Access Point
                  </Typography>

                  <Autocomplete
                    fullWidth
                    options={accessPoints}
                    getOptionLabel={(option) => option.deviceName || option.serialNumber || 'Unknown AP'}
                    value={selectedAP}
                    onChange={(event, newValue) => {
                      setSelectedAP(newValue);
                      if (newValue) {
                        setApSerial(newValue.serialNumber || '');
                      }
                    }}
                    loading={devicesLoading}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Select AP by Name"
                        placeholder="Choose an access point"
                      />
                    )}
                    renderOption={(props, option) => (
                      <li {...props} key={option.serialNumber}>
                        <Box>
                          <Typography variant="body2">{option.deviceName || 'N/A'}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {option.serialNumber} - {option.model || 'N/A'}
                          </Typography>
                        </Box>
                      </li>
                    )}
                    sx={{ mb: 2 }}
                  />

                  <TextField
                    fullWidth
                    label="AP Serial Number"
                    value={apSerial}
                    onChange={(e) => {
                      setApSerial(e.target.value);
                      setSelectedAP(null);
                    }}
                    sx={{ mb: 3 }}
                    placeholder="e.g., CNXXXXXXXX or select AP above"
                    helperText="Auto-populated when selecting an AP by name"
                  />

                  <Button
                    variant="contained"
                    fullWidth
                    onClick={handleGetAPDiagnostics}
                    disabled={loading}
                    startIcon={loading ? <CircularProgress size={20} /> : <BugReportIcon />}
                  >
                    {loading ? 'Fetching Diagnostics...' : 'Get AP Diagnostics'}
                  </Button>
                </Box>
              )}

              {/* Show Commands Tab */}
              {tabValue === 4 && (
                <Box>
                  <Typography variant="h6" gutterBottom>
                    Show Commands
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                    View device configuration and system information
                  </Typography>

                  <Autocomplete
                    fullWidth
                    options={[...switches, ...accessPoints]}
                    getOptionLabel={(option) => option.deviceName || option.serialNumber || 'Unknown Device'}
                    value={selectedShowDevice}
                    onChange={(event, newValue) => {
                      setSelectedShowDevice(newValue);
                      if (newValue) {
                        setShowCmdSerial(newValue.serialNumber || '');
                      }
                    }}
                    loading={devicesLoading}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        label="Select Device"
                        placeholder="Choose device"
                      />
                    )}
                    renderOption={(props, option) => (
                      <li {...props} key={option.serialNumber}>
                        <Box>
                          <Typography variant="body2">{option.deviceName || 'N/A'}</Typography>
                          <Typography variant="caption" color="text.secondary">
                            {option.serialNumber} - {option.model || 'N/A'}
                          </Typography>
                        </Box>
                      </li>
                    )}
                    sx={{ mb: 2 }}
                  />

                  <TextField
                    fullWidth
                    label="Device Serial Number"
                    value={showCmdSerial}
                    onChange={(e) => {
                      setShowCmdSerial(e.target.value);
                      setSelectedShowDevice(null);
                    }}
                    sx={{ mb: 3 }}
                    placeholder="e.g., CNXXXXXXXX"
                  />

                  <Grid container spacing={2}>
                    <Grid item xs={6}>
                      <Button
                        variant="outlined"
                        fullWidth
                        onClick={handleShowRunConfig}
                        disabled={loading}
                        startIcon={<SettingsIcon />}
                      >
                        Show Run
                      </Button>
                    </Grid>
                    <Grid item xs={6}>
                      <Button
                        variant="outlined"
                        fullWidth
                        onClick={handleShowTechSupport}
                        disabled={loading}
                        startIcon={<BugReportIcon />}
                      >
                        Tech Support
                      </Button>
                    </Grid>
                    <Grid item xs={6}>
                      <Button
                        variant="outlined"
                        fullWidth
                        onClick={handleShowVersion}
                        disabled={loading}
                        startIcon={<InfoIcon />}
                      >
                        Show Version
                      </Button>
                    </Grid>
                    <Grid item xs={6}>
                      <Button
                        variant="outlined"
                        fullWidth
                        onClick={handleShowInterfaces}
                        disabled={loading}
                        startIcon={<ViewModuleIcon />}
                      >
                        Show Interfaces
                      </Button>
                    </Grid>
                    <Grid item xs={12}>
                      <Button
                        variant="contained"
                        fullWidth
                        onClick={handleExportConfig}
                        disabled={loading}
                        startIcon={<DownloadIcon />}
                      >
                        Export Configuration
                      </Button>
                    </Grid>
                  </Grid>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card sx={{ height: '100%' }}>
            <CardContent>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">
                  Results
                </Typography>
                {result && (
                  <Tooltip title="Copy to clipboard">
                    <IconButton size="small" onClick={copyToClipboard}>
                      <ContentCopyIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                )}
              </Box>
              <Divider sx={{ mb: 2 }} />

              {error && (
                <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
                  {error}
                </Alert>
              )}

              {success && (
                <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>
                  {success}
                </Alert>
              )}

              {result ? (
                <Paper sx={{ p: 2, bgcolor: 'background.default', maxHeight: 600, overflow: 'auto' }}>
                  <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: '0.85rem' }}>
                    {JSON.stringify(result, null, 2)}
                  </pre>
                </Paper>
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 4 }}>
                  <BugReportIcon sx={{ fontSize: 64, color: 'text.disabled', mb: 2 }} />
                  <Typography variant="body2" color="text.secondary" align="center">
                    Select a tool and run a diagnostic test to see results here
                  </Typography>
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}

export default TroubleshootPage;
