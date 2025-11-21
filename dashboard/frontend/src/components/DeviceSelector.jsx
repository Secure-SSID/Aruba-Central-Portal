/**
 * Device Selector Component
 * Reusable dropdown for selecting devices when serial is required
 * Displays device name but uses serial number in API calls
 */

import { useState, useEffect } from 'react';
import {
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  Alert,
  Typography,
  Chip,
  Box,
} from '@mui/material';
import { deviceAPI, monitoringAPIv2 } from '../services/api';

function DeviceSelector({ 
  value, 
  onChange, 
  required = false, 
  label = 'Device',
  helperText,
  disabled = false,
  error = false,
  fullWidth = true,
  deviceType = null, // 'AP', 'SWITCH', 'GATEWAY', or null for all
  sx = {},
}) {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    loadDevices();
  }, [deviceType]);

  const loadDevices = async () => {
    try {
      setLoading(true);
      setErrorMsg('');
      console.log('🔍 DeviceSelector: Loading devices...', deviceType ? `(filter: ${deviceType})` : '');
      
      // Try multiple endpoints to get devices (more robust)
      const [devicesData, switchesData, apsData, gatewaysData] = await Promise.allSettled([
        deviceAPI.getAll(),
        deviceAPI.getSwitches(),
        deviceAPI.getAccessPoints(),
        monitoringAPIv2.getGatewaysMonitoring(),
      ]);
      
      let allDevices = [];
      
      // Process all devices
      if (devicesData.status === 'fulfilled') {
        const data = devicesData.value;
        let devicesList = [];
        if (Array.isArray(data)) {
          devicesList = data;
        } else if (data && typeof data === 'object') {
          devicesList = data.items || data.data || data.devices || [];
        }
        allDevices = [...allDevices, ...devicesList];
      } else {
        console.warn('⚠️ DeviceSelector: Devices API failed:', devicesData.reason);
      }
      
      // Process switches
      if (switchesData.status === 'fulfilled') {
        const data = switchesData.value;
        let switchesList = [];
        if (Array.isArray(data)) {
          switchesList = data;
        } else if (data && typeof data === 'object') {
          switchesList = data.items || data.switches || data.data || [];
        }
        allDevices = [...allDevices, ...switchesList];
      } else {
        console.warn('⚠️ DeviceSelector: Switches API failed:', switchesData.reason);
      }
      
      // Process APs
      if (apsData.status === 'fulfilled') {
        const data = apsData.value;
        let apsList = [];
        if (Array.isArray(data)) {
          apsList = data;
        } else if (data && typeof data === 'object') {
          apsList = data.items || data.aps || data.data || [];
        }
        allDevices = [...allDevices, ...apsList];
      } else {
        console.warn('⚠️ DeviceSelector: APs API failed:', apsData.reason);
      }
      
      // Process Gateways
      if (gatewaysData.status === 'fulfilled') {
        const data = gatewaysData.value;
        let gwItems = [];
        if (Array.isArray(data)) {
          gwItems = data;
        } else if (data && typeof data === 'object') {
          gwItems = data.items || data.gateways || data.data || [];
        }
        // Normalize gateway data to common format
        const normalized = gwItems.map((g) => ({
          serial: g.serialNumber || g.serial || g.id,
          serialNumber: g.serialNumber || g.serial,
          name: g.deviceName || g.name || g.hostname || `Gateway ${g.serialNumber || g.serial || g.id}`,
          deviceName: g.deviceName || g.name || g.hostname,
          type: 'GATEWAY',
          deviceType: 'GATEWAY',
          model: g.model || g.platformModel || g.platform || '',
          ...g
        }));
        allDevices = [...allDevices, ...normalized];
      } else {
        console.warn('⚠️ DeviceSelector: Gateways API failed:', gatewaysData.reason);
      }
      
      // Remove duplicates by serial number
      const deviceMap = new Map();
      allDevices.forEach(device => {
        const serial = device.serial || device.serialNumber || device.device_id || device.id;
        if (serial && !deviceMap.has(serial)) {
          deviceMap.set(serial, device);
        }
      });
      
      // Filter by device type if specified
      let devicesList = Array.from(deviceMap.values());
      if (deviceType) {
        devicesList = devicesList.filter(device => {
          const type = device.device_type || device.type || device.deviceType;
          return type && type.toUpperCase() === deviceType.toUpperCase();
        });
      }
      
      // Normalize device data - ensure we have serial and name
      devicesList = devicesList.map(device => {
        // Get serial from various possible fields
        const serial = device.serial || device.serialNumber || device.device_id || device.id;
        return {
          serial: serial,
          serialNumber: device.serialNumber || device.serial || serial, // Keep both for compatibility
          name: device.name || device.deviceName || device.device_name || device.display_name || device.hostname || `Device ${serial}`,
          deviceName: device.deviceName || device.name || device.device_name || device.display_name,
          type: device.device_type || device.type || device.deviceType || 'UNKNOWN',
          deviceType: device.deviceType || device.device_type || device.type,
          model: device.model || device.platform || device.platformModel || '',
          ...device
        };
      }).filter(device => device.serial); // Only include devices with serial
      
      console.log(`✅ DeviceSelector: Loaded ${devicesList.length} devices${deviceType ? ` (filtered by ${deviceType})` : ''}`);
      setDevices(devicesList);
    } catch (err) {
      console.error('❌ DeviceSelector: Error loading devices:', err);
      console.error('❌ Error details:', {
        message: err.message,
        response: err.response?.data,
        status: err.response?.status
      });
      setErrorMsg('Failed to load devices. Please check your API configuration.');
      setDevices([]);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (event) => {
    const selectedValue = event.target.value;
    // Find the device to get the serial (check both serial and serialNumber)
    const device = devices.find(d => 
      d.serial === selectedValue || 
      d.serialNumber === selectedValue ||
      (d.serialNumber && d.serial === selectedValue)
    );
    
    if (device) {
      // Use serial as the value (prefer serialNumber if available for API compatibility)
      onChange(device.serialNumber || device.serial);
    } else {
      onChange('');
    }
  };

  const getDeviceTypeColor = (type) => {
    const upperType = (type || '').toUpperCase();
    if (upperType === 'AP' || upperType === 'ACCESS POINT') return 'primary';
    if (upperType === 'SWITCH') return 'secondary';
    if (upperType === 'GATEWAY') return 'success';
    return 'default';
  };

  if (loading) {
    return (
      <FormControl fullWidth={fullWidth} required={required} error={error} disabled={disabled}>
        <InputLabel>{label}</InputLabel>
        <Select value="" label={label} disabled>
          <MenuItem value="">
            <CircularProgress size={20} sx={{ mr: 1 }} />
            Loading devices...
          </MenuItem>
        </Select>
      </FormControl>
    );
  }

  if (errorMsg) {
    return (
      <Alert severity="warning" sx={{ mb: 1 }}>
        {errorMsg}
      </Alert>
    );
  }

  return (
    <FormControl fullWidth={fullWidth} required={required} error={error} disabled={disabled} sx={sx}>
      <InputLabel>{label}</InputLabel>
      <Select
        value={value || ''}
        onChange={handleChange}
        label={label}
        displayEmpty
        MenuProps={{
          PaperProps: {
            sx: {
              maxHeight: 300,
              zIndex: 9999, // High z-index to ensure menu appears above all other content
              '& .MuiMenuItem-root': {
                position: 'relative',
                zIndex: 9999,
              },
            },
          },
          anchorOrigin: {
            vertical: 'bottom',
            horizontal: 'left',
          },
          transformOrigin: {
            vertical: 'top',
            horizontal: 'left',
          },
          disablePortal: false, // Use portal to render menu outside DOM hierarchy
          disableScrollLock: false, // Allow scrolling when menu is open
        }}
        renderValue={(selected) => {
          if (!selected || selected === '') {
            return required ? 'Select a device (required)' : 'Select a device (optional)';
          }
          // Find device by serial or serialNumber
          const device = devices.find(d => 
            d.serial === selected || 
            d.serialNumber === selected ||
            (d.serialNumber && d.serial === selected)
          );
          if (device) {
            const displaySerial = device.serialNumber || device.serial;
            return `${device.name} (${displaySerial})`;
          }
          return selected;
        }}
      >
        {devices.map((device) => {
          const deviceSerial = device.serialNumber || device.serial;
          return (
            <MenuItem key={deviceSerial} value={deviceSerial}>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
              <Box>
                <Typography variant="body2">{device.name}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {deviceSerial} {device.model ? `• ${device.model}` : ''}
                </Typography>
              </Box>
              <Chip 
                label={device.type} 
                size="small" 
                color={getDeviceTypeColor(device.type)}
                sx={{ ml: 1 }}
              />
            </Box>
          </MenuItem>
          );
        })}
      </Select>
      {helperText && (
        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
          {helperText}
        </Typography>
      )}
    </FormControl>
  );
}

export default DeviceSelector;

