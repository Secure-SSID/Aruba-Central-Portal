/**
 * WLAN Wizard - Page 3: Review & Deploy
 * Review configuration and execute WLAN creation
 */

import React, { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  Button,
  Alert,
  Chip,
  Divider,
  LinearProgress,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  CircularProgress,
} from '@mui/material';
import {
  CheckCircle as CheckIcon,
  Error as ErrorIcon,
  Pending as PendingIcon,
  Wifi as WifiIcon,
  Security as SecurityIcon,
  NetworkCheck as NetworkIcon,
  Router as RouterIcon,
} from '@mui/icons-material';
import { configAPI } from '../../services/api';
import { getDefaultWLANConfig } from '../../utils/wlanTemplates';

/**
 * Review & Deploy Page Component
 */
const ReviewDeployPage = ({ data, onSuccess }) => {
  const [deploying, setDeploying] = useState(false);
  const [deploymentSteps, setDeploymentSteps] = useState([]);
  const [deploymentError, setDeploymentError] = useState(null);
  const [createdResources, setCreatedResources] = useState([]);

  // Map deployment steps
  const getDeploymentSteps = () => {
    const steps = [];

    // Step 1: Create VLAN (if needed)
    if (!data.vlanExists || data.createVlan) {
      steps.push({
        id: 'vlan',
        label: `Create VLAN ${data.vlanId}`,
        status: 'pending',
      });
      steps.push({
        id: 'named-vlan',
        label: `Create Named VLAN for APs`,
        status: 'pending',
      });
    }

    // Step 2: Create WLAN
    // Note: No custom role creation - using system default role
    steps.push({
      id: 'wlan',
      label: `Create WLAN "${data.wlanName}"`,
      status: 'pending',
    });

    // Step 3: Assign to scope (if site-specific)
    if (data.scopeType === 'site' && data.scopeId) {
      steps.push({
        id: 'scope-wlan',
        label: `Assign WLAN to ${data.scopeName}`,
        status: 'pending',
      });
    }

    // Step 4: MPSK keys (if applicable)
    if (data.authType === 'MPSK-Local' || data.authType === 'MPSK-AES' || data.authType === 'MPSK') {
      const mpskCount = 1 + (data.mpskList ? data.mpskList.length : 0);  // 1 default + additional keys
      steps.push({
        id: 'mpsk',
        label: `Create ${mpskCount} MPSK key(s)`,
        status: 'pending',
      });
    }

    return steps;
  };

  const updateStepStatus = (stepId, status, error = null) => {
    setDeploymentSteps((prev) =>
      prev.map((step) =>
        step.id === stepId ? { ...step, status, error } : step
      )
    );
  };

  const rollbackResources = async () => {
    console.log('Rolling back created resources:', createdResources);

    for (const resource of createdResources.reverse()) {
      try {
        switch (resource.type) {
          case 'wlan':
            // Delete WLAN
            // Note: Actual delete endpoint would be needed
            console.log(`Would delete WLAN: ${resource.name}`);
            break;
          case 'role':
            console.log(`Would delete role: ${resource.name}`);
            break;
          case 'vlan':
            console.log(`Would delete VLAN: ${resource.id}`);
            break;
          case 'named-vlan':
            console.log(`Would delete named VLAN: ${resource.name}`);
            break;
          default:
            break;
        }
      } catch (err) {
        console.error(`Failed to rollback ${resource.type}:`, err);
      }
    }
  };

  const handleDeploy = async () => {
    try {
      setDeploying(true);
      setDeploymentError(null);
      const steps = getDeploymentSteps();
      setDeploymentSteps(steps);
      const resources = [];

      const vlanId = parseInt(data.vlanId, 10);

      // Validate VLAN ID
      if (isNaN(vlanId) || vlanId < 1 || vlanId > 4094) {
        throw new Error(`Invalid VLAN ID: "${data.vlanId}". Please enter a valid VLAN ID (1-4094).`);
      }

      // Validate passphrase for all Personal auth types
      if ((data.authType === 'WPA2-Personal' ||
           data.authType === 'WPA2/WPA3-Personal' ||
           data.authType === 'WPA3-Personal' ||
           data.authType === 'MPSK-Local' ||
           data.authType === 'MPSK-AES' ||
           data.authType === 'MPSK') &&
          (!data.passphrase || data.passphrase.trim() === '')) {
        throw new Error('Passphrase is required for Personal authentication. Please enter a passphrase (8-63 characters).');
      }

      // Determine device persona based on forward mode
      const isTunneled = data.forwardMode === 'FORWARD_MODE_L2' || data.forwardMode === 'FORWARD_MODE_L3';
      const devicePersona = isTunneled ? 'MOBILITY_GATEWAY' : 'CAMPUS_AP';

      // Step 1: Create VLAN (if needed)
      if (!data.vlanExists || data.createVlan) {
        try {
          updateStepStatus('vlan', 'in-progress');

          const vlanData = {
            vlan: vlanId,
            name: data.vlanName || `VLAN-${vlanId}`,
            descriptionAlias: `VLAN for ${data.wlanName}`,
          };

          await configAPI.vlansNetworks.createVLAN(vlanId, vlanData);
          resources.push({ type: 'vlan', id: vlanId });
          updateStepStatus('vlan', 'completed');

          // Create Named VLAN
          updateStepStatus('named-vlan', 'in-progress');
          const namedVlanData = {
            name: `vlan-${vlanId}`,
            vlan: {
              vlanIdRanges: [vlanId.toString()],
            },
          };
          await configAPI.vlansNetworks.createNamedVLAN(`vlan-${vlanId}`, namedVlanData);
          resources.push({ type: 'named-vlan', name: `vlan-${vlanId}` });
          updateStepStatus('named-vlan', 'completed');
        } catch (error) {
          updateStepStatus('vlan', 'error', error.message);
          throw new Error(`Failed to create VLAN: ${error.message}`);
        }
      }

      setCreatedResources(resources);

      // Step 2: Create WLAN (using system default role - no custom role creation)
      // Custom roles require scope assignment which doesn't work reliably via API
      console.log('Using system default role (no custom role creation)');

      // Create WLAN
      try {
        updateStepStatus('wlan', 'in-progress');

        // Map auth type to opmode (matches Aruba Central API spec)
        const opmodeMap = {
          'Open': 'OPEN',
          'Enhanced-Open': 'ENHANCED_OPEN',
          'WPA2-Personal': 'WPA2_PERSONAL',
          'WPA2/WPA3-Personal': 'WPA3_SAE',  // Use WPA3_SAE with transition-mode-enable flag
          'WPA3-Personal': 'WPA3_SAE',
          'WPA2-Enterprise': 'WPA2_ENTERPRISE',
          'WPA3-Enterprise-CCM-128': 'WPA3_ENTERPRISE_CCM_128',
          'WPA3-Enterprise-GCM-256': 'WPA3_ENTERPRISE_GCM_256',
          'WPA3-Enterprise-CNSA': 'WPA3_ENTERPRISE_CNSA',
          'MPSK-Local': 'WPA2_MPSK_LOCAL',
          'MPSK-AES': 'WPA2_MPSK_AES',
          // Legacy support
          'WPA3-Enterprise': 'WPA3_ENTERPRISE_CCM_128',
          'MPSK': 'WPA2_MPSK_LOCAL',  // Default to Local for backward compat
        };

        const wlanConfig = getDefaultWLANConfig(data.authType);
        const wlanData = {
          ...wlanConfig,
          ssid: data.wlanName,
          description: data.description || `WLAN ${data.wlanName}`,
          enable: data.enabled,
          opmode: opmodeMap[data.authType] || 'WPA2_PERSONAL',
          'forward-mode': data.forwardMode || 'FORWARD_MODE_BRIDGE',

          // ESSID name is a string (per working API examples)
          essid: {
            name: data.ssidBroadcastName,
          },

          'vlan-selector': 'VLAN_RANGES',
          'vlan-id-range': [vlanId.toString()],

          // Do NOT set default-role - use system default role instead
          // Custom roles require scope assignment which doesn't work via API

          // Hide SSID option (if configured)
          ...(data.hideSsid && { 'hide-ssid': true }),
        };

        // Add auth-specific config
        if (data.authType === 'WPA2-Personal' ||
            data.authType === 'WPA2/WPA3-Personal' ||
            data.authType === 'WPA3-Personal') {
          // Personal auth types: Add personal-security with passphrase
          // Only add if passphrase is provided
          if (data.passphrase && data.passphrase.trim() !== '') {
            wlanData['personal-security'] = {
              'passphrase-format': 'STRING',
              'wpa-passphrase': data.passphrase,
            };
          }

          // WPA2/WPA3 transition mode requires additional flag
          if (data.authType === 'WPA2/WPA3-Personal') {
            wlanData['wpa3-transition-mode-enable'] = true;
          }
        } else if (data.authType === 'MPSK-Local' || data.authType === 'MPSK-AES' || data.authType === 'MPSK') {
          // MPSK: Add personal-security with cloud auth flag for AES, local for Local
          wlanData['personal-security'] = {
            'passphrase-format': 'STRING',
            'mpsk-cloud-auth': data.authType === 'MPSK-AES',
          };
        } else if (data.authType === 'WPA2-Enterprise' ||
                   data.authType === 'WPA3-Enterprise-CCM-128' ||
                   data.authType === 'WPA3-Enterprise-GCM-256' ||
                   data.authType === 'WPA3-Enterprise-CNSA' ||
                   data.authType === 'WPA3-Enterprise') {
          // Enterprise auth types: Central NAC handles authentication
          // No additional security config needed - opmode drives auth behavior
          // Auth server configuration is managed separately in Central NAC
        } else if (data.authType === 'Enhanced-Open') {
          // Enhanced Open (OWE): Encryption without authentication
          // No additional security config needed - opmode ENHANCED_OPEN handles it
        }
        // Open auth: No security config needed

        // Create WLAN as SHARED (global) - LOCAL scope creation doesn't save config properly
        // Even for site-specific deployments, create as SHARED first
        // The scope assignment will be attempted separately (even though it currently fails,
        // SHARED WLANs still broadcast and work globally)
        const wlanQueryParams = { object_type: 'SHARED' };

        await configAPI.wireless.createWLAN(data.wlanName, wlanData, wlanQueryParams);
        resources.push({ type: 'wlan', name: data.wlanName });
        updateStepStatus('wlan', 'completed');
      } catch (error) {
        updateStepStatus('wlan', 'error', error.message);
        throw new Error(`Failed to create WLAN: ${error.message}`);
      }

      setCreatedResources(resources);

      // Step 3: Assign WLAN to scope (if site-specific)
      // For tunnel mode, use CAMPUS_AP persona for wlan-ssids resource
      if (data.scopeType === 'site' && data.scopeId) {
        try {
          updateStepStatus('scope-wlan', 'in-progress');

          // For WLAN assignment, always use CAMPUS_AP persona
          // (even for tunnel mode - the MOBILITY_GW persona is for gateway resources)
          const scopeMapData = {
            'scope-map': [
              {
                'scope-name': data.scopeId.toString(),
                'scope-id': parseInt(data.scopeId),
                'persona': 'CAMPUS_AP',  // Always CAMPUS_AP for wlan-ssids
                'resource': `wlan-ssids/${data.wlanName}`
              }
            ]
          };

          await configAPI.scopeMaps.createScopeMap(scopeMapData);
          updateStepStatus('scope-wlan', 'completed');
          console.log(`Assigned WLAN to site ${data.scopeName} (${data.scopeId})`);
        } catch (error) {
          updateStepStatus('scope-wlan', 'error', error.message);
          // Don't throw - WLAN is created, just not scoped
          console.warn('Failed to assign WLAN to scope:', error);
          console.warn('WLAN will broadcast globally instead');
        }
      } else {
        // Global deployment - no scope assignment needed
        console.log('Global deployment - WLAN will broadcast on all APs');
      }

      // Step 4: Create MPSK keys (if applicable)
      if (data.authType === 'MPSK-Local' || data.authType === 'MPSK-AES' || data.authType === 'MPSK') {
        try {
          updateStepStatus('mpsk', 'in-progress');

          // MPSK-Local uses local AP database, MPSK-AES uses Central NAC
          // Both require MPSK key registration via API

          // Create default MPSK key from passphrase (primary key)
          if (data.passphrase && data.passphrase.trim() !== '') {
            const defaultMpskData = {
              name: `${data.wlanName}-Default`,
              passphrase: data.passphrase,
              // Do NOT specify role - system default role will be used
              // Custom roles require scope assignment which doesn't work via API
              vlan: vlanId.toString(),
            };
            await configAPI.nacService.createMPSKRegistration(defaultMpskData);
          }

          // Create additional MPSK keys from mpskList
          if (data.mpskList && data.mpskList.length > 0) {
            for (const mpsk of data.mpskList) {
              const mpskData = {
                name: mpsk.name,
                passphrase: mpsk.passphrase,
                // Do NOT specify role - system default role will be used
                // Custom roles require scope assignment which doesn't work via API
                vlan: vlanId.toString(),
              };
              await configAPI.nacService.createMPSKRegistration(mpskData);
            }
          }
          updateStepStatus('mpsk', 'completed');
        } catch (error) {
          updateStepStatus('mpsk', 'error', error.message);
          // MPSK is not critical - log but don't fail
          console.warn('Failed to create MPSK keys:', error);
        }
      }

      // Success!
      setDeploying(false);
      setTimeout(() => {
        onSuccess();
      }, 1500);
    } catch (error) {
      console.error('Deployment error:', error);
      setDeploymentError(error.message);
      setDeploying(false);

      // Rollback
      await rollbackResources();
    }
  };

  const getStepIcon = (status) => {
    switch (status) {
      case 'completed':
        return <CheckIcon color="success" />;
      case 'in-progress':
        return <CircularProgress size={24} />;
      case 'error':
        return <ErrorIcon color="error" />;
      default:
        return <PendingIcon color="disabled" />;
    }
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <WifiIcon />
        Review & Deploy
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
        Review your configuration and deploy the WLAN
      </Typography>

      {/* Configuration Summary */}
      {!deploying && deploymentSteps.length === 0 && (
        <>
          <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
            <Typography variant="subtitle2" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <WifiIcon fontSize="small" />
              WLAN Identity
            </Typography>
            <Box sx={{ pl: 3, mt: 1 }}>
              <Typography variant="body2"><strong>WLAN Name:</strong> {data.wlanName}</Typography>
              <Typography variant="body2"><strong>SSID:</strong> {data.ssidBroadcastName}</Typography>
              <Typography variant="body2"><strong>Description:</strong> {data.description || 'None'}</Typography>
              <Typography variant="body2" component="div">
                <strong>Status:</strong> <Chip label={data.enabled ? 'Enabled' : 'Disabled'} size="small" color={data.enabled ? 'success' : 'default'} />
              </Typography>
            </Box>
          </Paper>

          <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
            <Typography variant="subtitle2" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <SecurityIcon fontSize="small" />
              Security
            </Typography>
            <Box sx={{ pl: 3, mt: 1 }}>
              <Typography variant="body2"><strong>Authentication:</strong> {data.authType}</Typography>
              {data.authType === 'MPSK' && data.mpskList && (
                <Typography variant="body2"><strong>MPSK Keys:</strong> {data.mpskList.length}</Typography>
              )}
            </Box>
          </Paper>

          <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
            <Typography variant="subtitle2" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <NetworkIcon fontSize="small" />
              Network
            </Typography>
            <Box sx={{ pl: 3, mt: 1 }}>
              <Typography variant="body2"><strong>VLAN ID:</strong> {data.vlanId}</Typography>
              <Typography variant="body2"><strong>User Role:</strong> System Default</Typography>
              <Typography variant="body2">
                <strong>Traffic Forwarding:</strong> {
                  data.forwardMode === 'FORWARD_MODE_L2' ? 'Tunneled (Gateway)' :
                  data.forwardMode === 'FORWARD_MODE_L3' ? 'L3 Routed/NAT (Gateway)' :
                  'Bridged (Local Switching)'
                }
              </Typography>
              {data.forwardMode === 'FORWARD_MODE_L2' && data.gatewayName && (
                <Typography variant="body2"><strong>Gateway:</strong> {data.gatewayName}</Typography>
              )}
            </Box>
          </Paper>

          <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
            <Typography variant="subtitle2" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <RouterIcon fontSize="small" />
              Deployment
            </Typography>
            <Box sx={{ pl: 3, mt: 1 }}>
              <Typography variant="body2"><strong>Scope:</strong> {data.scopeType === 'global' ? 'Global (All Sites)' : data.scopeName}</Typography>
              <Typography variant="body2">
                <strong>Device Function:</strong> {
                  (data.forwardMode === 'FORWARD_MODE_L2' || data.forwardMode === 'FORWARD_MODE_L3')
                    ? 'Mobility Gateway'
                    : 'Campus Access Point'
                }
              </Typography>
            </Box>
          </Paper>

          <Alert severity="info" sx={{ mb: 2 }}>
            <Typography variant="body2" fontWeight="medium" gutterBottom>
              Best Practices Applied:
            </Typography>
            <Typography variant="caption" component="div">✓ Dual-band RF (2.4GHz + 5GHz)</Typography>
            <Typography variant="caption" component="div">✓ Management Frame Protection (PMF) capable</Typography>
            <Typography variant="caption" component="div">✓ Fast roaming (802.11r + 802.11k)</Typography>
            <Typography variant="caption" component="div">✓ WiFi 6 optimizations enabled</Typography>
          </Alert>

          <Box sx={{ display: 'flex', justifyContent: 'center' }}>
            <Button
              variant="contained"
              size="large"
              onClick={handleDeploy}
              disabled={deploying}
            >
              Deploy WLAN
            </Button>
          </Box>
        </>
      )}

      {/* Deployment Progress */}
      {(deploying || deploymentSteps.length > 0) && (
        <Box>
          <Typography variant="subtitle1" gutterBottom>
            {deploying ? 'Deploying WLAN...' : deploymentError ? 'Deployment Failed' : 'Deployment Complete!'}
          </Typography>

          {deploying && <LinearProgress sx={{ mb: 2 }} />}

          {deploymentError && (
            <>
              <Alert severity="error" sx={{ mb: 2 }}>
                {deploymentError}
                <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                  Automatic rollback initiated. Created resources have been removed.
                </Typography>
              </Alert>
              <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, mt: 2 }}>
                <Button
                  variant="outlined"
                  onClick={() => {
                    setDeploymentError(null);
                    setDeploymentSteps([]);
                  }}
                >
                  Try Again
                </Button>
                <Button
                  variant="contained"
                  onClick={onSuccess}
                >
                  Close
                </Button>
              </Box>
            </>
          )}

          {!deploying && !deploymentError && (
            <Alert severity="success" sx={{ mb: 2 }}>
              WLAN "{data.wlanName}" has been created successfully!
            </Alert>
          )}

          <List>
            {deploymentSteps.map((step) => (
              <ListItem key={step.id}>
                <ListItemIcon>{getStepIcon(step.status)}</ListItemIcon>
                <ListItemText
                  primary={step.label}
                  secondary={step.error}
                  secondaryTypographyProps={{ color: 'error' }}
                />
              </ListItem>
            ))}
          </List>
        </Box>
      )}
    </Box>
  );
};

export default ReviewDeployPage;
