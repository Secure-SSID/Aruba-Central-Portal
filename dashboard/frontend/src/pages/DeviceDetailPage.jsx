/**
 * Device Detail Page
 * Displays detailed information about a specific device and provides management options
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
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
import UpdateIcon from '@mui/icons-material/Update';
import InfoIcon from '@mui/icons-material/Info';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import OpenInFullIcon from '@mui/icons-material/OpenInFull';
import LanIcon from '@mui/icons-material/Lan';
import { deviceAPI, monitoringAPIv2, configAPI, troubleshootAPI } from '../services/api';
import apiClient from '../services/api';
import { CDN_PATTERNS, HPE_LOGO_URL, getCdnUrlsForPartNumber } from '../config/cdnUrls';
import Tooltip from '@mui/material/Tooltip';
import HealthAndSafetyIcon from '@mui/icons-material/HealthAndSafety';
import BuildIcon from '@mui/icons-material/Build';
import PingIcon from '@mui/icons-material/NetworkCheck';
import RouteIcon from '@mui/icons-material/Route';
import PowerIcon from '@mui/icons-material/Power';
import CableIcon from '@mui/icons-material/Cable';
import HttpIcon from '@mui/icons-material/Http';
import SecurityIcon from '@mui/icons-material/Security';
import TerminalIcon from '@mui/icons-material/Terminal';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import InputLabel from '@mui/material/InputLabel';
import FormControl from '@mui/material/FormControl';
import Paper from '@mui/material/Paper';
import CodeIcon from '@mui/icons-material/Code';

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
        display: 'flex',
        justifyContent: 'center',
        overflowX: 'auto',
        overflowY: 'hidden',
      }}
    >
      {/* Horizontal Panel Container */}
      <Box
        className="horizontal-panel"
        sx={{
          bgcolor: '#ffffff',
          borderRadius: '12px',
          padding: 'clamp(8px, 1vw + 4px, 16px)',
          border: '2px solid orange',
          width: 'fit-content',
          minWidth: 0,
          maxWidth: 'calc(100% - 32px)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '1px',
          overflow: 'visible',
          boxSizing: 'border-box',
        }}
      >
            {(() => {
              // Layout:
              // Left side: Ports 15, 16 (centered vertically with numbers above and below)
              // Right side: Two rows
              //   - Top row: 1, 3, 5, 7, 9, 11, 13 (odd ports - numbers only on top)
              //   - Bottom row: 2, 4, 6, 8, 10, 12, 14 (even ports - numbers only on bottom)
              const fiberPorts = portLayout.fiberPorts; // 15, 16
              const topRowPorts = portLayout.mainPorts.filter((_, i) => i % 2 === 0); // Odd ports: 1, 3, 5, 7, 9, 11, 13
              const bottomRowPorts = portLayout.mainPorts.filter((_, i) => i % 2 === 1); // Even ports: 2, 4, 6, 8, 10, 12, 14

              // Consistent sizing for all switches
              const portSize = 'clamp(12px, 1.2vw + 6px, 28px)';
              const fontSize = 'clamp(5px, 0.5vw + 2px, 12px)';
              const iconSize = 'clamp(6px, 0.6vw + 3px, 14px)';
              const borderWidth = 'clamp(0.5px, 0.1vw + 0.4px, 1.5px)';

              // Common port rendering logic
              const renderPortBox = (portNum, port, connected) => (
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
                      minWidth: '10px',
                      minHeight: '10px',
                      border: connected
                        ? `${borderWidth} dashed #17eba0`
                        : `${borderWidth} solid rgba(0, 0, 0, 0.3)`,
                      borderRadius: 'clamp(1px, 2px + 0.8vw, 5px)',
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
              );

              // Render port with numbers above and below (for ports 15-16)
              const renderPortWithBothNumbers = (portNum) => {
                const port = getPortInfo(portNum);
                const connected = isPortConnected(portNum);
                
                return (
                  <Box
                    key={portNum}
                    sx={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      flexShrink: 0,
                      minWidth: 0,
                      gap: 'clamp(2px, 0.2vw + 1px, 4px)',
                    }}
                  >
                    {/* Number above */}
                    <Typography
                      variant="caption"
                      sx={{
                        fontSize: fontSize,
                        fontWeight: 700,
                        color: '#000000',
                        lineHeight: 1,
                        height: fontSize,
                        display: 'flex',
                        alignItems: 'center',
                      }}
                    >
                      {portNum}
                    </Typography>
                    {renderPortBox(portNum, port, connected)}
                  </Box>
                );
              };

              // Render port with number only on top (for top row - odd ports)
              const renderPortWithTopNumber = (portNum) => {
                const port = getPortInfo(portNum);
                const connected = isPortConnected(portNum);
                
                return (
                  <Box
                    key={portNum}
                    sx={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      flexShrink: 0,
                      minWidth: 0,
                      gap: 'clamp(2px, 0.2vw + 1px, 4px)',
                    }}
                  >
                    {/* Number above */}
                    <Typography
                      variant="caption"
                      sx={{
                        fontSize: fontSize,
                        fontWeight: 700,
                        color: '#000000',
                        lineHeight: 1,
                        height: fontSize,
                        display: 'flex',
                        alignItems: 'center',
                      }}
                    >
                      {portNum}
                    </Typography>
                    {renderPortBox(portNum, port, connected)}
                  </Box>
                );
              };

              // Render port with number only on bottom (for bottom row - even ports)
              const renderPortWithBottomNumber = (portNum) => {
                const port = getPortInfo(portNum);
                const connected = isPortConnected(portNum);
                
                return (
                  <Box
                    key={portNum}
                    sx={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      flexShrink: 0,
                      minWidth: 0,
                      gap: 'clamp(2px, 0.2vw + 1px, 4px)',
                    }}
                  >
                    {renderPortBox(portNum, port, connected)}
                    {/* Number below */}
                    <Typography
                      variant="caption"
                      sx={{
                        fontSize: fontSize,
                        fontWeight: 700,
                        color: '#000000',
                        lineHeight: 1,
                        height: fontSize,
                        display: 'flex',
                        alignItems: 'center',
                      }}
                    >
                      {portNum}
                    </Typography>
                  </Box>
                );
              };

              return (
                <Box
                  sx={{
                    display: 'flex',
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 'clamp(16px, 3vw + 12px, 120px)',
                  }}
                >
                  {/* Left side: Ports 15, 16 (centered vertically between the two rows) */}
                  <Box
                    sx={{
                      display: 'flex',
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 'clamp(1px, 2px + 0.8vw, 5px)',
                    }}
                  >
                    {fiberPorts.map((portNum) => renderPortWithBothNumbers(portNum))}
                  </Box>

                  {/* Right side: Two rows */}
                  <Box
                    sx={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-start',
                      gap: 'clamp(2px, 0.5vw + 2px, 8px)',
                    }}
                  >
                    {/* Top Row: 1, 3, 5, 7, 9, 11, 13 (numbers only on top) */}
                    <Box
                      sx={{
                        display: 'flex',
                        flexDirection: 'row',
                        alignItems: 'flex-end',
                        gap: 'clamp(1px, 2px + 0.8vw, 5px)',
                        flexWrap: 'nowrap',
                      }}
                    >
                      {topRowPorts.map((portNum) => renderPortWithTopNumber(portNum))}
                    </Box>

                    {/* Bottom Row: 2, 4, 6, 8, 10, 12, 14 (numbers only on bottom) */}
                    <Box
                      sx={{
                        display: 'flex',
                        flexDirection: 'row',
                        alignItems: 'flex-start',
                        gap: 'clamp(1px, 2px + 0.8vw, 5px)',
                        flexWrap: 'nowrap',
                      }}
                    >
                      {bottomRowPorts.map((portNum) => renderPortWithBottomNumber(portNum))}
                    </Box>
                  </Box>
                </Box>
              );
            })()}
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
      setCurrentSrc(CDN_PATTERNS.Q9H73A_SPECIFIC);
      setCdnIndex(0);
      setFormatIndex(0);
      setImageError(false);
      setImageLoaded(false);
      return;
    }

    // Check if this part number should use an alias
    const imagePartNumber = partNumberAliases[partNumber] || partNumber;

    // CDN URL patterns to try (recreated when partNumber changes)
    // Use config helper to generate URLs
    const cdnPatterns = getCdnUrlsForPartNumber(imagePartNumber);

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
    
    // CDN URL patterns to try - use config helper
    const cdnPatterns = getCdnUrlsForPartNumber(imagePartNumber);
    
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

  const [imageLoaded, setImageLoaded] = useState(false);

  // Always use HPE logo - no format checking needed (from config)
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
        <CardContent sx={{ bgcolor: 'transparent', p: 1.5 }}>
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
  const [healthCheckData, setHealthCheckData] = useState(null);
  const [healthCheckLoading, setHealthCheckLoading] = useState(false);
  const [healthCheckError, setHealthCheckError] = useState('');
  const [healthCheckDialogOpen, setHealthCheckDialogOpen] = useState(false);
  const [troubleshootDialogOpen, setTroubleshootDialogOpen] = useState(false);
  const [troubleshootAction, setTroubleshootAction] = useState(null);
  const [troubleshootLoading, setTroubleshootLoading] = useState(false);
  const [troubleshootResult, setTroubleshootResult] = useState(null);
  const [troubleshootError, setTroubleshootError] = useState('');
  const [showCommandsList, setShowCommandsList] = useState([]);

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
        case 'firmware':
          // await deviceAPI.updateFirmware(resolvedSerial);
          console.log('Update firmware:', resolvedSerial);
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

  const handleHealthCheck = async () => {
    if (!resolvedSerial) {
      setHealthCheckError('Device serial number is required');
      setHealthCheckDialogOpen(true);
      return;
    }

    setHealthCheckDialogOpen(true);
    setHealthCheckLoading(true);
    setHealthCheckError('');
    setHealthCheckData(null);

    try {
      const data = await configAPI.configHealth.getActiveIssues(resolvedSerial);
      setHealthCheckData(data);
    } catch (err) {
      console.error('Error fetching device health:', err);
      setHealthCheckError(err.response?.data?.error || err.message || 'Failed to fetch device health');
    } finally {
      setHealthCheckLoading(false);
    }
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
          <Box sx={{ mb: 2 }}>
            <Button
              startIcon={<ArrowBackIcon />}
              onClick={() => navigate('/devices')}
              sx={{ mb: 1 }}
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
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      <Grid container spacing={2}>
        {/* Device Information */}
        <Grid item xs={12} md={8}>
          <Card>
            <CardContent sx={{ p: 2 }}>
              <Typography variant="h6" sx={{ mb: 1, fontWeight: 600 }}>
                Device Information
              </Typography>
              <Divider sx={{ mb: 1.5 }} />

              <Grid container spacing={1.5}>
                {/* Basic Info - Collapsible */}
                <Grid item xs={12}>
                  <Accordion defaultExpanded>
                    <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                      <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                        Basic Information
                      </Typography>
                    </AccordionSummary>
                    <AccordionDetails sx={{ pt: 1.5, pb: 1.5 }}>
                      <Grid container spacing={1.5}>
                        <Grid item xs={6}>
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.25 }}>
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
                    <AccordionDetails sx={{ pt: 1.5, pb: 1.5 }}>
                      <Grid container spacing={1.5}>
                        <Grid item xs={6}>
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.25 }}>
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
                    <AccordionDetails sx={{ pt: 1.5, pb: 1.5 }}>
                      <Grid container spacing={1.5}>
                        <Grid item xs={6}>
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.25 }}>
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

                {/* Cluster Info (if available) */}
                {device?.clusterName && (
                  <>
                    <Grid item xs={12}>
                      <Divider sx={{ my: 1.5 }} />
                      <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
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
                      <Divider sx={{ my: 1.5 }} />
                      <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1 }}>
                        Notes
                      </Typography>
                    </Grid>
                    <Grid item xs={12}>
                      <Typography variant="body2" sx={{ p: 1.5, bgcolor: 'background.default', borderRadius: 1 }}>
                        {device?.notes}
                      </Typography>
                    </Grid>
                  </>
                )}
              </Grid>
            </CardContent>
          </Card>
        </Grid>

        {/* Device Actions - Collapsible */}
        <Grid item xs={12} md={4}>
          <Accordion defaultExpanded>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="h6" sx={{ fontWeight: 600 }}>
                Device Actions
              </Typography>
            </AccordionSummary>
            <AccordionDetails sx={{ pt: 1.5, pb: 1.5 }}>
              <List sx={{ pt: 0 }}>
                <ListItem
                  button
                  onClick={() => handleActionClick('firmware', 'Update Firmware')}
                  sx={{ borderRadius: 1, mb: 0.5, py: 0.75 }}
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
                  onClick={handleHealthCheck}
                  disabled={healthCheckLoading}
                  sx={{ borderRadius: 1, mb: 0.5, py: 0.75 }}
                >
                  <ListItemIcon>
                    {healthCheckLoading ? (
                      <CircularProgress size={24} />
                    ) : (
                      <HealthAndSafetyIcon color="primary" />
                    )}
                  </ListItemIcon>
                  <ListItemText
                    primary="Check Device Health"
                    secondary="View configuration issues"
                  />
                </ListItem>

                <ListItem
                  button
                  onClick={() => {
                    setTroubleshootDialogOpen(true);
                    setTroubleshootAction('port-bounce');
                  }}
                  sx={{ borderRadius: 1, mb: 0.5, py: 0.75 }}
                >
                  <ListItemIcon>
                    <RouteIcon color="primary" />
                  </ListItemIcon>
                  <ListItemText
                    primary="CX Port Bounce"
                    secondary="Bounce a port on a CX switch"
                  />
                </ListItem>

                <ListItem
                  button
                  onClick={() => {
                    const serial = resolvedSerial || serialOrName;
                    navigate(`/troubleshoot${serial ? `?device=${encodeURIComponent(serial)}` : ''}`);
                  }}
                  sx={{ borderRadius: 1, py: 0.75 }}
                >
                  <ListItemIcon>
                    <BuildIcon color="primary" />
                  </ListItemIcon>
                  <ListItemText
                    primary="Troubleshooting"
                    secondary="Ping, traceroute, and more"
                  />
                </ListItem>
              </List>
            </AccordionDetails>
          </Accordion>
        </Grid>

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

      {/* Wired Interfaces - Separate full-width section */}
      {device?.deviceType === 'SWITCH' && (
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <Accordion defaultExpanded>
              <AccordionSummary 
                expandIcon={<ExpandMoreIcon />}
                sx={{ minHeight: '48px', '&.Mui-expanded': { minHeight: '48px' } }}
              >
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  Wired Interfaces
                </Typography>
              </AccordionSummary>
              <AccordionDetails sx={{ pt: 1.5, pb: 1.5 }}>
                <WiredInterfacesView 
                  deviceSerial={device.serialNumber}
                  siteId={device.siteId}
                  partNumber={device.partNumber}
                />
              </AccordionDetails>
            </Accordion>
          </Grid>
        </Grid>
      )}

      <Grid container spacing={2}>
        {/* Switch-Specific Details (Accordion) */}
        {switchDetails && (
          <Grid item xs={12}>
            <Accordion>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  Switch Details
                </Typography>
              </AccordionSummary>
              <AccordionDetails sx={{ pt: 1.5, pb: 1.5 }}>
                <Grid container spacing={1.5}>
                  <Grid item xs={12} md={6}>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.25 }}>
                      Deployment
                    </Typography>
                    <Typography variant="body1">
                      {switchDetails.deployment || 'N/A'}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.25 }}>
                      Switch Role
                    </Typography>
                    <Typography variant="body1">
                      {switchDetails.switchRole || 'N/A'}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.25 }}>
                      Switch Type
                    </Typography>
                    <Typography variant="body1">
                      {switchDetails.switchType || 'N/A'}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.25 }}>
                      J-Number
                    </Typography>
                    <Typography variant="body1" fontFamily="monospace">
                      {switchDetails.jNumber || 'N/A'}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.25 }}>
                      Location
                    </Typography>
                    <Typography variant="body1">
                      {switchDetails.location || 'N/A'}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.25 }}>
                      Contact
                    </Typography>
                    <Typography variant="body1">
                      {switchDetails.contact || 'N/A'}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.25 }}>
                      Manufacturer
                    </Typography>
                    <Typography variant="body1">
                      {switchDetails.manufacturer || 'N/A'}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.25 }}>
                      Config Status
                    </Typography>
                    <Chip
                      label={switchDetails.configStatus || 'Unknown'}
                      size="small"
                      color={switchDetails.configStatus === 'Synchronized' ? 'success' : 'warning'}
                    />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.25 }}>
                      Last Restart Reason
                    </Typography>
                    <Typography variant="body1">
                      {switchDetails.lastRestartReason || 'N/A'}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.25 }}>
                      Reboot Timestamp
                    </Typography>
                    <Typography variant="body1">
                      {formatTimestamp(switchDetails.rebootTs)}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.25 }}>
                      Firmware Backup Version
                    </Typography>
                    <Typography variant="body1">
                      {switchDetails.firmwareBackupVersion || 'N/A'}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.25 }}>
                      Firmware Recommended Version
                    </Typography>
                    <Typography variant="body1">
                      {switchDetails.firmwareRecommendedVersion || 'N/A'}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.25 }}>
                      STP Enabled
                    </Typography>
                    <Typography variant="body1">
                      {switchDetails.stpEnable ? 'Yes' : 'No'}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.25 }}>
                      STP Mode
                    </Typography>
                    <Typography variant="body1">
                      {switchDetails.stpMode?.toUpperCase() || 'N/A'}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.25 }}>
                      Public IP
                    </Typography>
                    <Typography variant="body1" fontFamily="monospace">
                      {switchDetails.publicIp || 'N/A'}
                    </Typography>
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.25 }}>
                      Last Config Change
                    </Typography>
                    <Typography variant="body1">
                      {formatTimestamp(switchDetails.lastConfigChange)}
                    </Typography>
                  </Grid>
                </Grid>

                {/* Health Reasons */}
                {switchDetails.healthReasons && (
                  <Box sx={{ mt: 2 }}>
                    <Divider sx={{ mb: 1.5 }} />
                    <Typography variant="subtitle1" sx={{ mb: 1, fontWeight: 600 }}>
                      Health Status
                    </Typography>
                    <Grid container spacing={1.5}>
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

      {/* Device Health Check Dialog */}
      <Dialog
        open={healthCheckDialogOpen}
        onClose={() => {
          setHealthCheckDialogOpen(false);
          setHealthCheckError('');
          setHealthCheckData(null);
        }}
        maxWidth="lg"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <HealthAndSafetyIcon color="primary" />
              <Typography variant="h6">Device Health Check</Typography>
              {healthCheckData && (
                <>
                  {healthCheckData.validationBlocker?.length > 0 && (
                    <Chip 
                      label={`${healthCheckData.validationBlocker.length} Blocker${healthCheckData.validationBlocker.length > 1 ? 's' : ''}`}
                      size="small"
                      color="error"
                      sx={{ ml: 1 }}
                    />
                  )}
                  {healthCheckData.validationNonBlocker?.length > 0 && (
                    <Chip 
                      label={`${healthCheckData.validationNonBlocker.length} Warning${healthCheckData.validationNonBlocker.length > 1 ? 's' : ''}`}
                      size="small"
                      color="warning"
                      sx={{ ml: 1 }}
                    />
                  )}
                  {(!healthCheckData.validationBlocker || healthCheckData.validationBlocker.length === 0) &&
                   (!healthCheckData.validationNonBlocker || healthCheckData.validationNonBlocker.length === 0) &&
                   (!healthCheckData.configDistribution || healthCheckData.configDistribution.length === 0) &&
                   (!healthCheckData.configImport || healthCheckData.configImport.length === 0) && (
                    <Chip 
                      label="Healthy"
                      size="small"
                      color="success"
                      sx={{ ml: 1 }}
                    />
                  )}
                </>
              )}
            </Box>
            <Button
              variant="outlined"
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                handleHealthCheck();
              }}
              disabled={healthCheckLoading}
              startIcon={healthCheckLoading ? <CircularProgress size={16} /> : <HealthAndSafetyIcon />}
            >
              Refresh
            </Button>
          </Box>
        </DialogTitle>
        <DialogContent>
          {healthCheckLoading && !healthCheckData && (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
              <CircularProgress />
            </Box>
          )}
          
          {healthCheckError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {healthCheckError}
            </Alert>
          )}

          {healthCheckData && (
            <Grid container spacing={2}>
              {/* Validation Blockers */}
              {healthCheckData.validationBlocker && healthCheckData.validationBlocker.length > 0 && (
                <Grid item xs={12}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Chip label="Blockers" size="small" color="error" />
                    {healthCheckData.validationBlocker.length} issue{healthCheckData.validationBlocker.length > 1 ? 's' : ''} preventing configuration
                  </Typography>
                  {healthCheckData.validationBlocker.map((issue, idx) => (
                    <Accordion key={idx} sx={{ mb: 2 }}>
                      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                        <Box sx={{ width: '100%', display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Chip label="Blocker" size="small" color="error" />
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {issue.issueCategory}: {issue.issueDescription}
                          </Typography>
                        </Box>
                      </AccordionSummary>
                      <AccordionDetails sx={{ pt: 1.5, pb: 1.5 }}>
                        <Grid container spacing={1.5}>
                          <Grid item xs={6}>
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.25 }}>
                              Issue Category
                            </Typography>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                              {issue.issueCategory}
                            </Typography>
                          </Grid>
                          <Grid item xs={6}>
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.25 }}>
                              Profile Name
                            </Typography>
                            <Typography variant="body2" fontFamily="monospace">
                              {issue.profileName}
                            </Typography>
                          </Grid>
                          <Grid item xs={6}>
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.25 }}>
                              Profile Type
                            </Typography>
                            <Typography variant="body2">
                              {issue.profileType}
                            </Typography>
                          </Grid>
                          <Grid item xs={6}>
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.25 }}>
                              Assigned Scope
                            </Typography>
                            <Typography variant="body2" fontFamily="monospace">
                              {issue.assignedScope}
                            </Typography>
                          </Grid>
                          <Grid item xs={12}>
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.25 }}>
                              Issue Description
                            </Typography>
                            <Typography variant="body2">
                              {issue.issueDescription}
                            </Typography>
                          </Grid>
                          <Grid item xs={12}>
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.25 }}>
                              Recommended Action
                            </Typography>
                            <Typography variant="body2">
                              {issue.recommendedAction}
                            </Typography>
                          </Grid>
                          {issue.timestamp && (
                            <Grid item xs={6}>
                              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.25 }}>
                                Timestamp
                              </Typography>
                              <Typography variant="body2">
                                {formatTimestamp(parseInt(issue.timestamp))}
                              </Typography>
                            </Grid>
                          )}
                          <Grid item xs={6}>
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.25 }}>
                              Scope Type
                            </Typography>
                            <Typography variant="body2">
                              {issue.assignedScopeType}
                            </Typography>
                          </Grid>
                        </Grid>
                      </AccordionDetails>
                    </Accordion>
                  ))}
                </Grid>
              )}

              {/* Validation Non-Blockers */}
              {healthCheckData.validationNonBlocker && healthCheckData.validationNonBlocker.length > 0 && (
                <Grid item xs={12}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Chip label="Warnings" size="small" color="warning" />
                    {healthCheckData.validationNonBlocker.length} non-blocking issue{healthCheckData.validationNonBlocker.length > 1 ? 's' : ''}
                  </Typography>
                  {healthCheckData.validationNonBlocker.map((issue, idx) => (
                    <Accordion key={idx} sx={{ mb: 2 }}>
                      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                        <Box sx={{ width: '100%', display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Chip label="Warning" size="small" color="warning" />
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {issue.issueCategory}: {issue.issueDescription}
                          </Typography>
                        </Box>
                      </AccordionSummary>
                      <AccordionDetails sx={{ pt: 1.5, pb: 1.5 }}>
                        <Grid container spacing={1.5}>
                          <Grid item xs={6}>
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.25 }}>
                              Issue Category
                            </Typography>
                            <Typography variant="body2" sx={{ fontWeight: 600 }}>
                              {issue.issueCategory}
                            </Typography>
                          </Grid>
                          <Grid item xs={6}>
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.25 }}>
                              Profile Name
                            </Typography>
                            <Typography variant="body2" fontFamily="monospace">
                              {issue.profileName}
                            </Typography>
                          </Grid>
                          <Grid item xs={6}>
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.25 }}>
                              Profile Type
                            </Typography>
                            <Typography variant="body2">
                              {issue.profileType}
                            </Typography>
                          </Grid>
                          <Grid item xs={6}>
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.25 }}>
                              Assigned Scope
                            </Typography>
                            <Typography variant="body2" fontFamily="monospace">
                              {issue.assignedScope}
                            </Typography>
                          </Grid>
                          <Grid item xs={12}>
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.25 }}>
                              Issue Description
                            </Typography>
                            <Typography variant="body2">
                              {issue.issueDescription}
                            </Typography>
                          </Grid>
                          <Grid item xs={12}>
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.25 }}>
                              Recommended Action
                            </Typography>
                            <Typography variant="body2">
                              {issue.recommendedAction}
                            </Typography>
                          </Grid>
                          {issue.timestamp && (
                            <Grid item xs={6}>
                              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.25 }}>
                                Timestamp
                              </Typography>
                              <Typography variant="body2">
                                {formatTimestamp(parseInt(issue.timestamp))}
                              </Typography>
                            </Grid>
                          )}
                          <Grid item xs={6}>
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.25 }}>
                              Scope Type
                            </Typography>
                            <Typography variant="body2">
                              {issue.assignedScopeType}
                            </Typography>
                          </Grid>
                        </Grid>
                      </AccordionDetails>
                    </Accordion>
                  ))}
                </Grid>
              )}

              {/* Config Distribution Issues */}
              {healthCheckData.configDistribution && healthCheckData.configDistribution.length > 0 && (
                <Grid item xs={12}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Chip label="Distribution" size="small" color="info" />
                    {healthCheckData.configDistribution.length} distribution issue{healthCheckData.configDistribution.length > 1 ? 's' : ''}
                  </Typography>
                  {healthCheckData.configDistribution.map((issue, idx) => (
                    <Accordion key={idx} sx={{ mb: 2 }}>
                      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                        <Box sx={{ width: '100%', display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Chip label="Distribution" size="small" color="info" />
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {issue.issueCategory || 'Config Distribution Issue'}
                          </Typography>
                        </Box>
                      </AccordionSummary>
                      <AccordionDetails sx={{ pt: 1.5, pb: 1.5 }}>
                        <Typography variant="body2">
                          {issue.issueDescription || JSON.stringify(issue, null, 2)}
                        </Typography>
                      </AccordionDetails>
                    </Accordion>
                  ))}
                </Grid>
              )}

              {/* Config Import Issues */}
              {healthCheckData.configImport && healthCheckData.configImport.length > 0 && (
                <Grid item xs={12}>
                  <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 2, display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Chip label="Import" size="small" color="info" />
                    {healthCheckData.configImport.length} import issue{healthCheckData.configImport.length > 1 ? 's' : ''}
                  </Typography>
                  {healthCheckData.configImport.map((issue, idx) => (
                    <Accordion key={idx} sx={{ mb: 2 }}>
                      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                        <Box sx={{ width: '100%', display: 'flex', alignItems: 'center', gap: 1 }}>
                          <Chip label="Import" size="small" color="info" />
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {issue.issueCategory || 'Config Import Issue'}
                          </Typography>
                        </Box>
                      </AccordionSummary>
                      <AccordionDetails sx={{ pt: 1.5, pb: 1.5 }}>
                        <Typography variant="body2">
                          {issue.issueDescription || JSON.stringify(issue, null, 2)}
                        </Typography>
                      </AccordionDetails>
                    </Accordion>
                  ))}
                </Grid>
              )}

              {/* No Issues */}
              {(!healthCheckData.validationBlocker || healthCheckData.validationBlocker.length === 0) &&
               (!healthCheckData.validationNonBlocker || healthCheckData.validationNonBlocker.length === 0) &&
               (!healthCheckData.configDistribution || healthCheckData.configDistribution.length === 0) &&
               (!healthCheckData.configImport || healthCheckData.configImport.length === 0) && (
                <Grid item xs={12}>
                  <Alert severity="success">
                    No configuration health issues found. Device configuration is healthy.
                  </Alert>
                </Grid>
              )}
            </Grid>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setHealthCheckDialogOpen(false);
            setHealthCheckError('');
            setHealthCheckData(null);
          }}>
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Troubleshooting Dialog */}
      <Dialog
        open={troubleshootDialogOpen}
        onClose={() => {
          setTroubleshootDialogOpen(false);
          setTroubleshootAction(null);
          setTroubleshootResult(null);
          setTroubleshootError('');
        }}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <BuildIcon color="primary" />
            <Typography variant="h6">CX Switch Troubleshooting</Typography>
          </Box>
        </DialogTitle>
        <DialogContent>
          {!troubleshootAction ? (
            <Grid container spacing={2} sx={{ mt: 1 }}>
              <Grid item xs={12} sm={6}>
                <Card
                  sx={{
                    cursor: 'pointer',
                    '&:hover': { bgcolor: 'action.hover' },
                    height: '100%',
                  }}
                  onClick={() => setTroubleshootAction('ping')}
                >
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                      <PingIcon color="primary" />
                      <Typography variant="h6">Ping</Typography>
                    </Box>
                    <Typography variant="body2" color="text.secondary">
                      Test network connectivity to a target host
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Card
                  sx={{
                    cursor: 'pointer',
                    '&:hover': { bgcolor: 'action.hover' },
                    height: '100%',
                  }}
                  onClick={() => setTroubleshootAction('traceroute')}
                >
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                      <RouteIcon color="primary" />
                      <Typography variant="h6">Traceroute</Typography>
                    </Box>
                    <Typography variant="body2" color="text.secondary">
                      Trace the network path to a destination
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Card
                  sx={{
                    cursor: 'pointer',
                    '&:hover': { bgcolor: 'action.hover' },
                    height: '100%',
                  }}
                  onClick={() => setTroubleshootAction('poe-bounce')}
                >
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                      <PowerIcon color="primary" />
                      <Typography variant="h6">POE Bounce</Typography>
                    </Box>
                    <Typography variant="body2" color="text.secondary">
                      Cycle power on a POE port
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Card
                  sx={{
                    cursor: 'pointer',
                    '&:hover': { bgcolor: 'action.hover' },
                    height: '100%',
                  }}
                  onClick={() => setTroubleshootAction('port-bounce')}
                >
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                      <LanIcon color="primary" />
                      <Typography variant="h6">Port Bounce</Typography>
                    </Box>
                    <Typography variant="body2" color="text.secondary">
                      Cycle a switch port (shut/no shut)
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Card
                  sx={{
                    cursor: 'pointer',
                    '&:hover': { bgcolor: 'action.hover' },
                    height: '100%',
                  }}
                  onClick={() => setTroubleshootAction('cable-test')}
                >
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                      <CableIcon color="primary" />
                      <Typography variant="h6">Cable Test</Typography>
                    </Box>
                    <Typography variant="body2" color="text.secondary">
                      Test cable integrity and length
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Card
                  sx={{
                    cursor: 'pointer',
                    '&:hover': { bgcolor: 'action.hover' },
                    height: '100%',
                  }}
                  onClick={() => setTroubleshootAction('http-test')}
                >
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                      <HttpIcon color="primary" />
                      <Typography variant="h6">HTTP Test</Typography>
                    </Box>
                    <Typography variant="body2" color="text.secondary">
                      Test HTTP connectivity to a URL
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Card
                  sx={{
                    cursor: 'pointer',
                    '&:hover': { bgcolor: 'action.hover' },
                    height: '100%',
                  }}
                  onClick={() => setTroubleshootAction('aaa-test')}
                >
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                      <SecurityIcon color="primary" />
                      <Typography variant="h6">AAA Test</Typography>
                    </Box>
                    <Typography variant="body2" color="text.secondary">
                      Test AAA authentication
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Card
                  sx={{
                    cursor: 'pointer',
                    '&:hover': { bgcolor: 'action.hover' },
                    height: '100%',
                  }}
                  onClick={() => setTroubleshootAction('show-command')}
                >
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                      <TerminalIcon color="primary" />
                      <Typography variant="h6">Show Commands</Typography>
                    </Box>
                    <Typography variant="body2" color="text.secondary">
                      Run show commands on the switch
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Card
                  sx={{
                    cursor: 'pointer',
                    '&:hover': { bgcolor: 'action.hover' },
                    height: '100%',
                  }}
                  onClick={() => setTroubleshootAction('locate')}
                >
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                      <LocationOnIcon color="primary" />
                      <Typography variant="h6">Locate Switch</Typography>
                    </Box>
                    <Typography variant="body2" color="text.secondary">
                      Flash LEDs to locate the switch
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Card
                  sx={{
                    cursor: 'pointer',
                    '&:hover': { bgcolor: 'action.hover' },
                    height: '100%',
                    border: '2px solid',
                    borderColor: 'error.main',
                  }}
                  onClick={() => setTroubleshootAction('reboot')}
                >
                  <CardContent>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
                      <RestartAltIcon color="error" />
                      <Typography variant="h6" color="error">Reboot Switch</Typography>
                    </Box>
                    <Typography variant="body2" color="text.secondary">
                      Reboot the switch (use with caution)
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            </Grid>
          ) : (
            <TroubleshootActionForm
              action={troubleshootAction}
              deviceSerial={resolvedSerial}
              siteId={device?.siteId}
              onBack={() => {
                setTroubleshootAction(null);
                setTroubleshootResult(null);
                setTroubleshootError('');
              }}
              onExecute={async (params) => {
                setTroubleshootLoading(true);
                setTroubleshootError('');
                setTroubleshootResult(null);
                try {
                  let result;
                  switch (troubleshootAction) {
                    case 'ping':
                      result = await troubleshootAPI.cxPing(resolvedSerial, params.target);
                      break;
                    case 'traceroute':
                      result = await troubleshootAPI.cxTraceroute(resolvedSerial, params.target);
                      break;
                    case 'poe-bounce':
                      result = await troubleshootAPI.cxPoeBounce(resolvedSerial, params.port);
                      break;
                    case 'port-bounce':
                      result = await troubleshootAPI.cxPortBounce(resolvedSerial, params.port);
                      break;
                    case 'cable-test':
                      result = await troubleshootAPI.cxCableTest(resolvedSerial, params.port);
                      break;
                    case 'http-test':
                      result = await troubleshootAPI.cxHttpTest(resolvedSerial, params.url);
                      break;
                    case 'aaa-test':
                      result = await troubleshootAPI.cxAaaTest(resolvedSerial, params.username, params.password);
                      break;
                    case 'show-command':
                      if (params.listCommands) {
                        result = await troubleshootAPI.cxListShowCommands(resolvedSerial);
                        // Handle different response formats
                        const commands = result?.commands || result?.items || (Array.isArray(result) ? result : []);
                        setShowCommandsList(commands);
                      } else {
                        result = await troubleshootAPI.cxRunShowCommand(resolvedSerial, params.command);
                      }
                      break;
                    case 'locate':
                      result = await troubleshootAPI.cxLocate(resolvedSerial, params.enable);
                      break;
                    case 'reboot':
                      result = await troubleshootAPI.cxReboot(resolvedSerial);
                      break;
                    default:
                      throw new Error('Unknown action');
                  }
                  setTroubleshootResult(result);
                } catch (err) {
                  console.error('Troubleshooting operation error:', err);
                  const errorMessage = err.response?.data?.error || err.response?.data?.message || err.message || 'Operation failed';
                  setTroubleshootError(String(errorMessage));
                  setTroubleshootResult(null);
                } finally {
                  setTroubleshootLoading(false);
                }
              }}
              loading={troubleshootLoading}
              result={troubleshootResult}
              error={troubleshootError}
              showCommandsList={showCommandsList}
            />
          )}
        </DialogContent>
        <DialogActions>
          {troubleshootAction ? (
            <>
              <Button onClick={() => {
                setTroubleshootAction(null);
                setTroubleshootResult(null);
                setTroubleshootError('');
              }}>
                Back
              </Button>
              <Button onClick={() => {
                setTroubleshootDialogOpen(false);
                setTroubleshootAction(null);
                setTroubleshootResult(null);
                setTroubleshootError('');
              }}>
                Close
              </Button>
            </>
          ) : (
            <Button onClick={() => setTroubleshootDialogOpen(false)}>
              Close
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Box>
  );
}

// Troubleshoot Action Form Component
function TroubleshootActionForm({ action, deviceSerial, siteId, onBack, onExecute, loading, result, error, showCommandsList }) {
  const [formData, setFormData] = useState({});
  const [listCommandsMode, setListCommandsMode] = useState(false);
  const [refreshingPortStatus, setRefreshingPortStatus] = useState(false);
  const [refreshedPortStatus, setRefreshedPortStatus] = useState(null);
  const [autoRefreshActive, setAutoRefreshActive] = useState(false);
  const intervalRef = useRef(null);
  const portStatusRef = useRef(null);

  // Safety check: ensure result is an object or null
  const safeResult = result && typeof result === 'object' ? result : null;
  
  // Refresh port status after bounce
  const handleRefreshPortStatus = async () => {
    if (!formData.port || !deviceSerial) return;
    
    setRefreshingPortStatus(true);
    try {
      const interfaces = await deviceAPI.getSwitchInterfaces(deviceSerial, siteId);
      if (interfaces && interfaces.items) {
        const port = interfaces.items.find(p => {
          const portId = p.id || p.name || '';
          return portId === formData.port || portId.endsWith(`/${formData.port}`) || portId.includes(formData.port);
        });
        if (port) {
          const newStatus = {
            operStatus: port.operStatus || 'Unknown',
            adminStatus: port.adminStatus || 'Unknown',
            id: port.id || port.name || formData.port,
            name: port.name || port.id || formData.port,
          };
          portStatusRef.current = newStatus;
          setRefreshedPortStatus(newStatus);
          
          // If port is Up, stop auto-refresh
          if (newStatus.operStatus === 'Up' && !newStatus.error && intervalRef.current) {
            setAutoRefreshActive(false);
            clearInterval(intervalRef.current);
            intervalRef.current = null;
          }
        } else {
          const errorStatus = { error: 'Port not found in interface list' };
          portStatusRef.current = errorStatus;
          setRefreshedPortStatus(errorStatus);
        }
      } else {
        const errorStatus = { error: 'Could not retrieve interfaces' };
        portStatusRef.current = errorStatus;
        setRefreshedPortStatus(errorStatus);
      }
    } catch (err) {
      console.error('Error refreshing port status:', err);
      const errorStatus = { error: err.message || 'Failed to refresh port status' };
      portStatusRef.current = errorStatus;
      setRefreshedPortStatus(errorStatus);
    } finally {
      setRefreshingPortStatus(false);
    }
  };

  // Auto-refresh port status every 3 seconds after port bounce
  useEffect(() => {
    if (action !== 'port-bounce' || !safeResult || !formData.port || !deviceSerial) {
      setAutoRefreshActive(false);
      portStatusRef.current = null;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // Initialize port status ref with current status
    portStatusRef.current = refreshedPortStatus || safeResult.portStatus || null;

    // Check if port is already Up - if so, don't auto-refresh
    const currentStatus = refreshedPortStatus || safeResult.portStatus;
    if (currentStatus && currentStatus.operStatus === 'Up' && !currentStatus.error) {
      setAutoRefreshActive(false);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    setAutoRefreshActive(true);

    // Initial refresh after 2 seconds
    const initialTimeout = setTimeout(() => {
      handleRefreshPortStatus();
    }, 2000);

    // Then refresh every 3 seconds
    intervalRef.current = setInterval(async () => {
      // Check current status using ref (has latest value)
      const currentStatus = portStatusRef.current || refreshedPortStatus || safeResult.portStatus;
      if (currentStatus && currentStatus.operStatus === 'Up' && !currentStatus.error) {
        // Port is Up - stop auto-refresh
        setAutoRefreshActive(false);
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        return;
      }
      // Port is still Down - refresh the status
      await handleRefreshPortStatus();
    }, 3000);

    return () => {
      clearTimeout(initialTimeout);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setAutoRefreshActive(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [action, safeResult, formData.port, deviceSerial, siteId]);

  // Stop auto-refresh when port comes up
  useEffect(() => {
    const currentStatus = refreshedPortStatus || safeResult?.portStatus;
    if (currentStatus) {
      portStatusRef.current = currentStatus;
    }
    if (currentStatus && currentStatus.operStatus === 'Up' && !currentStatus.error) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      setAutoRefreshActive(false);
    }
  }, [refreshedPortStatus, safeResult]);

  const handleListCommands = () => {
    setListCommandsMode(true);
    onExecute({ listCommands: true });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setRefreshedPortStatus(null); // Reset refreshed status when executing new action
    portStatusRef.current = null; // Reset ref as well
    onExecute(formData);
  };

  const handleReboot = () => {
    if (window.confirm(`Are you sure you want to reboot switch ${deviceSerial}? This will cause a service interruption.`)) {
      onExecute({});
    }
  };

  if (action === 'reboot') {
    return (
      <Box>
        <Alert severity="warning" sx={{ mb: 2 }}>
          <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
            Warning: This will reboot the switch
          </Typography>
          <Typography variant="body2">
            Rebooting the switch will cause a temporary service interruption. All connected devices will lose connectivity.
          </Typography>
        </Alert>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {result && (
          <Alert severity="success" sx={{ mb: 2 }}>
            <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>Reboot initiated</Typography>
            <Typography variant="body2" component="pre" sx={{ fontSize: '0.875rem', whiteSpace: 'pre-wrap', maxHeight: 400, overflow: 'auto' }}>
              {result && typeof result === 'object' ? JSON.stringify(result, null, 2) : String(result)}
            </Typography>
          </Alert>
        )}
        <Button
          variant="contained"
          color="error"
          onClick={handleReboot}
          disabled={loading}
          fullWidth
          sx={{ mt: 2 }}
        >
          {loading ? <CircularProgress size={24} /> : 'Reboot Switch'}
        </Button>
      </Box>
    );
  }

  if (action === 'locate') {
    return (
      <Box>
        <Typography variant="body2" sx={{ mb: 2 }}>
          This will flash the LEDs on the switch to help locate it physically.
        </Typography>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {result && typeof result === 'object' && (
          <Alert severity="success" sx={{ mb: 2 }}>
            <Typography variant="body2" component="pre" sx={{ fontSize: '0.875rem', whiteSpace: 'pre-wrap', maxHeight: 400, overflow: 'auto' }}>
              {JSON.stringify(result, null, 2)}
            </Typography>
          </Alert>
        )}
        {result && typeof result !== 'object' && (
          <Alert severity="success" sx={{ mb: 2 }}>
            <Typography variant="body2">{String(result)}</Typography>
          </Alert>
        )}
        <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
          <Button
            variant="contained"
            onClick={() => onExecute({ enable: true })}
            disabled={loading}
            fullWidth
          >
            {loading ? <CircularProgress size={24} /> : 'Enable Locate'}
          </Button>
          <Button
            variant="outlined"
            onClick={() => onExecute({ enable: false })}
            disabled={loading}
            fullWidth
          >
            {loading ? <CircularProgress size={24} /> : 'Disable Locate'}
          </Button>
        </Box>
      </Box>
    );
  }

  if (action === 'show-command' && listCommandsMode) {
    return (
      <Box>
        <Button onClick={() => setListCommandsMode(false)} sx={{ mb: 2 }}>
          ← Back to Run Command
        </Button>
        {loading ? (
          <CircularProgress />
        ) : showCommandsList && Array.isArray(showCommandsList) && showCommandsList.length > 0 ? (
          <Paper sx={{ p: 2, maxHeight: 400, overflow: 'auto' }}>
            <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 600 }}>
              Available Commands:
            </Typography>
            <List>
              {showCommandsList.map((cmd, idx) => (
                <ListItem key={idx}>
                  <CodeIcon sx={{ mr: 1, fontSize: 16 }} />
                  <Typography variant="body2" fontFamily="monospace">
                    {String(cmd || '')}
                  </Typography>
                </ListItem>
              ))}
            </List>
          </Paper>
        ) : (
          <Alert severity="info">No commands available</Alert>
        )}
      </Box>
    );
  }

  return (
    <Box component="form" onSubmit={handleSubmit}>
      {action === 'ping' && (
        <>
          <TextField
            fullWidth
            label="Target IP or Hostname"
            value={formData.target || ''}
            onChange={(e) => setFormData({ ...formData, target: e.target.value })}
            required
            sx={{ mb: 2 }}
            placeholder="8.8.8.8"
          />
        </>
      )}

      {action === 'traceroute' && (
        <>
          <TextField
            fullWidth
            label="Target IP or Hostname"
            value={formData.target || ''}
            onChange={(e) => setFormData({ ...formData, target: e.target.value })}
            required
            sx={{ mb: 2 }}
            placeholder="8.8.8.8"
          />
        </>
      )}

      {(action === 'poe-bounce' || action === 'port-bounce' || action === 'cable-test') && (
        <>
          <TextField
            fullWidth
            label="Port Number"
            value={formData.port || ''}
            onChange={(e) => setFormData({ ...formData, port: e.target.value })}
            required
            sx={{ mb: 2 }}
            placeholder="1/1/1"
            helperText="Enter port identifier (e.g., 1/1/1)"
          />
        </>
      )}

      {action === 'http-test' && (
        <>
          <TextField
            fullWidth
            label="URL"
            value={formData.url || ''}
            onChange={(e) => setFormData({ ...formData, url: e.target.value })}
            required
            sx={{ mb: 2 }}
            placeholder="http://example.com"
          />
        </>
      )}

      {action === 'aaa-test' && (
        <>
          <TextField
            fullWidth
            label="Username"
            value={formData.username || ''}
            onChange={(e) => setFormData({ ...formData, username: e.target.value })}
            required
            sx={{ mb: 2 }}
          />
          <TextField
            fullWidth
            label="Password"
            type="password"
            value={formData.password || ''}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            required
            sx={{ mb: 2 }}
          />
        </>
      )}

      {action === 'show-command' && (
        <>
          <Box sx={{ mb: 2 }}>
            <Button
              variant="outlined"
              onClick={handleListCommands}
              disabled={loading}
              sx={{ mb: 2 }}
              startIcon={<CodeIcon />}
            >
              {loading && listCommandsMode ? <CircularProgress size={20} sx={{ mr: 1 }} /> : null}
              List Available Commands
            </Button>
          </Box>
          <TextField
            fullWidth
            label="Command"
            value={formData.command || ''}
            onChange={(e) => setFormData({ ...formData, command: e.target.value })}
            required
            sx={{ mb: 2 }}
            placeholder="show version"
            helperText="Enter show command to execute"
          />
        </>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          <Typography variant="body2">{String(error || 'Unknown error occurred')}</Typography>
        </Alert>
      )}
      {safeResult && (
        <Alert 
          severity={
            // For port-bounce, "Timed Out" failReason is expected when port has no device connected
            action === 'port-bounce' && safeResult.failReason === 'Timed Out' && safeResult.status === 'COMPLETED'
              ? 'warning'
              : safeResult.status === 'FAILED' || safeResult.status === 'TIMEOUT'
              ? 'error'
              : 'success'
          } 
          sx={{ mb: 2 }}
        >
          <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
            {safeResult.status || safeResult.task_id ? `Status: ${safeResult.status || 'Unknown'}` : 'Result'}
          </Typography>
          
          {/* Port bounce results - handle special structure */}
          {action === 'port-bounce' && safeResult && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
                Port Bounce Results
                {safeResult.failReason && ` - ${safeResult.failReason}`}
              </Typography>
              {safeResult.failReason === 'Timed Out' && (
                <Typography variant="body2" sx={{ mb: 1, fontStyle: 'italic' }}>
                  Note: This is expected when the port has no device connected.
                </Typography>
              )}
              {safeResult.warning && (
                <Alert severity="warning" sx={{ mb: 1 }}>
                  {safeResult.warning}
                </Alert>
              )}
              
              {/* Port Status Display */}
              {(safeResult.portStatus || refreshedPortStatus) && (
                <Box sx={{ mb: 2, p: 1.5, bgcolor: 'background.paper', borderRadius: 1, border: '1px solid', borderColor: 'divider' }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        Port Status {refreshedPortStatus ? '(Refreshed)' : 'After Bounce'}:
                      </Typography>
                      {autoRefreshActive && (
                        <Chip 
                          label="Auto-refreshing every 3s" 
                          size="small" 
                          color="info"
                          icon={<CircularProgress size={12} />}
                        />
                      )}
                    </Box>
                    {action === 'port-bounce' && formData.port && (
                      <Button
                        size="small"
                        variant="outlined"
                        onClick={handleRefreshPortStatus}
                        disabled={refreshingPortStatus}
                        startIcon={refreshingPortStatus ? <CircularProgress size={16} /> : <UpdateIcon />}
                      >
                        {refreshingPortStatus ? 'Refreshing...' : 'Refresh Status'}
                      </Button>
                    )}
                  </Box>
                  {(refreshedPortStatus || safeResult.portStatus) && (
                    <>
                      <Grid container spacing={2}>
                        <Grid item xs={6}>
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                            Port ID
                          </Typography>
                          <Typography variant="body2" fontFamily="monospace">
                            {(refreshedPortStatus || safeResult.portStatus).id || (refreshedPortStatus || safeResult.portStatus).name || 'N/A'}
                          </Typography>
                        </Grid>
                        <Grid item xs={6}>
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                            Operational Status
                          </Typography>
                          <Chip 
                            label={(refreshedPortStatus || safeResult.portStatus).operStatus || 'Unknown'} 
                            size="small"
                            color={(refreshedPortStatus || safeResult.portStatus).operStatus === 'Up' ? 'success' : (refreshedPortStatus || safeResult.portStatus).operStatus === 'Down' ? 'error' : 'default'}
                            sx={{ mt: 0.5 }}
                          />
                        </Grid>
                        <Grid item xs={6}>
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                            Administrative Status
                          </Typography>
                          <Chip 
                            label={(refreshedPortStatus || safeResult.portStatus).adminStatus || 'Unknown'} 
                            size="small"
                            color={(refreshedPortStatus || safeResult.portStatus).adminStatus === 'Up' ? 'success' : 'default'}
                            sx={{ mt: 0.5 }}
                          />
                        </Grid>
                      </Grid>
                      {((refreshedPortStatus || safeResult.portStatus).operStatus === 'Down' || (refreshedPortStatus || safeResult.portStatus).error) && (
                        <Alert severity={refreshedPortStatus?.error ? 'warning' : 'info'} sx={{ mt: 1 }}>
                          <Typography variant="body2">
                            {refreshedPortStatus?.error 
                              ? refreshedPortStatus.error
                              : 'Port is currently Down. If a device is connected, it may take 10-30 seconds for the port to come back up. ' + (autoRefreshActive ? 'Status is being checked automatically every 3 seconds.' : 'Use the Refresh Status button to check again.')}
                          </Typography>
                        </Alert>
                      )}
                      {(refreshedPortStatus || safeResult.portStatus).operStatus === 'Up' && (
                        <Alert severity="success" sx={{ mt: 1 }}>
                          <Typography variant="body2">
                            Port is Up and operational.
                          </Typography>
                        </Alert>
                      )}
                    </>
                  )}
                </Box>
              )}
              
              <Typography variant="body2" component="pre" sx={{ fontSize: '0.875rem', whiteSpace: 'pre-wrap', fontFamily: 'monospace', bgcolor: 'background.paper', p: 1, borderRadius: 1, maxHeight: 400, overflow: 'auto' }}>
                {safeResult.status && `Status: ${safeResult.status}\n`}
                {safeResult.progressPercent !== undefined && `Progress: ${safeResult.progressPercent}%\n`}
                {safeResult.failReason && `Fail Reason: ${safeResult.failReason}\n`}
                {safeResult.startTime && `Start Time: ${safeResult.startTime}\n`}
                {safeResult.endTime && `End Time: ${safeResult.endTime}\n`}
                {safeResult.output !== null && safeResult.output !== undefined && `Output: ${safeResult.output}\n`}
                {safeResult.message && `\n${safeResult.message}\n`}
              </Typography>
            </Box>
          )}
          
          {/* Ping results - handle special structure */}
          {action === 'ping' && safeResult.replies && Array.isArray(safeResult.replies) && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
                Ping Results for {safeResult.destination || 'target'}
              </Typography>
              <Typography variant="body2" component="pre" sx={{ fontSize: '0.875rem', whiteSpace: 'pre-wrap', fontFamily: 'monospace', bgcolor: 'background.paper', p: 1, borderRadius: 1, maxHeight: 400, overflow: 'auto' }}>
                {safeResult.replies.map((reply, idx) => 
                  `Reply ${idx + 1}: ${reply.sequenceNumber || idx + 1} - ${reply.roundTripTimeMilliseconds || 'N/A'}ms`
                ).join('\n')}
                {safeResult.packetLossPercent !== undefined && `\nPacket Loss: ${safeResult.packetLossPercent}%`}
                {safeResult.averageRoundTripTimeMilliseconds !== undefined && `\nAverage RTT: ${safeResult.averageRoundTripTimeMilliseconds}ms`}
                {safeResult.transmittedPacketsCount !== undefined && `\nTransmitted: ${safeResult.transmittedPacketsCount}`}
                {safeResult.receivedPacketsCount !== undefined && `\nReceived: ${safeResult.receivedPacketsCount}`}
              </Typography>
            </Box>
          )}
          
          {/* Cable test results - handle special structure */}
          {action === 'cable-test' && safeResult && (
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
                Cable Test Results
                {safeResult.port && ` for Port ${safeResult.port}`}
              </Typography>
              <Typography variant="body2" component="pre" sx={{ fontSize: '0.875rem', whiteSpace: 'pre-wrap', fontFamily: 'monospace', bgcolor: 'background.paper', p: 1, borderRadius: 1, maxHeight: 400, overflow: 'auto' }}>
                {safeResult.cableLengthMeters !== undefined && `Cable Length: ${safeResult.cableLengthMeters} meters\n`}
                {safeResult.cableLengthFeet !== undefined && `Cable Length: ${safeResult.cableLengthFeet} feet\n`}
                {safeResult.pairStatus && `Pair Status: ${JSON.stringify(safeResult.pairStatus, null, 2)}\n`}
                {safeResult.cableType && `Cable Type: ${safeResult.cableType}\n`}
                {safeResult.wireMap && `Wire Map: ${JSON.stringify(safeResult.wireMap, null, 2)}\n`}
                {safeResult.pairCount !== undefined && `Pair Count: ${safeResult.pairCount}\n`}
                {safeResult.testStatus && `Test Status: ${safeResult.testStatus}\n`}
                {safeResult.errorMessage && `Error: ${safeResult.errorMessage}\n`}
                {(!safeResult.cableLengthMeters && !safeResult.cableLengthFeet && !safeResult.pairStatus && !safeResult.wireMap && !safeResult.testStatus) && JSON.stringify(safeResult, null, 2)}
              </Typography>
            </Box>
          )}
          
          {/* Standard output field - show if not ping, cable-test, or port-bounce with special display */}
          {!((action === 'ping' && safeResult.replies) || (action === 'cable-test') || (action === 'port-bounce')) && safeResult.output !== undefined && safeResult.output !== null && (
            <Typography 
              variant="body2" 
              component="pre" 
              sx={{ fontSize: '0.875rem', whiteSpace: 'pre-wrap', fontFamily: 'monospace', maxHeight: 400, overflow: 'auto', bgcolor: 'background.paper', p: 1, borderRadius: 1 }}
            >
              {typeof safeResult.output === 'object' ? JSON.stringify(safeResult.output, null, 2) : String(safeResult.output)}
            </Typography>
          )}
          
          {/* Result field - show if not ping, cable-test, or port-bounce with special display */}
          {!((action === 'ping' && safeResult.replies) || (action === 'cable-test') || (action === 'port-bounce')) && !safeResult.output && safeResult.result !== undefined && safeResult.result !== null && (
            <Typography 
              variant="body2" 
              component="pre" 
              sx={{ fontSize: '0.875rem', whiteSpace: 'pre-wrap', fontFamily: 'monospace', maxHeight: 400, overflow: 'auto', bgcolor: 'background.paper', p: 1, borderRadius: 1 }}
            >
              {typeof safeResult.result === 'object' ? JSON.stringify(safeResult.result, null, 2) : String(safeResult.result)}
            </Typography>
          )}
          
          {/* Error field */}
          {!safeResult.output && !safeResult.result && safeResult.error && (
            <Typography variant="body2" sx={{ color: 'error.main' }}>
              {String(safeResult.error)}
            </Typography>
          )}
          
          {/* Fallback: show full JSON if no specific fields found */}
          {!safeResult.output && !safeResult.result && !safeResult.error && !(action === 'ping' && safeResult.replies) && !(action === 'cable-test') && !(action === 'port-bounce') && (
            <Typography 
              variant="body2" 
              component="pre" 
              sx={{ fontSize: '0.875rem', whiteSpace: 'pre-wrap', maxHeight: 400, overflow: 'auto', bgcolor: 'background.paper', p: 1, borderRadius: 1 }}
            >
              {JSON.stringify(safeResult, null, 2)}
            </Typography>
          )}
        </Alert>
      )}
      {result && !safeResult && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          <Typography variant="body2">Received unexpected result format: {typeof result === 'object' ? JSON.stringify(result).substring(0, 100) : String(result)}</Typography>
        </Alert>
      )}

      {action !== 'reboot' && action !== 'locate' && (
        <Button
          type="submit"
          variant="contained"
          disabled={loading}
          fullWidth
          sx={{ mt: 2 }}
        >
          {loading ? <CircularProgress size={24} /> : 'Execute'}
        </Button>
      )}
    </Box>
  );
}

export default DeviceDetailPage;
