/**
 * WLAN Wizard - Page 2: Authentication & Network
 * Configure authentication and network settings
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Typography,
  Alert,
  Paper,
  Button,
  IconButton,
  InputAdornment,
  Chip,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
} from '@mui/material';
import {
  Security as SecurityIcon,
  NetworkCheck as NetworkIcon,
  Visibility,
  VisibilityOff,
  Add as AddIcon,
  Delete as DeleteIcon,
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
  Help as HelpIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import { validatePassphrase, validateVLANID, validateVLANName } from '../../utils/wlanValidation';
import { SECURITY_LEVEL_OPTIONS, AUTH_TYPE_OPTIONS_BY_LEVEL, AUTH_TYPE_OPTIONS } from '../../utils/wlanTemplates';
import { configAPI, monitoringAPIv2 } from '../../services/api';
import CreateVLANDialog from './CreateVLANDialog';

/**
 * Authentication & Network Page Component
 */
const AuthNetworkPage = ({ data, onUpdate }) => {
  const [errors, setErrors] = useState({});
  const [showPassword, setShowPassword] = useState(false);
  const [checkingVLAN, setCheckingVLAN] = useState(false);
  const [vlanCheckResult, setVlanCheckResult] = useState(null);
  const [createVLANDialogOpen, setCreateVLANDialogOpen] = useState(false);
  const [gateways, setGateways] = useState([]);
  const [loadingGateways, setLoadingGateways] = useState(false);
  const [gatewayVlans, setGatewayVlans] = useState([]);
  const [loadingGatewayVlans, setLoadingGatewayVlans] = useState(false);

  // Check VLAN existence when VLAN ID changes
  useEffect(() => {
    if (data.vlanId && data.vlanId !== '') {
      checkVLANExists();
    }
  }, [data.vlanId]);

  // Fetch gateways when tunnel mode is selected
  useEffect(() => {
    if (data.forwardMode === 'FORWARD_MODE_L2') {
      fetchGateways();
    }
  }, [data.forwardMode]);

  const fetchGateways = async () => {
    try {
      setLoadingGateways(true);
      const response = await monitoringAPIv2.getGatewaysMonitoring();
      console.log('Gateway API response:', response);

      // Handle both response.items and response.gateways (same as DevicesPage)
      const gwItems = response.items || response.gateways || [];

      // Normalize to common fields for display
      const normalized = gwItems.map((g) => ({
        serial: g.serialNumber || g.serial || g.id || '',
        name: g.deviceName || g.name || g.hostname || '',
        model: g.model || g.platformModel || g.platform || '',
        ip_address: g.ipv4 || g.ipAddress || g.ip || '',
        status: g.status || g.deviceStatus || g.state || '',
        macAddress: g.macAddress || g.mac || '',
      }));

      console.log('Normalized gateways:', normalized);
      setGateways(normalized);

      // Auto-select first gateway if none selected
      if (normalized.length > 0 && !data.gatewaySerial) {
        onUpdate({
          gatewaySerial: normalized[0].serial,
          gatewayName: normalized[0].name
        });
      }
    } catch (error) {
      console.error('Error fetching gateways:', error);
      setGateways([]);
    } finally {
      setLoadingGateways(false);
    }
  };

  // Fetch VLANs when gateway is selected for tunnel mode
  useEffect(() => {
    if (data.forwardMode === 'FORWARD_MODE_L2' && data.gatewaySerial) {
      fetchGatewayVlans(data.gatewaySerial);
    }
  }, [data.gatewaySerial, data.forwardMode]);

  const fetchGatewayVlans = async (gatewaySerial) => {
    try {
      setLoadingGatewayVlans(true);
      setGatewayVlans([]);

      const response = await monitoringAPIv2.getGatewayVlans(gatewaySerial);
      console.log('Gateway VLANs API response:', response);

      // Extract VLAN IDs from response
      // Response format may vary - handle common structures
      let vlanList = [];

      if (response.vlans && Array.isArray(response.vlans)) {
        vlanList = response.vlans;
      } else if (response['layer2-vlans'] && Array.isArray(response['layer2-vlans'])) {
        vlanList = response['layer2-vlans'];
      } else if (Array.isArray(response)) {
        vlanList = response;
      }

      // Extract VLAN IDs
      const vlans = vlanList.map(v => ({
        id: v.vlan_id || v['vlan-id'] || v.id || v,
        name: v.name || v.vlan_name || v['vlan-name'] || `VLAN ${v.vlan_id || v.id || v}`,
      })).filter(v => v.id != null);  // Filter out invalid VLANs

      console.log('Parsed gateway VLANs:', vlans);
      setGatewayVlans(vlans);

      // If no VLAN selected yet and VLANs available, auto-select first one
      if (vlans.length > 0 && (!data.vlanId || data.vlanId === '')) {
        onUpdate({ vlanId: String(vlans[0].id), vlanExists: true });
      }
    } catch (error) {
      console.error('Error fetching gateway VLANs:', error);
      setGatewayVlans([]);
    } finally {
      setLoadingGatewayVlans(false);
    }
  };

  const checkVLANExists = async () => {
    const validation = validateVLANID(data.vlanId);
    if (!validation.valid) {
      setVlanCheckResult({ exists: false, error: validation.error });
      return;
    }

    try {
      setCheckingVLAN(true);
      setVlanCheckResult(null);

      const exists = await configAPI.vlansNetworks.vlanExists(parseInt(data.vlanId, 10));

      if (exists) {
        // Fetch VLAN details
        const vlanDetails = await configAPI.vlansNetworks.getVLAN(parseInt(data.vlanId, 10));
        setVlanCheckResult({
          exists: true,
          name: vlanDetails.name || vlanDetails.vlan_name,
        });
        onUpdate({ vlanExists: true, createVlan: false });
      } else {
        setVlanCheckResult({ exists: false });
        onUpdate({ vlanExists: false });
      }
    } catch (error) {
      console.error('Error checking VLAN:', error);
      setVlanCheckResult({ exists: false, error: 'Failed to check VLAN' });
      onUpdate({ vlanExists: false });
    } finally {
      setCheckingVLAN(false);
    }
  };

  const handleSecurityLevelChange = (e) => {
    const securityLevel = e.target.value;
    onUpdate({ securityLevel });

    // Set recommended auth type based on security level
    const authTypes = AUTH_TYPE_OPTIONS_BY_LEVEL[securityLevel] || [];
    const recommendedAuth = authTypes.find(a => a.recommended);
    if (recommendedAuth) {
      onUpdate({ authType: recommendedAuth.value, securityLevel });
    } else if (authTypes.length > 0) {
      onUpdate({ authType: authTypes[0].value, securityLevel });
    }

    // Clear auth-specific fields when changing security level
    onUpdate({ passphrase: '', mpskList: [] });
  };

  const handleAuthTypeChange = (e) => {
    const authType = e.target.value;
    onUpdate({ authType });

    // Clear auth-specific fields when changing type
    if (authType !== 'WPA2-Personal' && authType !== 'WPA2/WPA3-Personal' && authType !== 'WPA3-Personal' && authType !== 'MPSK-Local' && authType !== 'MPSK-AES' && authType !== 'MPSK') {
      onUpdate({ passphrase: '' });
    }
    if (authType !== 'MPSK-Local' && authType !== 'MPSK-AES' && authType !== 'MPSK') {
      onUpdate({ mpskList: [] });
    }
  };

  const handlePassphraseChange = (e) => {
    const passphrase = e.target.value;
    const validation = validatePassphrase(passphrase);
    setErrors((prev) => ({ ...prev, passphrase: validation.error }));
    onUpdate({ passphrase });
  };

  const handleVLANIDChange = (e) => {
    let vlanId = e.target.value;

    // Only allow positive integers (filter out negative signs and non-digits)
    vlanId = vlanId.replace(/[^0-9]/g, '');

    const validation = validateVLANID(vlanId);

    if (validation.error) {
      setErrors((prev) => ({ ...prev, vlanId: validation.error }));
    } else {
      setErrors((prev) => ({ ...prev, vlanId: null }));
    }

    setVlanCheckResult(null);
    onUpdate({ vlanId });
  };

  const handleVLANNameChange = (e) => {
    const vlanName = e.target.value;
    const validation = validateVLANName(vlanName);
    setErrors((prev) => ({ ...prev, vlanName: validation.error }));
    onUpdate({ vlanName });
  };

  const handleAddMPSK = () => {
    const newMPSK = {
      id: Date.now(),
      name: '',
      passphrase: '',
    };
    onUpdate({ mpskList: [...(data.mpskList || []), newMPSK] });
  };

  const handleRemoveMPSK = (id) => {
    onUpdate({ mpskList: (data.mpskList || []).filter((m) => m.id !== id) });
  };

  const handleMPSKChange = (id, field, value) => {
    onUpdate({
      mpskList: (data.mpskList || []).map((m) =>
        m.id === id ? { ...m, [field]: value } : m
      ),
    });
  };

  const handleCreateVLAN = () => {
    setCreateVLANDialogOpen(true);
  };

  const handleVLANCreated = (vlanId, vlanName) => {
    onUpdate({
      vlanId: vlanId.toString(),
      vlanName,
      vlanExists: true,
      createVlan: false,
    });
    setVlanCheckResult({ exists: true, name: vlanName });
    setCreateVLANDialogOpen(false);
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <SecurityIcon />
        Authentication & Network
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Configure security and network settings for this WLAN
      </Typography>

      {/* Authentication Section */}
      <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
        <Typography variant="subtitle2" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <SecurityIcon fontSize="small" />
          Authentication
        </Typography>

        {/* Security Level Selection */}
        <FormControl fullWidth sx={{ mt: 2 }}>
          <InputLabel>Security Level</InputLabel>
          <Select
            value={data.securityLevel || 'Personal'}
            label="Security Level"
            onChange={handleSecurityLevelChange}
          >
            {SECURITY_LEVEL_OPTIONS.map((option) => (
              <MenuItem key={option.value} value={option.value}>
                <Box>
                  <Typography variant="body2" component="div" sx={{ fontWeight: option.recommended ? 600 : 400 }}>
                    {option.label}
                    {option.recommended && (
                      <Chip label="Recommended" size="small" color="primary" sx={{ ml: 1 }} />
                    )}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {option.description}
                  </Typography>
                </Box>
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* Authentication Type Selection - Based on Security Level */}
        <FormControl fullWidth sx={{ mt: 2 }}>
          <InputLabel>Authentication Type</InputLabel>
          <Select
            value={data.authType}
            label="Authentication Type"
            onChange={handleAuthTypeChange}
          >
            {(AUTH_TYPE_OPTIONS_BY_LEVEL[data.securityLevel || 'Personal'] || []).map((option) => (
              <MenuItem key={option.value} value={option.value}>
                <Box>
                  <Typography variant="body2" component="div">
                    {option.label}
                    {option.recommended && (
                      <Chip label="Recommended" size="small" color="primary" sx={{ ml: 1 }} />
                    )}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {option.description}
                  </Typography>
                </Box>
              </MenuItem>
            ))}
          </Select>
        </FormControl>

        {/* PSK Passphrase Field */}
        {(data.authType === 'WPA2-Personal' ||
          data.authType === 'WPA2/WPA3-Personal' ||
          data.authType === 'WPA3-Personal' ||
          data.authType === 'MPSK-Local' ||
          data.authType === 'MPSK-AES' ||
          data.authType === 'MPSK') && (
          <TextField
            fullWidth
            type={showPassword ? 'text' : 'password'}
            label={
              (data.authType === 'MPSK-Local' || data.authType === 'MPSK-AES' || data.authType === 'MPSK')
                ? 'Default Pre-Shared Key'
                : 'Pre-Shared Key (Passphrase)'
            }
            value={data.passphrase}
            onChange={handlePassphraseChange}
            required
            error={!!errors.passphrase}
            helperText={
              (data.authType === 'MPSK-Local' || data.authType === 'MPSK-AES' || data.authType === 'MPSK')
                ? (errors.passphrase || "Primary MPSK key (8-63 characters)")
                : (errors.passphrase || "8-63 characters")
            }
            sx={{ mt: 2 }}
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    onClick={() => setShowPassword(!showPassword)}
                    edge="end"
                  >
                    {showPassword ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />
        )}

        {/* Enterprise Auth Info */}
        {(data.authType === 'WPA2-Enterprise' ||
          data.authType === 'WPA3-Enterprise-CCM-128' ||
          data.authType === 'WPA3-Enterprise-GCM-256' ||
          data.authType === 'WPA3-Enterprise-CNSA') && (
          <Alert severity="info" sx={{ mt: 2 }}>
            Using <strong>Central NAC</strong> for 802.1X authentication. Clients will be authenticated
            using HPE Aruba Networking Central's built-in NAC service.
          </Alert>
        )}

        {/* MPSK Configuration */}
        {(data.authType === 'MPSK-Local' || data.authType === 'MPSK-AES' || data.authType === 'MPSK') && (
          <Box sx={{ mt: 2 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Typography variant="body2" fontWeight="medium">
                Additional Pre-Shared Keys (Optional)
              </Typography>
              <Button
                startIcon={<AddIcon />}
                size="small"
                onClick={handleAddMPSK}
              >
                Add Key
              </Button>
            </Box>

            {data.mpskList && data.mpskList.length > 0 ? (
              <List dense>
                {data.mpskList.map((mpsk, index) => (
                  <ListItem key={mpsk.id}>
                    <Box sx={{ display: 'flex', gap: 2, flex: 1 }}>
                      <TextField
                        size="small"
                        label={`Key ${index + 1} Name`}
                        value={mpsk.name}
                        onChange={(e) => handleMPSKChange(mpsk.id, 'name', e.target.value)}
                        placeholder="e.g., Guest, Contractor"
                        sx={{ flex: 1 }}
                      />
                      <TextField
                        size="small"
                        type={showPassword ? 'text' : 'password'}
                        label="Passphrase"
                        value={mpsk.passphrase}
                        onChange={(e) => handleMPSKChange(mpsk.id, 'passphrase', e.target.value)}
                        sx={{ flex: 1 }}
                      />
                    </Box>
                    <ListItemSecondaryAction>
                      <IconButton
                        edge="end"
                        onClick={() => handleRemoveMPSK(mpsk.id)}
                        size="small"
                      >
                        <DeleteIcon />
                      </IconButton>
                    </ListItemSecondaryAction>
                  </ListItem>
                ))}
              </List>
            ) : (
              <Alert severity="info" sx={{ mt: 1 }}>
                The default key above will be used. You can add additional MPSK keys here if needed for different user groups.
              </Alert>
            )}
          </Box>
        )}
      </Paper>

      {/* Network Configuration */}
      <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
        <Typography variant="subtitle2" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <NetworkIcon fontSize="small" />
          Network Configuration
        </Typography>

        {/* Forward Mode (Bridged vs Tunneled) - MOVED TO TOP */}
        <FormControl fullWidth sx={{ mt: 2 }}>
          <InputLabel>Traffic Forwarding Mode</InputLabel>
          <Select
            value={data.forwardMode || 'FORWARD_MODE_BRIDGE'}
            label="Traffic Forwarding Mode"
            onChange={(e) => onUpdate({ forwardMode: e.target.value })}
          >
            <MenuItem value="FORWARD_MODE_BRIDGE">
              <Box>
                <Typography variant="body2" component="div" fontWeight="medium">Bridged (Local Switching)</Typography>
                <Typography variant="caption" component="div" color="text.secondary">
                  Traffic switched locally at the AP - best for most deployments
                </Typography>
              </Box>
            </MenuItem>
            <MenuItem value="FORWARD_MODE_L2">
              <Box>
                <Typography variant="body2" component="div" fontWeight="medium">Tunneled (Gateway)</Typography>
                <Typography variant="caption" component="div" color="text.secondary">
                  Traffic tunneled to gateway - requires gateway device
                </Typography>
              </Box>
            </MenuItem>
          </Select>
        </FormControl>

        {/* Gateway Selection - Only shown for tunnel mode - MOVED BEFORE VLAN */}
        {data.forwardMode === 'FORWARD_MODE_L2' && (
          <FormControl fullWidth sx={{ mt: 2 }}>
            <InputLabel>Select Gateway</InputLabel>
            <Select
              value={data.gatewaySerial || ''}
              label="Select Gateway"
              disabled={loadingGateways}
              onChange={(e) => {
                const selectedGateway = gateways.find(gw => gw.serial === e.target.value);
                console.log('Selected gateway:', selectedGateway);
                onUpdate({
                  gatewaySerial: e.target.value,
                  gatewayName: selectedGateway?.name || '',
                });
              }}
              required
            >
              {gateways.map((gateway) => (
                <MenuItem key={gateway.serial} value={gateway.serial}>
                  {gateway.name} ({gateway.serial})
                </MenuItem>
              ))}
            </Select>
            {loadingGateways && (
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, ml: 2 }}>
                Loading gateways...
              </Typography>
            )}
            {!loadingGateways && gateways.length === 0 && (
              <Alert severity="warning" sx={{ mt: 1 }}>
                No gateways found. Please ensure you have gateway devices configured.
              </Alert>
            )}
          </FormControl>
        )}

        {/* VLAN ID - Show dropdown for tunnel mode if VLANs found, otherwise text field */}
        {data.forwardMode === 'FORWARD_MODE_L2' && data.gatewaySerial && gatewayVlans.length > 0 && !loadingGatewayVlans ? (
          // Gateway VLANs available - show dropdown
          <FormControl fullWidth sx={{ mt: 2 }} required error={!!errors.vlanId}>
            <InputLabel>VLAN ID (from Gateway)</InputLabel>
            <Select
              value={data.vlanId || ''}
              label="VLAN ID (from Gateway)"
              onChange={(e) => onUpdate({ vlanId: e.target.value, vlanExists: true })}
            >
              {gatewayVlans.map((vlan) => (
                <MenuItem key={vlan.id} value={String(vlan.id)}>
                  VLAN {vlan.id} - {vlan.name}
                </MenuItem>
              ))}
            </Select>
            <Typography variant="caption" color="success.main" sx={{ mt: 0.5, ml: 2 }}>
              ✓ Showing VLANs configured on the selected gateway
            </Typography>
          </FormControl>
        ) : data.forwardMode === 'FORWARD_MODE_L2' && data.gatewaySerial ? (
          // Tunnel mode but no VLANs found - show text field with warning
          <>
            <TextField
              fullWidth
              type="text"
              label="VLAN ID (Manual Entry)"
              value={data.vlanId}
              onChange={handleVLANIDChange}
              required
              error={!!errors.vlanId}
              helperText={errors.vlanId || "Enter VLAN ID (1-4094)"}
              sx={{ mt: 2 }}
              inputProps={{ inputMode: 'numeric', pattern: '[0-9]*' }}
              InputProps={{
                startAdornment: loadingGatewayVlans ? (
                  <InputAdornment position="start">
                    <CircularProgress size={20} />
                  </InputAdornment>
                ) : null,
              }}
            />
            <Alert severity="warning" icon={<WarningIcon />} sx={{ mt: 1 }}>
              <strong>Important:</strong> For tunnel mode, the VLAN must be pre-configured on gateway <strong>{data.gatewayName || data.gatewaySerial}</strong>.
              If the VLAN doesn't exist, WLAN creation will fail with error "L2-VLAN:X is not configured".
            </Alert>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, ml: 2, display: 'block' }}>
              💡 Tip: Configure VLANs on your gateway in Aruba Central before creating tunnel mode WLANs
            </Typography>
          </>
        ) : (
          <TextField
            fullWidth
            type="text"
            label="VLAN ID"
            value={data.vlanId}
            onChange={handleVLANIDChange}
            required
            error={!!errors.vlanId}
            helperText={errors.vlanId || "VLAN ID (1-4094)"}
            sx={{ mt: 2 }}
            inputProps={{ inputMode: 'numeric', pattern: '[0-9]*' }}
            InputProps={{
              endAdornment: checkingVLAN ? (
                <InputAdornment position="end">
                  <CircularProgress size={20} />
                </InputAdornment>
              ) : vlanCheckResult ? (
                <InputAdornment position="end">
                  {vlanCheckResult.exists ? (
                    <CheckIcon color="success" />
                  ) : (
                    <ErrorIcon color="warning" />
                  )}
                </InputAdornment>
              ) : null,
            }}
          />
        )}

        {/* VLAN Status */}
        {vlanCheckResult && !checkingVLAN && (
          <Box sx={{ mt: 1 }}>
            {vlanCheckResult.exists ? (
              <Alert severity="success" icon={<CheckIcon />}>
                VLAN {data.vlanId} exists: <strong>{vlanCheckResult.name}</strong>
              </Alert>
            ) : vlanCheckResult.error ? (
              <Alert severity="error">{vlanCheckResult.error}</Alert>
            ) : (
              <Alert
                severity="warning"
                action={
                  <Button color="inherit" size="small" onClick={handleCreateVLAN}>
                    Create VLAN
                  </Button>
                }
              >
                VLAN {data.vlanId} doesn't exist. You can create it now or the wizard will create it automatically.
              </Alert>
            )}
          </Box>
        )}
      </Paper>

      {/* Help Text */}
      <Alert severity="info" icon={<HelpIcon />}>
        <Typography variant="body2" fontWeight="medium" gutterBottom>
          Security Best Practices:
        </Typography>
        <Typography variant="caption" component="div">
          • <strong>WPA2-Personal:</strong> Best for simple networks with a single shared password
        </Typography>
        <Typography variant="caption" component="div">
          • <strong>WPA2-Enterprise:</strong> Recommended for corporate networks with user-based authentication
        </Typography>
        <Typography variant="caption" component="div">
          • <strong>MPSK:</strong> Useful when you need different passwords for different user groups
        </Typography>
        <Typography variant="caption" component="div">
          • VLANs provide network segmentation and security isolation
        </Typography>
      </Alert>

      {/* VLAN Creation Dialog */}
      <CreateVLANDialog
        open={createVLANDialogOpen}
        onClose={() => setCreateVLANDialogOpen(false)}
        onSuccess={handleVLANCreated}
        suggestedVlanId={data.vlanId}
      />
    </Box>
  );
};

export default AuthNetworkPage;
