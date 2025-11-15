/**
 * Device Detail Page
 * Displays detailed information about a specific device and provides management options
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Grid,
  Chip,
  Alert,
  CircularProgress,
  Divider,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  TextField,
  Tabs,
  Tab,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  FormControlLabel,
  Switch,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import DevicesIcon from '@mui/icons-material/Devices';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import SettingsIcon from '@mui/icons-material/Settings';
import UpdateIcon from '@mui/icons-material/Update';
import BugReportIcon from '@mui/icons-material/BugReport';
import CloudSyncIcon from '@mui/icons-material/CloudSync';
import InfoIcon from '@mui/icons-material/Info';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import OpenInFullIcon from '@mui/icons-material/OpenInFull';
import LanIcon from '@mui/icons-material/Lan';
import { deviceAPI, monitoringAPIv2 } from '../services/api';
import apiClient from '../services/api';
import Tooltip from '@mui/material/Tooltip';

// Device Image Upload Component with Background Removal
function DeviceImageUpload({ partNumber, onUploadSuccess }) {
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [removeBg, setRemoveBg] = useState(true); // Toggle for background removal

  const handleFileSelect = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }

    setError('');
    setProcessing(true);
    setUploading(true);

    try {
      let processedFile;
      
      // Try to use background removal if enabled and available
      if (removeBg) {
        try {
          // Dynamically import background removal library
          // @vite-ignore tells Vite to skip analysis of this import
          const moduleName = '@imgly/background-removal';
          const bgRemovalModule = await import(/* @vite-ignore */ moduleName);
          const removeBackground = bgRemovalModule.removeBackground;
          
          // Read file as blob
          const imageBlob = await file.arrayBuffer();
          
          // Remove background with conservative settings to preserve device details
          // Using 'medium' model which is less aggressive than 'full'
          const processedBlob = await removeBackground(imageBlob, {
            model: 'medium', // Less aggressive model - preserves more foreground details
          });
          
          // Convert blob to File
          processedFile = new File([processedBlob], `${partNumber}.png`, {
            type: 'image/png',
          });
        } catch (importError) {
          // Fallback: upload original file without background removal
          console.warn('Background removal not available, uploading original image:', importError);
          processedFile = file;
        }
      } else {
        // Background removal disabled - use original file
        processedFile = file;
      }

      // Upload to backend
      const formData = new FormData();
      formData.append('image', processedFile);
      formData.append('partNumber', partNumber);

      // Use apiClient which includes session headers
      // For FormData, we need to let axios set Content-Type automatically (with boundary)
      // So we override the default 'application/json' header
      const response = await apiClient.post('/devices/upload-image', formData, {
        headers: {
          'Content-Type': undefined, // Let axios set it automatically for FormData
        },
      });

      if (response.data.success) {
        if (onUploadSuccess) {
          onUploadSuccess();
        }
        // Refresh page to show new image
        window.location.reload();
      } else {
        setError(response.data.error || 'Upload failed');
      }
    } catch (err) {
      console.error('Error processing/uploading image:', err);
      setError(err.response?.data?.error || err.message || 'Failed to process and upload image');
    } finally {
      setUploading(false);
      setProcessing(false);
      // Reset file input
      event.target.value = '';
    }
  };

  return (
    <Box sx={{ mt: 2 }}>
      <FormControlLabel
        control={
          <Switch
            checked={removeBg}
            onChange={(e) => setRemoveBg(e.target.checked)}
            disabled={uploading || processing}
            size="small"
          />
        }
        label={
          <Typography variant="caption">
            Remove background {removeBg ? '(enabled)' : '(disabled)'}
          </Typography>
        }
        sx={{ mb: 1 }}
      />
      <input
        accept="image/*"
        style={{ display: 'none' }}
        id={`image-upload-${partNumber}`}
        type="file"
        onChange={handleFileSelect}
        disabled={uploading || processing}
      />
      <label htmlFor={`image-upload-${partNumber}`}>
        <Button
          variant="outlined"
          component="span"
          startIcon={<CloudUploadIcon />}
          disabled={uploading || processing}
          fullWidth
        >
          {processing ? (removeBg ? 'Removing Background...' : 'Processing...') : uploading ? 'Uploading...' : 'Upload Device Image'}
        </Button>
      </label>
      {error && (
        <Alert severity="error" sx={{ mt: 1 }}>
          {error}
        </Alert>
      )}
      {processing && (
        <Box sx={{ mt: 1 }}>
          <CircularProgress size={24} />
          <Typography variant="caption" sx={{ ml: 1 }}>
            Processing image...
          </Typography>
        </Box>
      )}
    </Box>
  );
}

// Wired Interfaces View Component
function WiredInterfacesView({ deviceSerial, siteId, partNumber }) {
  const [ports, setPorts] = useState(null);
  const [loading, setLoading] = useState(false);
  const [hoveredPort, setHoveredPort] = useState(null);
  const [deviceMap, setDeviceMap] = useState({}); // Map device name to serial
  const [lldpNeighbors, setLldpNeighbors] = useState({}); // Map port number to neighbor serial
  const navigate = useNavigate();

  // Fetch all devices to create name-to-serial mapping
  useEffect(() => {
    deviceAPI.getAll()
      .then((data) => {
        // Handle both array and object with items property
        const devices = Array.isArray(data) ? data : (data?.items || []);
        
        if (devices && devices.length > 0) {
          const map = {};
          devices.forEach((device) => {
            if (device.serialNumber) {
              // Map by name (case-insensitive)
              if (device.name) {
                const nameLower = device.name.toLowerCase();
                map[nameLower] = device.serialNumber;
                // Also try without hyphens/dashes
                const nameNoDash = nameLower.replace(/[-_]/g, '');
                if (nameNoDash !== nameLower) {
                  map[nameNoDash] = device.serialNumber;
                }
              }
              // Also map by hostname if different
              if (device.hostname) {
                const hostnameLower = device.hostname.toLowerCase();
                map[hostnameLower] = device.serialNumber;
                const hostnameNoDash = hostnameLower.replace(/[-_]/g, '');
                if (hostnameNoDash !== hostnameLower) {
                  map[hostnameNoDash] = device.serialNumber;
                }
              }
              // Map by deviceName if different
              if (device.deviceName && device.deviceName !== device.name && device.deviceName !== device.hostname) {
                const deviceNameLower = device.deviceName.toLowerCase();
                map[deviceNameLower] = device.serialNumber;
                const deviceNameNoDash = deviceNameLower.replace(/[-_]/g, '');
                if (deviceNameNoDash !== deviceNameLower) {
                  map[deviceNameNoDash] = device.serialNumber;
                }
              }
              // Map by serial number itself (in case neighbor is already a serial)
              map[device.serialNumber.toLowerCase()] = device.serialNumber;
            }
          });
          console.log('Device map created (WiredInterfacesView):', {
            size: Object.keys(map).length,
            sampleKeys: Object.keys(map).slice(0, 20),
            allKeys: Object.keys(map).sort(),
            // Check if cx-6300 or SG05KMY0WQ exists
            hasCx6300: map['cx-6300'] || map['cx6300'],
            hasSG05KMY0WQ: Object.keys(map).find(k => map[k] === 'SG05KMY0WQ'),
            devicesWithSG05: devices.filter(d => d.serialNumber === 'SG05KMY0WQ')
          });
          setDeviceMap(map);
        }
      })
      .catch((err) => {
        console.error('Error fetching devices for neighbor mapping:', err);
      });
  }, []);

  useEffect(() => {
    if (deviceSerial && siteId) {
      setLoading(true);
      deviceAPI.getSwitchInterfaces(deviceSerial, siteId)
        .then((data) => {
          if (data && data.items) {
            setPorts(data.items);
          } else if (data && Array.isArray(data)) {
            setPorts(data);
          } else {
            setPorts(null);
          }
        })
        .catch((err) => {
          setPorts(null);
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [deviceSerial, siteId]);

  // Get serial number from neighbor name - try multiple variations
  const getNeighborSerial = async (neighborName) => {
    if (!neighborName) {
      return null;
    }
    
    // If deviceMap is empty, try to fetch it
    if (!deviceMap || Object.keys(deviceMap).length === 0) {
      console.warn('Device map is empty, cannot lookup neighbor:', neighborName);
      return null;
    }
    
    const lowerName = neighborName.toLowerCase();
    
    // Try exact match
    let serial = deviceMap[lowerName];
    if (serial) {
      return serial;
    }
    
    // Try without hyphens/dashes
    const noDash = lowerName.replace(/[-_]/g, '');
    serial = deviceMap[noDash];
    if (serial) {
      return serial;
    }
    
    // Try partial match (contains) - more aggressive
    const matchingKey = Object.keys(deviceMap).find(key => {
      const keyLower = key.toLowerCase();
      return keyLower.includes(lowerName) || lowerName.includes(keyLower) || 
             keyLower.replace(/[-_]/g, '').includes(noDash) || 
             noDash.includes(keyLower.replace(/[-_]/g, ''));
    });
    if (matchingKey) {
      serial = deviceMap[matchingKey];
      return serial;
    }
    
    // Try reverse lookup - check if neighborName might be a serial number itself
    if (deviceMap[lowerName]) {
      return deviceMap[lowerName];
    }
    
    // Last resort: search all device names that contain the neighbor name
    const allKeys = Object.keys(deviceMap);
    const fuzzyMatch = allKeys.find(key => {
      const keyParts = key.split(/[-_\s]/);
      const nameParts = lowerName.split(/[-_\s]/);
      return keyParts.some(kp => nameParts.some(np => kp.includes(np) || np.includes(kp)));
    });
    if (fuzzyMatch) {
      serial = deviceMap[fuzzyMatch];
      return serial;
    }
    
    // Special case: if neighbor name looks like it might be a model number (e.g., "cx-6300")
    // Try to find devices with similar model numbers
    const modelMatch = allKeys.find(key => {
      // Check if key contains numbers from neighbor name
      const neighborNumbers = lowerName.match(/\d+/g);
      const keyNumbers = key.match(/\d+/g);
      if (neighborNumbers && keyNumbers) {
        return neighborNumbers.some(nn => keyNumbers.some(kn => kn.includes(nn) || nn.includes(kn)));
      }
      return false;
    });
    if (modelMatch) {
      serial = deviceMap[modelMatch];
      return serial;
    }
    
    // Only log failures, not successes (to reduce console noise)
    // console.log('Neighbor lookup failed:', { neighborName, deviceMapSize: Object.keys(deviceMap).length });
    
    return null;
  };

  const getPortByNumber = (portNum) => {
    if (!ports) return null;
    return ports.find(p => {
      const parts = (p.id || p.name || '').split('/');
      const num = parts.length > 1 ? parseInt(parts[parts.length - 1]) : parseInt(p.id || p.name || '0');
      return num === portNum;
    });
  };

  const isPortConnected = (portNum) => {
    const port = getPortByNumber(portNum);
    if (!port) return false;
    return port.operStatus === 'Up' || port.status === 'Connected';
  };

  const getPortInfo = (portNum) => {
    return getPortByNumber(portNum);
  };

  // Determine port layout based on part number or port count
  const getPortLayout = () => {
    // Default layout for 14-port switches
    const defaultMainPorts = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];
    const defaultFiberPorts = [15, 16];
    
    if (!ports || ports.length === 0) {
      return { type: 'default', mainPorts: defaultMainPorts, fiberPorts: defaultFiberPorts };
    }
    
    // Check if this is a 48-port switch (like JL659A or Q9H73A)
    const portNumbers = ports.map(p => {
      const parts = (p.id || p.name || '').split('/');
      return parts.length > 1 ? parseInt(parts[parts.length - 1]) : parseInt(p.id || p.name || '0');
    }).filter(n => !isNaN(n) && n > 0);
    
    if (portNumbers.length === 0) {
      return { type: 'default', mainPorts: defaultMainPorts, fiberPorts: defaultFiberPorts };
    }
    
    const maxPortNum = Math.max(...portNumbers);
    
    // JL659A and Q9H73A have 48 ports + fiber ports
    if (partNumber === 'JL659A' || partNumber === 'Q9H73A' || maxPortNum >= 48) {
      // 48 main ports (1-48) + fiber ports (49+ or SFP+ ports)
      const mainPorts = Array.from({ length: 48 }, (_, i) => i + 1);
      // Fiber ports are typically 49-52 or SFP+ ports
      const fiberPorts = portNumbers
        .filter(n => n > 48)
        .sort((a, b) => a - b);
      
      return { type: '48port', mainPorts, fiberPorts };
    }
    
    // Default layout for 14-port switches
    return { type: 'default', mainPorts: defaultMainPorts, fiberPorts: defaultFiberPorts };
  };

  const portLayout = getPortLayout();

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box
      sx={{
        width: '100%',
        overflow: 'auto',
        display: 'flex',
        justifyContent: 'center',
        p: 2,
      }}
    >
      {/* Faceplate Container with Outline - Scales together */}
      <Box
        sx={{
          bgcolor: '#ffffff',
          borderRadius: 'clamp(8px, 1.25vw + 4px, 20px)',
          padding: 'clamp(6px, 0.75vw + 3px, 12px)',
          position: 'relative',
          border: 'clamp(3px, 0.5vw + 2px, 6px) solid #000000',
          boxShadow: 'inset 0 1px 2px rgba(0, 0, 0, 0.05)',
          width: 'fit-content',
          maxWidth: '100%',
          minWidth: 0,
          minHeight: 'clamp(120px, 15vw + 60px, 20px)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transformOrigin: 'center',
          transition: 'transform 0.2s ease',
          overflow: 'hidden',
          // CSS custom property for base size scaling
          '--base-size': 'clamp(1.2rem, 1.5vw + 0.5rem, 2rem)',
        }}
      >
        {/* Conditional Port Layout */}
        {portLayout.type === '48port' ? (
          // 52-port layout: All ports (1-52) in 2 rows - odds on top, evens on bottom
          <Box sx={{ 
            display: 'flex', 
            flexDirection: 'column', 
            gap: 'clamp(2px, 0.3vw + 1px, 6px)',
            '--base-size': 'clamp(1.2rem, 1.5vw + 0.5rem, 2rem)',
            width: '100%',
            maxWidth: '100%',
            minWidth: 0,
          }}>
            {/* Combine all ports (1-52) */}
            {(() => {
              // Ensure we always have ports 1-52, combining main ports and fiber ports
              const allPortsSet = new Set([...portLayout.mainPorts, ...portLayout.fiberPorts]);
              // Fill in any missing ports up to 52
              for (let i = 1; i <= 52; i++) {
                allPortsSet.add(i);
              }
              const allPorts = Array.from(allPortsSet).sort((a, b) => a - b);
              const oddPorts = allPorts.filter(p => p % 2 === 1); // 1, 3, 5, ..., 51
              const evenPorts = allPorts.filter(p => p % 2 === 0); // 2, 4, 6, ..., 52
              
              // Split ports for spacing: copper ports (1-48) and fiber ports (49-52)
              const oddCopper = oddPorts.filter(p => p <= 48);
              const oddFiber = oddPorts.filter(p => p > 48);
              const evenCopper = evenPorts.filter(p => p <= 48);
              const evenFiber = evenPorts.filter(p => p > 48);
              
              const renderPort = (portNum, showNumberAbove = false) => {
                const port = getPortInfo(portNum);
                const connected = isPortConnected(portNum);
                const portLabel = (port?.id || portNum.toString()).split('/').pop();
                const portSize = 'clamp(20px, 2vw + 8px, 28px)';
                const fontSize = 'clamp(6px, 0.6vw + 2px, 8px)';
                const iconSize = 'clamp(8px, 0.8vw + 2px, 10px)';
                const borderWidth = 'clamp(1px, 0.15vw + 0.5px, 1.5px)';
                
                return (
                  <Box key={portNum} sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0, minWidth: 0 }}>
                    {/* Number above for odd ports */}
                    {showNumberAbove && (
                      <Typography variant="caption" sx={{ 
                        fontSize: fontSize,
                        fontWeight: 700, 
                        color: '#000000', 
                        mb: 'clamp(1px, 0.2vw + 0.5px, 3px)', 
                        lineHeight: 1, 
                        height: 'clamp(10px, 1vw + 2px, 12px)'
                      }}>
                        {portNum}
                      </Typography>
                    )}
                    <Tooltip
                      title={
                        port ? (
                          <Box>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                              Port: {port.id || portNum}
                            </Typography>
                            <Typography variant="caption" display="block">
                              Status: {connected ? 'Connected' : 'Disconnected'}
                            </Typography>
                            {port.speed && (
                              <Typography variant="caption" display="block">
                                Speed: {port.speed >= 1000000000 ? `${port.speed / 1000000000}G` : `${port.speed / 1000000}M`}
                              </Typography>
                            )}
                            <Typography variant="caption" display="block">
                              Mode: {port.vlanMode || 'Access'}
                            </Typography>
                          </Box>
                        ) : (
                          `Port ${portNum}`
                        )
                      }
                      arrow
                      disableInteractive
                    >
                      <Box
                        onMouseEnter={() => setHoveredPort(portNum)}
                        onMouseLeave={() => setHoveredPort(null)}
                        onClick={async (e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (!deviceMap || Object.keys(deviceMap).length === 0) return;
                          let neighborSerial = lldpNeighbors[portNum];
                          if (!neighborSerial && port?.neighbour) {
                            neighborSerial = await getNeighborSerial(port.neighbour);
                          }
                          if (neighborSerial) {
                            navigate(`/devices/${neighborSerial}`);
                          }
                        }}
                        sx={{
                          width: portSize,
                          height: portSize,
                          minWidth: 0,
                          minHeight: portSize,
                          flexShrink: 1,
                          flexBasis: portSize,
                          border: connected ? `${borderWidth} dashed #17eba0` : `${borderWidth} solid rgba(0, 0, 0, 0.3)`,
                          borderRadius: 'clamp(2px, 0.3vw + 1px, 4px)',
                          bgcolor: connected ? 'rgba(23, 235, 160, 0.2)' : '#f7f7f7',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: (lldpNeighbors[portNum] || port?.neighbour) ? 'pointer' : 'default',
                          transition: 'all 0.2s ease',
                          transform: hoveredPort === portNum ? 'scale(1.1)' : 'scale(1)',
                          boxShadow: connected
                            ? `0 0 0 ${borderWidth} rgba(23, 235, 160, 0.3), 0 0 10px rgba(23, 235, 160, 0.4)`
                            : 'inset 0 1px 1px rgba(0, 0, 0, 0.05)',
                        }}
                      >
                        {connected && <LanIcon sx={{ fontSize: iconSize, color: '#17eba0' }} />}
                      </Box>
                    </Tooltip>
                    {/* Number below for even ports */}
                    {!showNumberAbove && (
                      <Typography variant="caption" sx={{ 
                        fontSize: fontSize,
                        fontWeight: 700, 
                        color: '#000000', 
                        mt: 'clamp(1px, 0.2vw + 0.5px, 3px)', 
                        lineHeight: 1, 
                        height: 'clamp(10px, 1vw + 2px, 12px)'
                      }}>
                        {portNum}
                      </Typography>
                    )}
                  </Box>
                );
              };

              return (
                <>
                  {/* Top Row - Odd Ports */}
                  <Box sx={{ 
                    display: 'flex', 
                    gap: 'clamp(3px, 0.4vw + 1px, 6px)', 
                    flexWrap: 'nowrap', 
                    justifyContent: 'flex-start', 
                    alignItems: 'flex-start',
                    width: '100%',
                    maxWidth: '100%',
                    minWidth: 0,
                    overflow: 'hidden',
                  }}>
                    {oddCopper.map((portNum) => renderPort(portNum, true))}
                    {oddFiber.length > 0 && (
                      <>
                        <Box sx={{ width: 'clamp(8px, 1vw + 4px, 12px)', flexShrink: 0 }} /> {/* Spacer between copper and fiber */}
                        {oddFiber.map((portNum) => renderPort(portNum, true))}
                      </>
                    )}
                  </Box>
                  
                  {/* Bottom Row - Even Ports */}
                  <Box sx={{ 
                    display: 'flex', 
                    gap: 'clamp(3px, 0.4vw + 1px, 6px)', 
                    flexWrap: 'nowrap', 
                    justifyContent: 'flex-start', 
                    alignItems: 'flex-start',
                    width: '100%',
                    maxWidth: '100%',
                    minWidth: 0,
                    overflow: 'hidden',
                  }}>
                    {evenCopper.map((portNum) => renderPort(portNum, false))}
                    {evenFiber.length > 0 && (
                      <>
                        <Box sx={{ width: 'clamp(8px, 1vw + 4px, 12px)', flexShrink: 0 }} /> {/* Spacer between copper and fiber */}
                        {evenFiber.map((portNum) => renderPort(portNum, false))}
                      </>
                    )}
                  </Box>
                </>
              );
            })()}
          </Box>
        ) : (
          // Default 14-port layout
          <>
            {/* Ports 15-16 (Left Group - SFP+) - Side by Side */}
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'row',
                gap: 2,
                mr: 6,
              }}
            >
              {portLayout.fiberPorts.map((portNum) => {
                const port = getPortInfo(portNum);
                const connected = isPortConnected(portNum);
                const portLabel = (port?.id || portNum.toString()).split('/').pop();
                return (
                  <Tooltip
                    key={portNum}
                    title={
                      port ? (
                        <Box>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            Port: {port.id || portNum}
                          </Typography>
                          <Typography variant="caption" display="block">
                            Status: {connected ? 'Connected' : 'Disconnected'}
                          </Typography>
                          {port.speed && (
                            <Typography variant="caption" display="block">
                              Speed: {port.speed >= 1000000000 ? `${port.speed / 1000000000}G` : `${port.speed / 1000000}M`}
                            </Typography>
                          )}
                          <Typography variant="caption" display="block">
                            Mode: {port.vlanMode || 'Access'}
                          </Typography>
                        </Box>
                      ) : (
                        `Port ${portNum}`
                      )
                    }
                    arrow
                  >
                    <Box
                      onMouseEnter={() => setHoveredPort(portNum)}
                      onMouseLeave={() => setHoveredPort(null)}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        const neighborSerial = lldpNeighbors[portNum] || (port?.neighbour ? getNeighborSerial(port.neighbour) : null);
                        if (neighborSerial) {
                          navigate(`/devices/${neighborSerial}`);
                        } else if (port?.neighbour) {
                          console.warn('No serial found for neighbor:', port.neighbour);
                        }
                      }}
                      sx={{
                        width: 60,
                        height: 60,
                        border: connected
                          ? '2px dashed #17eba0'
                          : '2px solid rgba(0, 0, 0, 0.3)',
                        borderRadius: 1,
                        bgcolor: connected ? 'rgba(23, 235, 160, 0.2)' : '#f7f7f7',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: (lldpNeighbors[portNum] || (port?.neighbour && getNeighborSerial(port.neighbour))) ? 'pointer' : 'default',
                        transition: 'all 0.2s ease',
                        transform: hoveredPort === portNum ? 'scale(1.1)' : 'scale(1)',
                        boxShadow: connected
                          ? '0 0 0 3px rgba(23, 235, 160, 0.3), 0 0 20px rgba(23, 235, 160, 0.6), 0 0 30px rgba(23, 235, 160, 0.4)'
                          : 'inset 0 1px 2px rgba(0, 0, 0, 0.05)',
                      }}
                    >
                      <Typography variant="caption" sx={{ fontSize: '10px', mb: 0.5, fontWeight: 600, color: '#000000' }}>
                        {portLabel}
                      </Typography>
                      {connected && (
                        <LanIcon sx={{ fontSize: 20, color: '#17eba0' }} />
                      )}
                    </Box>
                  </Tooltip>
                );
              })}
            </Box>

            {/* Ports 1-14 (Right Group - Main Ports) */}
            <Box
              sx={{
                display: 'flex',
                flexDirection: 'column',
                gap: 2.5,
              }}
            >
              {/* Top Row - Odd Ports */}
              <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-start', alignItems: 'center', flexWrap: 'nowrap' }}>
                {portLayout.mainPorts.filter((_, i) => i % 2 === 0).map((portNum) => {
              const port = getPortInfo(portNum);
              const connected = isPortConnected(portNum);
              const portLabel = (port?.id || portNum.toString()).split('/').pop();
              return (
                <Tooltip
                  key={portNum}
                  title={
                    port ? (
                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          Port: {port.id || portNum}
                        </Typography>
                        <Typography variant="caption" display="block">
                          Status: {connected ? 'Connected' : 'Disconnected'}
                        </Typography>
                        {port.speed && (
                          <Typography variant="caption" display="block">
                            Speed: {port.speed >= 1000000000 ? `${port.speed / 1000000000}G` : `${port.speed / 1000000}M`}
                          </Typography>
                        )}
                        <Typography variant="caption" display="block">
                          Mode: {port.vlanMode || 'Access'}
                        </Typography>
                        {port.neighbour && (() => {
                          // Check LLDP neighbors first (already has serial), then try lookup
                          const neighborSerial = lldpNeighbors[portNum];
                          return (
                            <Typography variant="caption" display="block" sx={{ mt: 0.5 }}>
                              Neighbor:{' '}
                              {neighborSerial ? (
                                <Typography
                                  component="span"
                                  variant="caption"
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    // Make sure we have the serial
                                    let serial = neighborSerial;
                                    if (!serial && deviceMap && Object.keys(deviceMap).length > 0) {
                                      serial = await getNeighborSerial(port.neighbour);
                                    }
                                    if (serial) {
                                      navigate(`/devices/${serial}`);
                                    }
                                  }}
                                  sx={{
                                    color: 'primary.main',
                                    textDecoration: 'underline',
                                    cursor: 'pointer',
                                    '&:hover': {
                                      color: 'primary.dark',
                                    },
                                  }}
                                >
                                  {port.neighbour}
                                </Typography>
                              ) : (
                                port.neighbour
                              )}
                            </Typography>
                          );
                        })()}
                      </Box>
                    ) : (
                      `Port ${portNum}`
                    )
                  }
                  arrow
                  disableInteractive
                  enterDelay={300}
                >
                  <Box
                    onMouseEnter={() => setHoveredPort(portNum)}
                    onMouseLeave={() => setHoveredPort(null)}
                    onClick={async (e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      // Only proceed if deviceMap is populated
                      if (!deviceMap || Object.keys(deviceMap).length === 0) {
                        console.warn('Device map not ready yet, cannot navigate to neighbor');
                        return;
                      }
                      
                      // Try LLDP neighbor first (already has serial), then fall back to port.neighbour lookup
                      let neighborSerial = lldpNeighbors[portNum];
                      if (!neighborSerial && port?.neighbour) {
                        neighborSerial = await getNeighborSerial(port.neighbour);
                      }
                      
                      if (neighborSerial) {
                        console.log(`Navigating to neighbor device: ${port?.neighbour} -> ${neighborSerial}`);
                        navigate(`/devices/${neighborSerial}`);
                      } else if (port?.neighbour) {
                        console.warn('No serial found for neighbor:', port.neighbour, '- cannot navigate');
                      }
                    }}
                    sx={{
                      width: 50,
                      height: 50,
                      border: connected
                        ? '2px dashed #17eba0'
                        : '2px solid rgba(0, 0, 0, 0.3)',
                      borderRadius: 1,
                      bgcolor: connected ? 'rgba(23, 235, 160, 0.2)' : '#f7f7f7',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: (lldpNeighbors[portNum] || (port?.neighbour && getNeighborSerial(port.neighbour))) ? 'pointer' : 'default',
                      transition: 'all 0.2s ease',
                      transform: hoveredPort === portNum ? 'scale(1.15)' : 'scale(1)',
                      boxShadow: connected
                        ? '0 0 0 3px rgba(23, 235, 160, 0.3), 0 0 20px rgba(23, 235, 160, 0.6), 0 0 30px rgba(23, 235, 160, 0.4)'
                        : 'inset 0 1px 2px rgba(0, 0, 0, 0.05)',
                      position: 'relative',
                    }}
                  >
                    <Typography variant="caption" sx={{ fontSize: '9px', fontWeight: 600, color: '#000000' }}>
                      {portLabel}
                    </Typography>
                    {connected && (
                      <LanIcon sx={{ fontSize: 16, color: '#17eba0', mt: 0.25 }} />
                    )}
                  </Box>
                </Tooltip>
              );
            })}
              </Box>

              {/* Bottom Row - Even Ports */}
              <Box sx={{ display: 'flex', gap: 2, justifyContent: 'flex-start', alignItems: 'center', flexWrap: 'nowrap' }}>
                {portLayout.mainPorts.filter((_, i) => i % 2 === 1).map((portNum) => {
                  const port = getPortInfo(portNum);
                  const connected = isPortConnected(portNum);
                  const portLabel = (port?.id || portNum.toString()).split('/').pop();
                  return (
                    <Tooltip
                      key={portNum}
                      title={
                        port ? (
                          <Box>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                              Port: {port.id || portNum}
                            </Typography>
                            <Typography variant="caption" display="block">
                              Status: {connected ? 'Connected' : 'Disconnected'}
                            </Typography>
                            {port.speed && (
                              <Typography variant="caption" display="block">
                                Speed: {port.speed >= 1000000000 ? `${port.speed / 1000000000}G` : `${port.speed / 1000000}M`}
                              </Typography>
                            )}
                            <Typography variant="caption" display="block">
                              Mode: {port.vlanMode || 'Access'}
                            </Typography>
                            {port.neighbour && (() => {
                              // Check LLDP neighbors first (already has serial), then try lookup
                              const neighborSerial = lldpNeighbors[portNum];
                              return (
                                <Typography variant="caption" display="block" sx={{ mt: 0.5 }}>
                                  Neighbor:{' '}
                                  {neighborSerial ? (
                                    <Typography
                                      component="span"
                                      variant="caption"
                                      onClick={async (e) => {
                                        e.stopPropagation();
                                        // Make sure we have the serial
                                        let serial = neighborSerial;
                                        if (!serial && deviceMap && Object.keys(deviceMap).length > 0) {
                                          serial = await getNeighborSerial(port.neighbour);
                                        }
                                        if (serial) {
                                          navigate(`/devices/${serial}`);
                                        }
                                      }}
                                      sx={{
                                        color: 'primary.main',
                                        textDecoration: 'underline',
                                        cursor: 'pointer',
                                        '&:hover': {
                                          color: 'primary.dark',
                                        },
                                      }}
                                    >
                                      {port.neighbour}
                                    </Typography>
                                  ) : (
                                    port.neighbour
                                  )}
                                </Typography>
                              );
                            })()}
                          </Box>
                        ) : (
                          `Port ${portNum}`
                        )
                      }
                      arrow
                      disableInteractive
                      enterDelay={300}
                    >
                      <Box
                        onMouseEnter={() => setHoveredPort(portNum)}
                        onMouseLeave={() => setHoveredPort(null)}
                        onClick={async (e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          // Only proceed if deviceMap is populated
                          if (!deviceMap || Object.keys(deviceMap).length === 0) {
                            console.warn('Device map not ready yet, cannot navigate to neighbor');
                            return;
                          }
                          
                          // Try LLDP neighbor first (already has serial), then fall back to port.neighbour lookup
                          let neighborSerial = lldpNeighbors[portNum];
                          if (!neighborSerial && port?.neighbour) {
                            neighborSerial = await getNeighborSerial(port.neighbour);
                          }
                          
                          if (neighborSerial) {
                            console.log(`Navigating to neighbor device: ${port?.neighbour} -> ${neighborSerial}`);
                            navigate(`/devices/${neighborSerial}`);
                          } else if (port?.neighbour) {
                            console.warn('No serial found for neighbor:', port.neighbour, '- cannot navigate');
                          }
                        }}
                        sx={{
                          width: 50,
                          height: 50,
                          border: connected
                            ? '2px dashed #17eba0'
                            : '2px solid rgba(0, 0, 0, 0.3)',
                          borderRadius: 1,
                          bgcolor: connected ? 'rgba(23, 235, 160, 0.2)' : '#f7f7f7',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: (lldpNeighbors[portNum] || (port?.neighbour && getNeighborSerial(port.neighbour))) ? 'pointer' : 'default',
                          transition: 'all 0.2s ease',
                          transform: hoveredPort === portNum ? 'scale(1.15)' : 'scale(1)',
                          boxShadow: connected
                            ? '0 0 0 3px rgba(23, 235, 160, 0.3), 0 0 20px rgba(23, 235, 160, 0.6), 0 0 30px rgba(23, 235, 160, 0.4)'
                            : 'inset 0 1px 2px rgba(0, 0, 0, 0.05)',
                        }}
                      >
                        <Typography variant="caption" sx={{ fontSize: '9px', fontWeight: 600, color: '#000000' }}>
                          {portLabel}
                        </Typography>
                        {connected && (
                          <LanIcon sx={{ fontSize: 16, color: '#17eba0', mt: 0.25 }} />
                        )}
                      </Box>
                    </Tooltip>
                  );
                })}
              </Box>
            </Box>
          </>
        )}
      </Box>
    </Box>
  );
}

// Interactive Port Overlay Component
function PortOverlay({ ports, imageRef, deviceMap }) {
  const [hoveredPort, setHoveredPort] = useState(null);
  const [showDebug, setShowDebug] = useState(false); // Toggle with Shift+D
  const navigate = useNavigate();

  // Get serial number from neighbor name - try multiple variations
  const getNeighborSerial = (neighborName) => {
    if (!neighborName || !deviceMap || Object.keys(deviceMap).length === 0) {
      return null;
    }
    
    const lowerName = neighborName.toLowerCase();
    
    // Try exact match
    let serial = deviceMap[lowerName];
    if (serial) return serial;
    
    // Try without hyphens/dashes
    const noDash = lowerName.replace(/[-_]/g, '');
    serial = deviceMap[noDash];
    if (serial) return serial;
    
    // Try partial match (contains)
    const matchingKey = Object.keys(deviceMap).find(key => 
      key.includes(lowerName) || lowerName.includes(key)
    );
    if (matchingKey) return deviceMap[matchingKey];
    
    return null;
  };

  if (!ports || !Array.isArray(ports) || ports.length === 0) {
    return null;
  }

  // Debug mode toggle (Shift+D)
  useEffect(() => {
    const handleKeyPress = (e) => {
      if (e.shiftKey && e.key === 'D') {
        setShowDebug(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, []);

  // Port position mapping for Aruba 6100 switch
  // Positions are percentages from top-left of the image
  // Based on actual switch layout: 12x 1G ports (two rows), 2x 10G ports, 2x SFP+ ports
  const getPortPosition = (port, portAlignment, index) => {
    // Parse port name (e.g., "1/1/15" -> 15)
    const parts = port.split('/');
    const portNum = parts.length > 1 ? parseInt(parts[parts.length - 1]) : parseInt(port);
    
    // Aruba 6100 layout from image:
    // Ports 1-12: 1G BASE-T ports in two rows of 6 (Top row: odd ports, Bottom row: even ports)
    // Ports 13-14: 10G BASE-T ports (right side, above 1G ports)
    // Ports 15-16: SFP+ ports (left side, top)
    
    if (portNum >= 1 && portNum <= 12) {
      // 1G ports - arranged in two rows, alternating Top/Bottom
      // Ports alternate: 1=Top, 2=Bottom, 3=Top, 4=Bottom, etc.
      // Top row positions: ports 1,3,5,7,9,11
      // Bottom row positions: ports 2,4,6,8,10,12
      const isTopRow = portAlignment === 'Top';
      
      // Calculate which position in the row (0-5 for 6 ports per row)
      // Top row: (1-1)/2=0, (3-1)/2=1, (5-1)/2=2, etc.
      // Bottom row: (2-2)/2=0, (4-2)/2=1, (6-2)/2=2, etc.
      const positionInRow = isTopRow 
        ? Math.floor((portNum - 1) / 2)
        : Math.floor((portNum - 2) / 2);
      
      return {
        top: isTopRow ? '45%' : '53%', // Top row higher, bottom row lower
        left: `${25 + positionInRow * 10.5}%`, // Spread evenly across width (6 ports)
      };
    } else if (portNum >= 13 && portNum <= 14) {
      // 10G BASE-T ports - right side, above 1G ports
      const colIndex = portNum - 13; // 0 or 1
      return {
        top: '30%', // Above the 1G ports
        left: `${60 + colIndex * 12}%`, // Right side of image
      };
    } else if (portNum >= 15 && portNum <= 16) {
      // SFP+ ports - left side, top
      const colIndex = portNum - 15; // 0 or 1
      return {
        top: '18%', // Top of image
        left: `${12 + colIndex * 8}%`, // Left side
      };
    }
    
    return null;
  };

  // Format speed from bits per second to readable format
  const formatSpeed = (speedBits) => {
    if (!speedBits) return 'N/A';
    if (speedBits >= 10000000000) return `${speedBits / 10000000000}0G`;
    if (speedBits >= 1000000000) return `${speedBits / 1000000000}G`;
    if (speedBits >= 1000000) return `${speedBits / 1000000}M`;
    if (speedBits >= 1000) return `${speedBits / 1000}K`;
    return `${speedBits} bps`;
  };

  return (
    <>
      {ports.map((port, idx) => {
        const portName = port.id || port.name || port.port || `Port ${idx + 1}`;
        const position = getPortPosition(portName, port.portAlignment || 'Top', port.index || idx + 1);
        if (!position) return null;

        // Check if port is connected - use operStatus and status fields from API
        const isConnected = port.operStatus === 'Up' || port.status === 'Connected';
        const speed = formatSpeed(port.speed);
        const mode = port.vlanMode || 'Access'; // "Trunk" or "Access"
        const vlanInfo = port.vlanMode === 'Trunk' 
          ? `Allowed VLANs: ${port.allowedVlans?.filter(v => v).join(', ') || 'All'}, Native: ${port.nativeVlan}`
          : `VLAN: ${port.nativeVlan}`;

        return (
          <Tooltip
            key={portName}
            title={
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  Port: {portName}
                </Typography>
                <Typography variant="caption" display="block">
                  Status: {isConnected ? 'Connected' : 'Disconnected'}
                </Typography>
                {speed !== 'N/A' && (
                  <Typography variant="caption" display="block">
                    Speed: {speed}
                  </Typography>
                )}
                <Typography variant="caption" display="block">
                  Mode: {mode}
                </Typography>
                <Typography variant="caption" display="block">
                  {vlanInfo}
                </Typography>
                {port.duplex && port.duplex !== '-' && (
                  <Typography variant="caption" display="block">
                    Duplex: {port.duplex}
                  </Typography>
                )}
                {port.neighbour && (() => {
                  // Look up neighbor serial from deviceMap
                  const neighborSerial = getNeighborSerial(port.neighbour);
                  return (
                    <Typography variant="caption" display="block" sx={{ mt: 0.5 }}>
                      Neighbor:{' '}
                      {neighborSerial ? (
                        <Typography
                          component="span"
                          variant="caption"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/devices/${neighborSerial}`);
                          }}
                          sx={{
                            color: 'primary.main',
                            textDecoration: 'underline',
                            cursor: 'pointer',
                            '&:hover': {
                              color: 'primary.dark',
                            },
                          }}
                        >
                          {port.neighbour}
                        </Typography>
                      ) : (
                        port.neighbour
                      )}
                      {port.neighbourPort && ` (${port.neighbourPort})`}
                    </Typography>
                  );
                })()}
              </Box>
            }
            arrow
            placement="top"
          >
            <Box
              onMouseEnter={() => setHoveredPort(portName)}
              onMouseLeave={() => setHoveredPort(null)}
              onClick={(e) => {
                if (port.neighbour) {
                  // Only proceed if deviceMap is populated
                  if (!deviceMap || Object.keys(deviceMap).length === 0) {
                    console.warn('Device map not ready yet, cannot navigate to neighbor');
                    return;
                  }
                  
                  // Look up neighbor serial from deviceMap
                  const neighborSerial = getNeighborSerial(port.neighbour);
                  
                  if (neighborSerial) {
                    e.stopPropagation();
                    console.log(`Navigating to neighbor device: ${port.neighbour} -> ${neighborSerial}`);
                    navigate(`/devices/${neighborSerial}`);
                  } else {
                    console.warn('No serial found for neighbor:', port.neighbour, '- cannot navigate');
                  }
                }
              }}
              sx={{
                position: 'absolute',
                top: position.top,
                left: position.left,
                width: '2.5%',
                height: '2.5%',
                minWidth: '8px',
                minHeight: '8px',
                borderRadius: '50%',
                backgroundColor: isConnected ? 'rgba(76, 175, 80, 0.9)' : 'rgba(158, 158, 158, 0.4)',
                boxShadow: isConnected
                  ? '0 0 8px rgba(76, 175, 80, 1), 0 0 16px rgba(76, 175, 80, 0.7), 0 0 24px rgba(76, 175, 80, 0.5)'
                  : '0 0 2px rgba(0, 0, 0, 0.3)',
                cursor: port.neighbour && getNeighborSerial(port.neighbour) ? 'pointer' : 'default',
                transition: 'all 0.2s ease',
                transform: hoveredPort === portName ? 'scale(2)' : 'scale(1)',
                zIndex: hoveredPort === portName ? 10 : 5,
                border: hoveredPort === portName ? '2px solid rgba(76, 175, 80, 1)' : '1px solid rgba(255, 255, 255, 0.6)',
                transformOrigin: 'center',
              }}
            >
              {showDebug && (
                <Typography
                  variant="caption"
                  sx={{
                    position: 'absolute',
                    top: '-20px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    whiteSpace: 'nowrap',
                    fontSize: '10px',
                    color: 'white',
                    textShadow: '1px 1px 2px rgba(0,0,0,0.8)',
                    pointerEvents: 'none',
                  }}
                >
                  {portName}
                </Typography>
              )}
            </Box>
          </Tooltip>
        );
      })}
    </>
  );
}

// Device Header Image Component - handles image loading without flickering
function DeviceHeaderImage({ partNumber }) {
  const [currentSrc, setCurrentSrc] = useState(null);
  const [cdnIndex, setCdnIndex] = useState(0);
  const [formatIndex, setFormatIndex] = useState(0);
  const [imageError, setImageError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);
  
  // Local format fallbacks
  const formats = ['webp', 'jpg', 'png'];
  
  // Part number aliases - map one part number to another's image
  const partNumberAliases = {
    'R7J39A': 'S3J36A',  // R7J39A uses S3J36A's image
  };
  
  useEffect(() => {
    if (!partNumber) {
      setImageError(true);
      return;
    }

    // Special case: Q9H73A only uses this specific URL
    if (partNumber === 'Q9H73A') {
      setCurrentSrc('https://diz7hgluhzsxv.cloudfront.net/ui-base/v33191/assets/ui-components/static/media/Q9H73A.e0f32991.png');
      setCdnIndex(0);
      setFormatIndex(0);
      setImageError(false);
      setImageLoaded(false);
      return;
    }

    // Check if this part number should use an alias
    const imagePartNumber = partNumberAliases[partNumber] || partNumber;

    // CDN URL patterns to try (recreated when partNumber changes)
    // Try new 2025 pattern first, then old pattern, then try without hash
    const cdnPatterns = [
      `https://diz7hgluhzsxv.cloudfront.net/2025/udl/v3132/static/media/${imagePartNumber}.3e5127c7.png`,
      `https://diz7hgluhzsxv.cloudfront.net/2025/udl/v3132/static/media/${imagePartNumber}.10a25695.png`,
      `https://diz7hgluhzsxv.cloudfront.net/2025/udl/v3132/static/media/${imagePartNumber}.d8474883.png`,
      `https://diz7hgluhzsxv.cloudfront.net/2025/udl/v3132/static/media/${imagePartNumber}.a0310c52.png`,
      `https://diz7hgluhzsxv.cloudfront.net/2025/udl/v3132/static/media/${imagePartNumber}.png`,
      `https://diz7hgluhzsxv.cloudfront.net/ui-base/v33191/assets/ui-components/static/media/${imagePartNumber}.e0f32991.png`,
      `https://diz7hgluhzsxv.cloudfront.net/ui-base/v33191/assets/ui-components/static/media/${imagePartNumber}.a0310c52.png`,
      `https://diz7hgluhzsxv.cloudfront.net/ui-base/v33191/assets/ui-components/static/media/${imagePartNumber}-crop.e6178d42.png`,
    ];

    // Start with first CDN pattern
    setCurrentSrc(cdnPatterns[0]);
    setCdnIndex(0);
    setFormatIndex(0);
    setImageError(false);
    setImageLoaded(false);
  }, [partNumber]);
  
  const handleImageError = () => {
    if (!partNumber) {
      setImageError(true);
      return;
    }
    
    // Special case: Q9H73A only uses this specific URL, if it fails, hide image
    if (partNumber === 'Q9H73A') {
      setImageError(true);
      setCurrentSrc(null);
      return;
    }
    
    // Check if this part number should use an alias
    const imagePartNumber = partNumberAliases[partNumber] || partNumber;
    
    // CDN URL patterns to try
    const cdnPatterns = [
      `https://diz7hgluhzsxv.cloudfront.net/2025/udl/v3132/static/media/${imagePartNumber}.3e5127c7.png`,
      `https://diz7hgluhzsxv.cloudfront.net/2025/udl/v3132/static/media/${imagePartNumber}.10a25695.png`,
      `https://diz7hgluhzsxv.cloudfront.net/2025/udl/v3132/static/media/${imagePartNumber}.d8474883.png`,
      `https://diz7hgluhzsxv.cloudfront.net/2025/udl/v3132/static/media/${imagePartNumber}.a0310c52.png`,
      `https://diz7hgluhzsxv.cloudfront.net/2025/udl/v3132/static/media/${imagePartNumber}.png`,
      `https://diz7hgluhzsxv.cloudfront.net/ui-base/v33191/assets/ui-components/static/media/${imagePartNumber}.e0f32991.png`,
      `https://diz7hgluhzsxv.cloudfront.net/ui-base/v33191/assets/ui-components/static/media/${imagePartNumber}.a0310c52.png`,
      `https://diz7hgluhzsxv.cloudfront.net/ui-base/v33191/assets/ui-components/static/media/${imagePartNumber}-crop.e6178d42.png`,
    ];
    
    // Try next CDN pattern first
    if (cdnIndex < cdnPatterns.length - 1) {
      const nextIndex = cdnIndex + 1;
      setCurrentSrc(cdnPatterns[nextIndex]);
      setCdnIndex(nextIndex);
      setImageLoaded(false); // Reset loaded state when trying new URL
      return;
    }

    // If all CDN patterns failed, try local formats
    if (formatIndex < formats.length) {
      const nextFormat = formats[formatIndex];
      // Try both the original partNumber and the alias for local images
      const localPartNumber = formatIndex === 0 ? partNumber : imagePartNumber;
      const localSrc = `/images/devices/${localPartNumber}.${nextFormat}`;
      setCurrentSrc(localSrc);
      setFormatIndex(prev => prev + 1);
      setImageLoaded(false); // Reset loaded state when trying new URL
    } else {
      // All formats failed - hide image
      setImageError(true);
      setCurrentSrc(null);
      setImageLoaded(false);
    }
  };
  
  const handleImageLoad = () => {
    setImageLoaded(true);
  };

  if (imageError || !currentSrc) {
    return null;
  }

  return (
    <Box
      component="img"
      src={currentSrc}
      alt={`${partNumber}`}
      onError={handleImageError}
      onLoad={handleImageLoad}
      sx={{
        maxWidth: '100%',
        maxHeight: '100%',
        width: 'auto',
        height: 'auto',
        objectFit: 'contain',
        filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.1))',
        imageRendering: 'crisp-edges',
        display: imageLoaded ? 'block' : 'none',
        opacity: imageLoaded ? 1 : 0,
        transition: 'opacity 0.15s ease-in',
      }}
    />
  );
}

// Device Image Component - displays HPE logo
function DeviceImageDisplay({ partNumber, deviceSerial, deviceType, siteId, onRefresh }) {
  const [imageError, setImageError] = useState(false);
  const [ports, setPorts] = useState(null);
  const [loadingPorts, setLoadingPorts] = useState(false);
  const [deviceMap, setDeviceMap] = useState({}); // Map device name to serial
  const imageRef = useRef(null);

  // Fetch all devices to create name-to-serial mapping
  useEffect(() => {
    deviceAPI.getAll()
      .then((data) => {
        // Handle both array and object with items property
        const devices = Array.isArray(data) ? data : (data?.items || []);
        
        if (devices && devices.length > 0) {
          const map = {};
          devices.forEach((device) => {
            if (device.serialNumber) {
              // Map by name (case-insensitive)
              if (device.name) {
                const nameLower = device.name.toLowerCase();
                map[nameLower] = device.serialNumber;
                // Also try without hyphens/dashes
                const nameNoDash = nameLower.replace(/[-_]/g, '');
                if (nameNoDash !== nameLower) {
                  map[nameNoDash] = device.serialNumber;
                }
              }
              // Also map by hostname if different
              if (device.hostname) {
                const hostnameLower = device.hostname.toLowerCase();
                map[hostnameLower] = device.serialNumber;
                const hostnameNoDash = hostnameLower.replace(/[-_]/g, '');
                if (hostnameNoDash !== hostnameLower) {
                  map[hostnameNoDash] = device.serialNumber;
                }
              }
              // Map by deviceName if different
              if (device.deviceName && device.deviceName !== device.name && device.deviceName !== device.hostname) {
                const deviceNameLower = device.deviceName.toLowerCase();
                map[deviceNameLower] = device.serialNumber;
                const deviceNameNoDash = deviceNameLower.replace(/[-_]/g, '');
                if (deviceNameNoDash !== deviceNameLower) {
                  map[deviceNameNoDash] = device.serialNumber;
                }
              }
              // Map by serial number itself (in case neighbor is already a serial)
              map[device.serialNumber.toLowerCase()] = device.serialNumber;
            }
          });
          console.log('Device map created (DeviceImageDisplay):', {
            size: Object.keys(map).length,
            sampleKeys: Object.keys(map).slice(0, 20)
          });
          setDeviceMap(map);
        }
      })
      .catch((err) => {
        console.error('Error fetching devices for neighbor mapping:', err);
      });
  }, []);

  const HPE_LOGO_URL = 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/46/Hewlett_Packard_Enterprise_logo.svg/530px-Hewlett_Packard_Enterprise_logo.svg.png';
  const [imageLoaded, setImageLoaded] = useState(false);

  // Always use HPE logo - no format checking needed
  const imagePath = HPE_LOGO_URL;

  const handleImageErrorCallback = useCallback(() => {
    // If HPE logo fails to load, just mark as error
    setImageError(true);
    setImageLoaded(false);
  }, []);

  const handleImageLoad = useCallback(() => {
    setImageLoaded(true);
  }, []);

  // Reset when partNumber changes
  useEffect(() => {
    setImageError(false);
    setImageLoaded(false);
  }, [partNumber]);

  // Fetch port data for switches
  useEffect(() => {
    if (deviceSerial && (deviceType === 'SWITCH' || deviceType === 'switch') && siteId) {
      setLoadingPorts(true);
      deviceAPI.getSwitchInterfaces(deviceSerial, siteId)
        .then((data) => {
          if (data && data.items) {
            setPorts(data.items);
          } else if (data && Array.isArray(data)) {
            setPorts(data);
          } else {
            setPorts(null);
          }
        })
        .catch((err) => {
          // Silently handle - ports are optional
          setPorts(null);
        })
        .finally(() => {
          setLoadingPorts(false);
        });
    }
  }, [deviceSerial, deviceType, siteId]);

  if (imageError) {
    return (
      <Card sx={{ mt: 3, bgcolor: 'transparent', boxShadow: 'none' }}>
        <CardContent sx={{ bgcolor: 'transparent', p: 2 }}>
          <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
            Device Image
          </Typography>
          <Divider sx={{ mb: 2 }} />
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            No image found for this device.
          </Typography>
          <DeviceImageUpload partNumber={partNumber} onUploadSuccess={onRefresh} />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card sx={{ mt: 3, bgcolor: 'transparent', boxShadow: 'none' }}>
      <CardContent sx={{ bgcolor: 'transparent', p: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            Device Image
          </Typography>
          <DeviceImageUpload partNumber={partNumber} onUploadSuccess={onRefresh} />
        </Box>
        <Divider sx={{ mb: 2 }} />
        <Box
          sx={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            width: '100%',
            maxWidth: '800px',
            margin: '0 auto',
            bgcolor: 'transparent',
            position: 'relative',
          }}
        >
          <Box
            ref={imageRef}
            sx={{
              position: 'relative',
              display: 'inline-block',
            }}
          >
            <Box
              component="img"
              src={imagePath}
              alt={`Device ${partNumber}`}
              onError={handleImageErrorCallback}
              onLoad={handleImageLoad}
              loading="lazy"
              sx={{
                maxWidth: '100%',
                height: 'auto',
                borderRadius: 1,
                boxShadow: 2,
                bgcolor: 'transparent',
                mixBlendMode: 'normal',
                display: imageLoaded ? 'block' : 'none',
                opacity: imageLoaded ? 1 : 0,
                transition: 'opacity 0.2s ease-in',
              }}
            />
            {ports && (
              <PortOverlay ports={ports} imageRef={imageRef} deviceMap={deviceMap} />
            )}
          </Box>
        </Box>
      </CardContent>
    </Card>
  );
}

function DeviceDetailPage() {
  const { serial: serialOrName } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [device, setDevice] = useState(null);
  const [switchDetails, setSwitchDetails] = useState(null);
  const [powerData, setPowerData] = useState(null);
  const [actionDialog, setActionDialog] = useState({ open: false, action: '', title: '' });
  const [actionLoading, setActionLoading] = useState(false);
  const [tabValue, setTabValue] = useState(0);
  const [deviceNameToSerialMap, setDeviceNameToSerialMap] = useState({});
  const [resolvedSerial, setResolvedSerial] = useState(null);

  // Build device name to serial mapping
  useEffect(() => {
    if (!serialOrName) {
      return;
    }
    
    // First, set resolvedSerial to serialOrName as a fallback (in case it's already a serial)
    setResolvedSerial(serialOrName);
    
    deviceAPI.getAll()
      .then((data) => {
        // Handle both array and object with items property
        const devices = Array.isArray(data) ? data : (data?.items || []);
        
        if (devices && devices.length > 0) {
          const map = {};
          devices.forEach((device) => {
            if (device.serialNumber) {
              // Map by name (case-insensitive)
              if (device.name) {
                map[device.name.toLowerCase()] = device.serialNumber;
                map[device.name.replace(/[-_]/g, '').toLowerCase()] = device.serialNumber;
              }
              // Map by hostname
              if (device.hostname) {
                map[device.hostname.toLowerCase()] = device.serialNumber;
                map[device.hostname.replace(/[-_]/g, '').toLowerCase()] = device.serialNumber;
              }
              // Map by deviceName
              if (device.deviceName) {
                map[device.deviceName.toLowerCase()] = device.serialNumber;
                map[device.deviceName.replace(/[-_]/g, '').toLowerCase()] = device.serialNumber;
              }
              // Map by serial number itself
              map[device.serialNumber.toLowerCase()] = device.serialNumber;
            }
          });
          setDeviceNameToSerialMap(map);
          
          // Resolve the serial parameter (might be a name or serial)
          const lowerParam = serialOrName?.toLowerCase();
          const resolved = map[lowerParam] || map[lowerParam?.replace(/[-_]/g, '')] || serialOrName;
          console.log('Resolving device identifier:', {
            input: serialOrName,
            lowerParam,
            resolved,
            foundInMap: !!map[lowerParam] || !!map[lowerParam?.replace(/[-_]/g, '')]
          });
          setResolvedSerial(resolved);
        } else {
          console.warn('deviceAPI.getAll() did not return devices:', data);
          // Keep the fallback serialOrName
        }
      })
      .catch((err) => {
        console.error('Error fetching devices for name resolution:', err);
        // Keep the fallback serialOrName (already set above)
      });
  }, [serialOrName]);

  useEffect(() => {
    if (resolvedSerial) {
      fetchDeviceDetails();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resolvedSerial]);

  const fetchDeviceDetails = async () => {
    if (!resolvedSerial) {
      console.warn('fetchDeviceDetails called but resolvedSerial is not set');
      setLoading(false);
      setError('Device identifier is required');
      return;
    }
    
    try {
      setLoading(true);
      setError('');
      console.log('Fetching device details for serial:', resolvedSerial);
      const data = await deviceAPI.getDetails(resolvedSerial);
      console.log('Device details fetched successfully:', data);
      if (!data) {
        throw new Error('Device not found');
      }
      setDevice(data);

      // Fetch switch-specific details if device is a switch
      if (data?.deviceType === 'SWITCH' || data?.type === 'switch') {
        const switchData = await deviceAPI.getSwitchDetails(resolvedSerial, data?.siteId);
        if (switchData) {
          setSwitchDetails(switchData);
        }
        // Silently handle null returns - switch details are optional
      }

      // Fetch power consumption for APs and Switches
      if (data?.deviceType === 'AP' || data?.type === 'ap' || data?.type === 'ACCESS_POINT') {
        try {
          await fetchPowerConsumption(resolvedSerial, 'AP');
        } catch (powerErr) {
          // Silently handle - power data is optional
          // Only log if it's not a 404 (expected for some devices)
          if (powerErr.response?.status !== 404) {
            console.warn('Could not fetch power consumption:', powerErr);
          }
        }
      } else if (data?.deviceType === 'SWITCH' || data?.type === 'switch') {
        try {
          await fetchPowerConsumption(resolvedSerial, 'SWITCH');
        } catch (powerErr) {
          // Silently handle - power data is optional
          // Only log if it's not a 404 (expected for some devices)
          if (powerErr.response?.status !== 404) {
            console.warn('Could not fetch power consumption:', powerErr);
          }
        }
      }

    } catch (err) {
      console.error('Error fetching device details:', err);
      const errorMessage = err.response?.data?.error || err.response?.data?.message || err.message || 'Failed to load device details';
      setError(errorMessage);
      setDevice(null);
    } finally {
      setLoading(false);
    }
  };

  const fetchPowerConsumption = async (serialNumber, deviceType) => {
    try {
      let response;
      
      if (deviceType === 'AP') {
        // Request last 5 minutes of power consumption data for AP
        response = await deviceAPI.getAPPowerConsumption(serialNumber);
      } else if (deviceType === 'SWITCH') {
        // Request power consumption data for Switch
        response = await monitoringAPIv2.getSwitchPower(serialNumber);
        // Handle null return (404) gracefully
        if (!response) {
          setPowerData(null);
          return;
        }
      } else {
        return;
      }

      // Process response - handle both AP format (items array) and Switch format (graph.samples)
      if (response?.items && response.items.length > 0) {
        // AP format
        const values = response.items
          .map(item => item.value || item.power)
          .filter(val => val != null && !isNaN(val));

        if (values.length > 0) {
          const average = values.reduce((sum, val) => sum + val, 0) / values.length;
          setPowerData(average);
        }
      } else if (response?.graph?.samples && response.graph.samples.length > 0) {
        // Switch format (graph with samples)
        const values = response.graph.samples
          .map(sample => {
            if (sample.data && sample.data.length > 0) {
              return sample.power_consumption || sample.power_consumption_watts || sample.data[0];
            }
            return null;
          })
          .filter(val => val != null && !isNaN(val));

        if (values.length > 0) {
          const average = values.reduce((sum, val) => sum + val, 0) / values.length;
          setPowerData(average);
        }
      }
    } catch (err) {
      // Silently handle - power data is optional
      // Only log unexpected errors (not 404s)
      if (err.response?.status !== 404) {
        console.warn('Error fetching power consumption:', err);
      }
      setPowerData(null);
    }
  };

  const handleActionClick = (action, title) => {
    setActionDialog({ open: true, action, title });
  };

  const handleActionConfirm = async () => {
    setActionLoading(true);
    try {
      // Implement actual API calls based on action
      switch (actionDialog.action) {
        case 'reboot':
          // await deviceAPI.reboot(resolvedSerial);
          console.log('Reboot device:', resolvedSerial);
          break;
        case 'sync':
          // await deviceAPI.syncConfig(resolvedSerial);
          console.log('Sync configuration:', resolvedSerial);
          break;
        case 'firmware':
          // await deviceAPI.updateFirmware(resolvedSerial);
          console.log('Update firmware:', resolvedSerial);
          break;
        case 'diagnostics':
          // await deviceAPI.runDiagnostics(resolvedSerial);
          console.log('Run diagnostics:', resolvedSerial);
          break;
        default:
          break;
      }
      setActionDialog({ open: false, action: '', title: '' });
      // Optionally refresh device details
      // await fetchDeviceDetails();
    } catch (err) {
      setError(err.message || 'Action failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleActionCancel = () => {
    setActionDialog({ open: false, action: '', title: '' });
  };

  const getStatusColor = (status) => {
    if (!status) return 'default';
    const statusLower = status.toLowerCase();
    if (statusLower === 'up' || statusLower === 'online') return 'success';
    if (statusLower === 'down' || statusLower === 'offline') return 'error';
    return 'warning';
  };

  const getHealthColor = (health) => {
    if (!health) return 'default';
    const healthLower = health.toLowerCase();
    if (healthLower === 'good' || healthLower === 'excellent') return 'success';
    if (healthLower === 'poor') return 'error';
    if (healthLower === 'fair') return 'warning';
    return 'default';
  };

  const formatUptime = (uptimeMs) => {
    if (!uptimeMs) return 'N/A';
    const seconds = Math.floor(uptimeMs / 1000);
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  };

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'N/A';
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error && !device) {
    return (
      <Box>
        <Button
          startIcon={<ArrowBackIcon />}
          onClick={() => navigate('/devices')}
          sx={{ mb: 2 }}
        >
          Back to Devices
        </Button>
        <Alert severity="error">{error}</Alert>
      </Box>
    );
  }

  return (
    <Box>
          {/* Header */}
          <Box sx={{ mb: 4 }}>
            <Button
              startIcon={<ArrowBackIcon />}
              onClick={() => navigate('/devices')}
              sx={{ mb: 2 }}
            >
              Back to Devices
            </Button>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              {/* Device Image Icon */}
              {device?.partNumber && (
                <Box
                  sx={{
                    width: 48,
                    height: 48,
                    minWidth: 48,
                    minHeight: 48,
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <DeviceHeaderImage partNumber={device.partNumber} />
                </Box>
              )}
              {!device?.partNumber && (
                <DevicesIcon sx={{ fontSize: 40, color: 'primary.main' }} />
              )}
              <Box>
                <Typography variant="h4" sx={{ fontWeight: 700 }}>
                  {device?.deviceName || 'Unknown Device'}
                </Typography>
                <Typography variant="body1" color="text.secondary">
                  {device?.deviceType || 'N/A'} - {device?.model || 'N/A'}
                </Typography>
              </Box>
              <Box sx={{ ml: 'auto' }}>
                <Chip
                  label={device?.status || 'Unknown'}
                  size="medium"
                  color={getStatusColor(device?.status)}
                />
              </Box>
            </Box>
          </Box>

      {/* Error Alert */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* Device Information */}
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent>
              <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
                Device Information
              </Typography>
              <Divider sx={{ mb: 2 }} />

              <Grid container spacing={2}>
                {/* Basic Info - Collapsible */}
                <Grid item xs={12}>
                  <Accordion defaultExpanded>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                      <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                        Basic Information
                      </Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                      <Grid container spacing={2}>
                        <Grid item xs={6}>
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                            Serial Number
                          </Typography>
                          <Typography variant="body1" fontFamily="monospace" sx={{ fontWeight: 600 }}>
                            {device?.serialNumber || 'N/A'}
                          </Typography>
                        </Grid>
                        <Grid item xs={6}>
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                            MAC Address
                          </Typography>
                          <Typography variant="body1" fontFamily="monospace">
                            {device?.macAddress || 'N/A'}
                          </Typography>
                        </Grid>
                        <Grid item xs={6}>
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                            IPv4 Address
                          </Typography>
                          <Typography variant="body1" fontFamily="monospace">
                            {device?.ipv4 || 'N/A'}
                          </Typography>
                        </Grid>
                        <Grid item xs={6}>
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                            IPv6 Address
                          </Typography>
                          <Typography variant="body1" fontFamily="monospace">
                            {device?.ipv6 || 'N/A'}
                          </Typography>
                        </Grid>
                        <Grid item xs={6}>
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                            Software Version
                          </Typography>
                          <Typography variant="body1" fontFamily="monospace">
                            {device?.softwareVersion || 'N/A'}
                          </Typography>
                        </Grid>
                        <Grid item xs={6}>
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                            Model
                          </Typography>
                          <Typography variant="body1">
                            {device?.model || 'N/A'}
                          </Typography>
                        </Grid>
                        <Grid item xs={6}>
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                            Part Number
                          </Typography>
                          <Typography variant="body1" fontFamily="monospace">
                            {device?.partNumber || 'N/A'}
                          </Typography>
                        </Grid>
                        <Grid item xs={6}>
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                            Uptime
                          </Typography>
                          <Typography variant="body1">
                            {formatUptime(device?.uptimeInMillis)}
                          </Typography>
                        </Grid>
                      </Grid>
                    </AccordionDetails>
                  </Accordion>
                </Grid>

                {/* Deployment & Configuration - Collapsible */}
                <Grid item xs={12}>
                  <Accordion defaultExpanded>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                      <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                        Configuration Details
                      </Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                      <Grid container spacing={2}>
                        <Grid item xs={6}>
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                            Deployment
                          </Typography>
                          <Typography variant="body1">
                            {device?.deployment || 'N/A'}
                          </Typography>
                        </Grid>
                        <Grid item xs={6}>
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                            Last Config Modified
                          </Typography>
                          <Typography variant="body1">
                            {formatTimestamp(device?.configLastModifiedAt)}
                          </Typography>
                        </Grid>
                        <Grid item xs={6}>
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                            Config Status
                          </Typography>
                          <Box sx={{ mt: 0.5 }}>
                            <Chip
                              label={device?.configStatus || 'Unknown'}
                              size="small"
                              color={device?.configStatus === 'Synchronized' ? 'success' : 'warning'}
                            />
                          </Box>
                        </Grid>
                        <Grid item xs={6}>
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                            Device Function
                          </Typography>
                          <Typography variant="body1">
                            {device?.deviceFunction || 'None'}
                          </Typography>
                        </Grid>
                        <Grid item xs={6}>
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                            Persona
                          </Typography>
                          <Typography variant="body1">
                            {device?.persona || 'N/A'}
                          </Typography>
                        </Grid>
                        <Grid item xs={6}>
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                            Role
                          </Typography>
                          <Typography variant="body1">
                            {device?.role || 'N/A'}
                          </Typography>
                        </Grid>
                      </Grid>
                    </AccordionDetails>
                  </Accordion>
                </Grid>

                {/* Location Info - Collapsible */}
                <Grid item xs={12}>
                  <Accordion defaultExpanded>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                      <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                        Location Details
                      </Typography>
                    </AccordionSummary>
                    <AccordionDetails>
                      <Grid container spacing={2}>
                        <Grid item xs={6}>
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                            Site Name
                          </Typography>
                          <Typography variant="body1">
                            {device?.siteName || 'N/A'}
                          </Typography>
                        </Grid>
                        <Grid item xs={6}>
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                            Site ID
                          </Typography>
                          <Typography variant="body1" fontFamily="monospace">
                            {device?.siteId || 'N/A'}
                          </Typography>
                        </Grid>
                        <Grid item xs={6}>
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                            Building ID
                          </Typography>
                          <Typography variant="body1">
                            {device?.buildingId || 'N/A'}
                          </Typography>
                        </Grid>
                        <Grid item xs={6}>
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                            Floor ID
                          </Typography>
                          <Typography variant="body1">
                            {device?.floorId || 'N/A'}
                          </Typography>
                        </Grid>
                      </Grid>
                    </AccordionDetails>
                  </Accordion>
                </Grid>

                {/* Wired Interfaces - Switch Port Visualization - Collapsible */}
                {device?.deviceType === 'SWITCH' && (
                  <Grid item xs={12}>
                    <Accordion defaultExpanded>
                      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                        <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                          Wired Interfaces
                        </Typography>
                      </AccordionSummary>
                      <AccordionDetails>
                        <WiredInterfacesView 
                          deviceSerial={device.serialNumber}
                          siteId={device.siteId}
                          partNumber={device.partNumber}
                        />
                      </AccordionDetails>
                    </Accordion>
                  </Grid>
                )}

                {/* Cluster Info (if available) */}
                {device?.clusterName && (
                  <>
                    <Grid item xs={12}>
                      <Divider sx={{ my: 2 }} />
                      <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1.5 }}>
                        Cluster Information
                      </Typography>
                    </Grid>
                    <Grid item xs={6}>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                        Cluster Name
                      </Typography>
                      <Typography variant="body1">
                        {device?.clusterName}
                      </Typography>
                    </Grid>
                  </>
                )}

                {/* Notes */}
                {device?.notes && (
                  <>
                    <Grid item xs={12}>
                      <Divider sx={{ my: 2 }} />
                      <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1.5 }}>
                        Notes
                      </Typography>
                    </Grid>
                    <Grid item xs={12}>
                      <Typography variant="body2" sx={{ p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
                        {device?.notes}
                      </Typography>
                    </Grid>
                  </>
                )}
              </Grid>
            </CardContent>
          </Card>

          {/* Device Image with Port Overlay - Hidden but kept for port overlay functionality */}
          {device?.partNumber && device?.deviceType === 'SWITCH' && (
            <Box sx={{ display: 'none' }}>
              <DeviceImageDisplay 
                partNumber={device.partNumber}
                deviceSerial={device.serialNumber}
                deviceType={device.deviceType}
                siteId={device.siteId}
                onRefresh={() => {
                  // Force image reload by updating timestamp
                  setDevice({ ...device });
                }}
              />
            </Box>
          )}
        </Grid>

        {/* Device Actions - Collapsible */}
        <Grid item xs={12} md={4}>
          <Accordion defaultExpanded>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                Device Actions
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <List sx={{ pt: 0 }}>
                <ListItem
                  button
                  onClick={() => handleActionClick('reboot', 'Reboot Device')}
                  sx={{ borderRadius: 1, mb: 1 }}
                >
                  <ListItemIcon>
                    <RestartAltIcon color="primary" />
                  </ListItemIcon>
                  <ListItemText
                    primary="Reboot Device"
                    secondary="Restart the device"
                  />
                </ListItem>

                <ListItem
                  button
                  onClick={() => handleActionClick('sync', 'Sync Configuration')}
                  sx={{ borderRadius: 1, mb: 1 }}
                >
                  <ListItemIcon>
                    <CloudSyncIcon color="primary" />
                  </ListItemIcon>
                  <ListItemText
                    primary="Sync Configuration"
                    secondary="Push latest config"
                  />
                </ListItem>

                <ListItem
                  button
                  onClick={() => handleActionClick('firmware', 'Update Firmware')}
                  sx={{ borderRadius: 1, mb: 1 }}
                >
                  <ListItemIcon>
                    <UpdateIcon color="primary" />
                  </ListItemIcon>
                  <ListItemText
                    primary="Update Firmware"
                    secondary="Upgrade device firmware"
                  />
                </ListItem>

                <ListItem
                  button
                  onClick={() => handleActionClick('diagnostics', 'Run Diagnostics')}
                  sx={{ borderRadius: 1, mb: 1 }}
                >
                  <ListItemIcon>
                    <BugReportIcon color="primary" />
                  </ListItemIcon>
                  <ListItemText
                    primary="Run Diagnostics"
                    secondary="Check device health"
                  />
                </ListItem>

                <ListItem
                  button
                  onClick={() => navigate(`/devices/${serial}/settings`)}
                  sx={{ borderRadius: 1 }}
                >
                  <ListItemIcon>
                    <SettingsIcon color="primary" />
                  </ListItemIcon>
                  <ListItemText
                    primary="Device Settings"
                    secondary="Configure device"
                  />
                </ListItem>
              </List>
            </AccordionDetails>
          </Accordion>
        </Grid>


        {/* Switch-Specific Details (Accordion) */}
        {switchDetails && (
          <Grid item xs={12}>
            <Accordion>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  Switch Details
                </Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Grid container spacing={2}>
                  <Grid item xs={12} md={6}>
                    <Typography variant="caption" color="text.secondary">
                      Deployment
                    </Typography>
                    <Typography variant="body1">
                      {switchDetails.deployment || 'N/A'}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Typography variant="caption" color="text.secondary">
                      Switch Role
                    </Typography>
                    <Typography variant="body1">
                      {switchDetails.switchRole || 'N/A'}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Typography variant="caption" color="text.secondary">
                      Switch Type
                    </Typography>
                    <Typography variant="body1">
                      {switchDetails.switchType || 'N/A'}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Typography variant="caption" color="text.secondary">
                      J-Number
                    </Typography>
                    <Typography variant="body1" fontFamily="monospace">
                      {switchDetails.jNumber || 'N/A'}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Typography variant="caption" color="text.secondary">
                      Location
                    </Typography>
                    <Typography variant="body1">
                      {switchDetails.location || 'N/A'}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Typography variant="caption" color="text.secondary">
                      Contact
                    </Typography>
                    <Typography variant="body1">
                      {switchDetails.contact || 'N/A'}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Typography variant="caption" color="text.secondary">
                      Manufacturer
                    </Typography>
                    <Typography variant="body1">
                      {switchDetails.manufacturer || 'N/A'}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Typography variant="caption" color="text.secondary">
                      Config Status
                    </Typography>
                    <Chip
                      label={switchDetails.configStatus || 'Unknown'}
                      size="small"
                      color={switchDetails.configStatus === 'Synchronized' ? 'success' : 'warning'}
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Typography variant="caption" color="text.secondary">
                      Last Restart Reason
                    </Typography>
                    <Typography variant="body1">
                      {switchDetails.lastRestartReason || 'N/A'}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Typography variant="caption" color="text.secondary">
                      Reboot Timestamp
                    </Typography>
                    <Typography variant="body1">
                      {formatTimestamp(switchDetails.rebootTs)}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Typography variant="caption" color="text.secondary">
                      Firmware Backup Version
                    </Typography>
                    <Typography variant="body1">
                      {switchDetails.firmwareBackupVersion || 'N/A'}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Typography variant="caption" color="text.secondary">
                      Firmware Recommended Version
                    </Typography>
                    <Typography variant="body1">
                      {switchDetails.firmwareRecommendedVersion || 'N/A'}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Typography variant="caption" color="text.secondary">
                      STP Enabled
                    </Typography>
                    <Typography variant="body1">
                      {switchDetails.stpEnable ? 'Yes' : 'No'}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Typography variant="caption" color="text.secondary">
                      STP Mode
                    </Typography>
                    <Typography variant="body1">
                      {switchDetails.stpMode?.toUpperCase() || 'N/A'}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Typography variant="caption" color="text.secondary">
                      Public IP
                    </Typography>
                    <Typography variant="body1" fontFamily="monospace">
                      {switchDetails.publicIp || 'N/A'}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Typography variant="caption" color="text.secondary">
                      Last Config Change
                    </Typography>
                    <Typography variant="body1">
                      {formatTimestamp(switchDetails.lastConfigChange)}
                    </Typography>
                  </Grid>
                </Grid>

                {/* Health Reasons */}
                {switchDetails.healthReasons && (
                  <Box sx={{ mt: 3 }}>
                    <Divider sx={{ mb: 2 }} />
                    <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 600 }}>
                      Health Status
                    </Typography>
                    <Grid container spacing={2}>
                      {switchDetails.healthReasons.poorReasons?.length > 0 && (
                        <Grid item xs={12}>
                          <Typography variant="caption" color="error">
                            Poor Health Reasons
                          </Typography>
                          {switchDetails.healthReasons.poorReasons.map((reason, idx) => (
                            <Chip
                              key={idx}
                              label={reason}
                              size="small"
                              color="error"
                              sx={{ mr: 1, mb: 1 }}
                            />
                          ))}
                        </Grid>
                      )}
                      {switchDetails.healthReasons.fairReasons?.length > 0 && (
                        <Grid item xs={12}>
                          <Typography variant="caption" color="warning.main">
                            Fair Health Reasons
                          </Typography>
                          {switchDetails.healthReasons.fairReasons.map((reason, idx) => (
                            <Chip
                              key={idx}
                              label={reason}
                              size="small"
                              color="warning"
                              sx={{ mr: 1, mb: 1 }}
                            />
                          ))}
                        </Grid>
                      )}
                      {switchDetails.healthReasons.primaryReason && (
                        <Grid item xs={12}>
                          <Typography variant="caption" color="text.secondary">
                            Primary Reason
                          </Typography>
                          <Typography variant="body2">
                            {switchDetails.healthReasons.primaryReason.reasonEnum}
                            (Type: {switchDetails.healthReasons.primaryReason.typeId})
                          </Typography>
                        </Grid>
                      )}
                    </Grid>
                  </Box>
                )}
              </AccordionDetails>
            </Accordion>
          </Grid>
        )}

        {/* Additional Device Details - Collapsible */}
        <Grid item xs={12}>
          <Accordion defaultExpanded>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                Additional Details
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Grid container spacing={2}>
                <Grid item xs={12} md={4}>
                  <Box sx={{ p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
                    <Typography variant="caption" color="text.secondary">
                      CPU Usage
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 600, color: 'primary.main' }}>
                      {device?.cpuUtilization || 'N/A'}
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Box sx={{ p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
                    <Typography variant="caption" color="text.secondary">
                      Memory Usage
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 600, color: 'primary.main' }}>
                      {device?.memUtilization || 'N/A'}
                    </Typography>
                  </Box>
                </Grid>
                <Grid item xs={12} md={4}>
                  <Box sx={{ p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
                    <Typography variant="caption" color="text.secondary">
                      Power (5-min avg)
                    </Typography>
                    <Typography variant="h5" sx={{ fontWeight: 600, color: 'primary.main' }}>
                      {powerData !== null ? `${powerData.toFixed(2)} W` : 'N/A'}
                    </Typography>
                  </Box>
                </Grid>
              </Grid>
            </AccordionDetails>
          </Accordion>
        </Grid>
      </Grid>

      {/* Action Confirmation Dialog */}
      <Dialog
        open={actionDialog.open}
        onClose={handleActionCancel}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>{actionDialog.title}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to {actionDialog.action} device <strong>{device?.deviceName}</strong> ({resolvedSerial || device?.serialNumber})?
            <br /><br />
            This action may temporarily interrupt service.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleActionCancel} disabled={actionLoading}>
            Cancel
          </Button>
          <Button
            onClick={handleActionConfirm}
            variant="contained"
            color="primary"
            disabled={actionLoading}
          >
            {actionLoading ? <CircularProgress size={24} /> : 'Confirm'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default DeviceDetailPage;
