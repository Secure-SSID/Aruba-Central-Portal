/**
 * Troubleshooting Page Component - Enhanced with Show Commands
 * Tools for diagnosing network issues and viewing device configurations
 */

import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
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
  Divider,
  IconButton,
  Tooltip,
  Collapse,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
} from '@mui/material';
import {
  NetworkCheck as NetworkCheckIcon,
  BugReport as BugReportIcon,
  PhonelinkRing as PhonelinkRingIcon,
  Code as CodeIcon,
  Download as DownloadIcon,
  ContentCopy as ContentCopyIcon,
  ExpandMore as ExpandMoreIcon,
  ExpandLess as ExpandLessIcon,
  Router as RouterIcon,
  PowerSettingsNew as PowerIcon,
  Cable as CableIcon,
  Http as HttpIcon,
  Security as SecurityIcon,
  LocationOn as LocationIcon,
  RestartAlt as RestartIcon,
  Route as RouteIcon,
  Update as UpdateIcon,
  HealthAndSafety as HealthAndSafetyIcon,
  Build as BuildIcon,
} from '@mui/icons-material';
import { troubleshootAPI, deviceAPI, showCommandsAPI } from '../services/api';
import DeviceSelector from '../components/DeviceSelector';
import { getErrorMessage } from '../utils/errorUtils';

function TroubleshootPage() {
  const [searchParams] = useSearchParams();
  const deviceFromUrl = searchParams.get('device');

  const [loading, setLoading] = useState({});
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [success, setSuccess] = useState('');
  const [expandedCard, setExpandedCard] = useState(null);

  // Device lists
  const [switches, setSwitches] = useState([]);
  const [accessPoints, setAccessPoints] = useState([]);
  const [devicesLoading, setDevicesLoading] = useState(true);

  // Ping test state
  const [deviceSerial, setDeviceSerial] = useState(deviceFromUrl || '');
  const [pingTarget, setPingTarget] = useState('');

  // Client session state
  const [clientMac, setClientMac] = useState('');

  // AP diagnostics state
  const [apSerial, setApSerial] = useState(deviceFromUrl || '');

  // Show commands state
  const [showCmdSerial, setShowCmdSerial] = useState(deviceFromUrl || '');

  // CX Switch troubleshooting state
  const [cxSerial, setCxSerial] = useState(deviceFromUrl || '');
  const [cxTracerouteTarget, setCxTracerouteTarget] = useState('');
  const [cxPoePort, setCxPoePort] = useState('');
  const [cxPortBouncePort, setCxPortBouncePort] = useState('');
  const [cxCableTestPort, setCxCableTestPort] = useState('');
  const [cxHttpUrl, setCxHttpUrl] = useState('');
  const [cxAaaUsername, setCxAaaUsername] = useState('');
  const [cxAaaPassword, setCxAaaPassword] = useState('');
  const [cxShowCommand, setCxShowCommand] = useState('');
  const [cxLocateEnable, setCxLocateEnable] = useState(true);

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

  const setLoadingState = (key, value) => {
    setLoading(prev => ({ ...prev, [key]: value }));
  };

  const handlePingTest = async () => {
    if (!deviceSerial || !pingTarget) {
      setError('Please enter both device serial and target');
      return;
    }

    setLoadingState('ping', true);
    setError('');
    setResult(null);

    try {
      const response = await troubleshootAPI.ping(deviceSerial, pingTarget);
      setResult({ type: 'ping', data: response });
    } catch (err) {
      setError(getErrorMessage(err, 'Ping test failed'));
    } finally {
      setLoadingState('ping', false);
    }
  };

  const handleGetClientSession = async () => {
    if (!clientMac) {
      setError('Please enter client MAC address');
      return;
    }

    setLoadingState('client', true);
    setError('');
    setResult(null);

    try {
      const response = await troubleshootAPI.getClientSession(clientMac);
      setResult({ type: 'client', data: response });
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to fetch client session'));
    } finally {
      setLoadingState('client', false);
    }
  };

  const handleGetAPDiagnostics = async () => {
    if (!apSerial) {
      setError('Please enter AP serial');
      return;
    }

    setLoadingState('ap', true);
    setError('');
    setResult(null);

    try {
      const response = await troubleshootAPI.getAPDiagnostics(apSerial);
      setResult({ type: 'ap', data: response });
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to fetch AP diagnostics'));
    } finally {
      setLoadingState('ap', false);
    }
  };

  // Show Commands Handlers
  const handleShowTechSupport = async () => {
    if (!showCmdSerial) {
      setError('Please enter device serial');
      setExpandedCard('techSupport');
      return;
    }

    setLoadingState('techSupport', true);
    setError('');
    setResult(null);

    try {
      const response = await showCommandsAPI.getTechSupport(showCmdSerial);
      
      // Check for error in response
      if (response.error) {
        setError(response.error || 'Failed to fetch tech-support. This endpoint may not be supported for this device type.');
        return;
      }
      
      // Check if items array is empty
      if (response.items && Array.isArray(response.items) && response.items.length === 0) {
        if (response.error) {
          setError(response.error);
        } else {
          setError('Tech support data not available. This device may not support this command.');
        }
        return;
      }
      
      setResult({ type: 'techSupport', data: response });
    } catch (err) {
      const errorMsg = getErrorMessage(err, 'Failed to fetch tech-support');
      if (err.response?.status === 404) {
        setError('Tech support endpoint not found. This device type may not support this command.');
      } else {
        setError(errorMsg);
      }
    } finally {
      setLoadingState('techSupport', false);
    }
  };

  const handleExportConfig = async () => {
    if (!showCmdSerial) {
      setError('Please enter device serial');
      return;
    }

    setLoadingState('export', true);
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
      setError(getErrorMessage(err, 'Failed to export config'));
    } finally {
      setLoadingState('export', false);
    }
  };

  // CX Switch Troubleshooting Handlers
  const handleCxTraceroute = async () => {
    if (!cxSerial || !cxTracerouteTarget) {
      setError('Please enter CX switch serial and target');
      return;
    }

    setLoadingState('cxTraceroute', true);
    setError('');
    setResult(null);

    try {
      const response = await troubleshootAPI.cxTraceroute(cxSerial, cxTracerouteTarget);
      setResult({ type: 'cxTraceroute', data: response });
    } catch (err) {
      setError(getErrorMessage(err, 'CX Traceroute test failed'));
    } finally {
      setLoadingState('cxTraceroute', false);
    }
  };

  const handleCxPoeBounce = async () => {
    if (!cxSerial || !cxPoePort) {
      setError('Please enter CX switch serial and port');
      return;
    }

    setLoadingState('cxPoeBounce', true);
    setError('');
    setResult(null);

    try {
      const response = await troubleshootAPI.cxPoeBounce(cxSerial, cxPoePort);
      setResult({ type: 'cxPoeBounce', data: response });
      setSuccess('PoE bounce initiated successfully');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(getErrorMessage(err, 'CX PoE bounce failed'));
    } finally {
      setLoadingState('cxPoeBounce', false);
    }
  };

  const handleCxPortBounce = async () => {
    if (!cxSerial || !cxPortBouncePort) {
      setError('Please enter CX switch serial and port');
      return;
    }

    setLoadingState('cxPortBounce', true);
    setError('');
    setResult(null);

    try {
      const response = await troubleshootAPI.cxPortBounce(cxSerial, cxPortBouncePort);
      setResult({ type: 'cxPortBounce', data: response });
      setSuccess('Port bounce initiated successfully');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(getErrorMessage(err, 'CX Port bounce failed'));
    } finally {
      setLoadingState('cxPortBounce', false);
    }
  };

  const handleCxCableTest = async () => {
    if (!cxSerial || !cxCableTestPort) {
      setError('Please enter CX switch serial and port');
      return;
    }

    setLoadingState('cxCableTest', true);
    setError('');
    setResult(null);

    try {
      const response = await troubleshootAPI.cxCableTest(cxSerial, cxCableTestPort);
      setResult({ type: 'cxCableTest', data: response });
    } catch (err) {
      setError(getErrorMessage(err, 'CX Cable test failed'));
    } finally {
      setLoadingState('cxCableTest', false);
    }
  };

  const handleCxHttpTest = async () => {
    if (!cxSerial || !cxHttpUrl) {
      setError('Please enter CX switch serial and URL');
      return;
    }

    setLoadingState('cxHttpTest', true);
    setError('');
    setResult(null);

    try {
      const response = await troubleshootAPI.cxHttpTest(cxSerial, cxHttpUrl);
      setResult({ type: 'cxHttpTest', data: response });
    } catch (err) {
      setError(getErrorMessage(err, 'CX HTTP test failed'));
    } finally {
      setLoadingState('cxHttpTest', false);
    }
  };

  const handleCxAaaTest = async () => {
    if (!cxSerial || !cxAaaUsername || !cxAaaPassword) {
      setError('Please enter CX switch serial, username, and password');
      return;
    }

    setLoadingState('cxAaaTest', true);
    setError('');
    setResult(null);

    try {
      const response = await troubleshootAPI.cxAaaTest(cxSerial, cxAaaUsername, cxAaaPassword);
      setResult({ type: 'cxAaaTest', data: response });
    } catch (err) {
      setError(getErrorMessage(err, 'CX AAA test failed'));
    } finally {
      setLoadingState('cxAaaTest', false);
    }
  };

  const handleCxListShowCommands = async () => {
    if (!cxSerial) {
      setError('Please enter CX switch serial');
      return;
    }

    setLoadingState('cxListShowCommands', true);
    setError('');
    setResult(null);

    try {
      const response = await troubleshootAPI.cxListShowCommands(cxSerial);
      setResult({ type: 'cxShowCommands', data: response });
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to list CX show commands'));
    } finally {
      setLoadingState('cxListShowCommands', false);
    }
  };

  const handleCxRunShowCommand = async () => {
    if (!cxSerial || !cxShowCommand) {
      setError('Please enter CX switch serial and command');
      return;
    }

    setLoadingState('cxRunShowCommand', true);
    setError('');
    setResult(null);

    try {
      const response = await troubleshootAPI.cxRunShowCommand(cxSerial, cxShowCommand);
      setResult({ type: 'cxShowCommand', data: response });
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to run CX show command'));
    } finally {
      setLoadingState('cxRunShowCommand', false);
    }
  };

  const handleCxLocate = async (enable) => {
    if (!cxSerial) {
      setError('Please enter CX switch serial');
      return;
    }

    setLoadingState('cxLocate', true);
    setError('');
    setResult(null);

    try {
      const response = await troubleshootAPI.cxLocate(cxSerial, enable !== undefined ? enable : cxLocateEnable);
      setResult({ type: 'cxLocate', data: response });
      setSuccess(`Switch locate ${enable !== undefined ? enable : cxLocateEnable ? 'enabled' : 'disabled'} successfully`);
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(getErrorMessage(err, 'CX Locate failed'));
    } finally {
      setLoadingState('cxLocate', false);
    }
  };

  const handleCxReboot = async () => {
    if (!cxSerial) {
      setError('Please enter CX switch serial');
      return;
    }

    if (!window.confirm('Are you sure you want to reboot this switch? This will cause a network interruption.')) {
      return;
    }

    setLoadingState('cxReboot', true);
    setError('');
    setResult(null);

    try {
      const response = await troubleshootAPI.cxReboot(cxSerial);
      setResult({ type: 'cxReboot', data: response });
      setSuccess('Switch reboot initiated successfully');
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      setError(getErrorMessage(err, 'CX Reboot failed'));
    } finally {
      setLoadingState('cxReboot', false);
    }
  };

  const toggleCard = (cardId) => {
    setExpandedCard(expandedCard === cardId ? null : cardId);
  };

  const formatPingResults = (pingData) => {
    // Extract data from response
    const destination = pingData.destination || pingTarget || 'unknown';
    const replies = pingData.replies || [];
    const transmitted = pingData.transmittedPacketsCount || pingData.transmitted || replies.length;
    const received = pingData.receivedPacketsCount || pingData.received || replies.length;
    const packetLoss = pingData.packetLossPercent || (transmitted > 0 ? ((transmitted - received) / transmitted * 100).toFixed(1) : '0.0');
    
    let output = `PING ${destination} (${destination}): 56 data bytes\n\n`;
    
    // Format each reply in traditional ping format
    replies.forEach((reply, idx) => {
      const seq = reply.sequenceNumber !== undefined ? reply.sequenceNumber : idx;
      const time = reply.roundTripTimeMilliseconds !== undefined ? reply.roundTripTimeMilliseconds.toFixed(3) : 'N/A';
      const ttl = reply.ttl !== undefined ? reply.ttl : 111; // Default TTL if not provided
      const sourceIP = reply.sourceIP || destination;
      
      output += `64 bytes from ${sourceIP}: icmp_seq=${seq} ttl=${ttl} time=${time} ms\n`;
    });
    
    // Add statistics
    output += `\n--- ${destination} ping statistics ---\n`;
    output += `${transmitted} packets transmitted, ${received} packets received, ${packetLoss}% packet loss`;
    
    // Add average/min/max if available
    if (pingData.averageRoundTripTimeMilliseconds !== undefined) {
      output += `\nround-trip min/avg/max = `;
      const times = replies
        .map(r => r.roundTripTimeMilliseconds)
        .filter(t => t !== undefined);
      
      if (times.length > 0) {
        const min = Math.min(...times).toFixed(3);
        const avg = pingData.averageRoundTripTimeMilliseconds.toFixed(3);
        const max = Math.max(...times).toFixed(3);
        output += `${min}/${avg}/${max} ms`;
      }
    }
    
    return output;
  };

  const copyToClipboard = () => {
    if (!result) return;
    const data = result.data || result;
    const resultType = result.type || 'unknown';
    
    let text;
    if (resultType === 'ping' && typeof data === 'object' && data !== null) {
      // Format ping results for clipboard
      if (data.replies && Array.isArray(data.replies) && data.replies.length > 0) {
        text = formatPingResults(data);
      } else if (data.output && typeof data.output === 'object' && data.output !== null) {
        // Format nested output object
        const output = data.output;
        const destination = output.destination || pingTarget || 'unknown';
        const transmitted = output.transmittedPacketsCount || output.transmitted || 0;
        const received = output.receivedPacketsCount || output.received || 0;
        const packetLoss = output.packetLossPercent || (transmitted > 0 ? ((transmitted - received) / transmitted * 100).toFixed(1) : '0.0');
        const avgRtt = output.averageRoundTripTimeMilliseconds || output.averageRoundTripTime || null;
        const minRtt = output.minimumRoundTripTimeMilliseconds || output.minimumRoundTripTime || null;
        const maxRtt = output.maximumRoundTripTimeMilliseconds || output.maximumRoundTripTime || null;
        const replies = output.replies || [];
        
        text = `PING ${destination} (${destination}): 56 data bytes\n\n`;
        
        if (replies && Array.isArray(replies) && replies.length > 0) {
          replies.forEach((reply, idx) => {
            const seq = reply.sequenceNumber !== undefined ? reply.sequenceNumber : idx;
            const time = reply.roundTripTimeMilliseconds !== undefined 
              ? parseFloat(reply.roundTripTimeMilliseconds).toFixed(3) 
              : 'N/A';
            const ttl = reply.ttl !== undefined ? reply.ttl : 111;
            const sourceIP = reply.sourceIP || destination;
            text += `64 bytes from ${sourceIP}: icmp_seq=${seq} ttl=${ttl} time=${time} ms\n`;
          });
        }
        
        text += `\n--- ${destination} ping statistics ---\n`;
        text += `${transmitted} packets transmitted, ${received} packets received, ${packetLoss}% packet loss`;
        
        if (minRtt !== null && avgRtt !== null && maxRtt !== null) {
          const min = typeof minRtt === 'string' ? parseFloat(minRtt).toFixed(3) : minRtt.toFixed(3);
          const avg = typeof avgRtt === 'string' ? parseFloat(avgRtt).toFixed(3) : avgRtt.toFixed(3);
          const max = typeof maxRtt === 'string' ? parseFloat(maxRtt).toFixed(3) : maxRtt.toFixed(3);
          text += `\nround-trip min/avg/max = ${min}/${avg}/${max} ms`;
        } else if (avgRtt !== null) {
          const avg = typeof avgRtt === 'string' ? parseFloat(avgRtt).toFixed(3) : avgRtt.toFixed(3);
          text += `\naverage round-trip time = ${avg} ms`;
        }
        
        if (data.failReason) {
          text += `\n\nError: ${data.failReason}`;
        }
        if (data.endTime) {
          const endTime = new Date(data.endTime).toLocaleString();
          text += `\nCompleted at: ${endTime}`;
        }
      } else if (data.output && typeof data.output === 'string') {
        text = data.output;
      } else {
        text = JSON.stringify(data, null, 2);
      }
    } else if (typeof data === 'string') {
      text = data;
    } else if (data.configuration && typeof data.configuration === 'string') {
      text = data.configuration;
    } else {
      text = JSON.stringify(data, null, 2);
    }
    
    navigator.clipboard.writeText(text);
    setSuccess('Copied to clipboard!');
    setTimeout(() => setSuccess(''), 2000);
  };

  const renderResult = () => {
    if (!result) return null;
    const data = result.data || result;
    const resultType = result.type || 'unknown';
    
    // Handle ping results with special formatting
    if (resultType === 'ping' && typeof data === 'object' && data !== null) {
      // Check if we have replies array or output field
      if (data.replies && Array.isArray(data.replies) && data.replies.length > 0) {
        const formattedOutput = formatPingResults(data);
        return (
          <Box>
            <Chip label="Ping Results" size="small" sx={{ mb: 1 }} />
            <Paper 
              variant="outlined" 
              sx={{ 
                p: 2, 
                bgcolor: 'background.paper',
                fontFamily: 'monospace',
                fontSize: '0.875rem',
                lineHeight: 1.6,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                maxHeight: 500,
                overflow: 'auto',
                color: 'text.primary',
              }}
            >
              {formattedOutput}
            </Paper>
          </Box>
        );
      }
      
      // Handle output object structure (nested output object with ping stats)
      if (data.output && typeof data.output === 'object' && data.output !== null) {
        const output = data.output;
        const destination = output.destination || pingTarget || 'unknown';
        const transmitted = output.transmittedPacketsCount || output.transmitted || 0;
        const received = output.receivedPacketsCount || output.received || 0;
        const packetLoss = output.packetLossPercent || (transmitted > 0 ? ((transmitted - received) / transmitted * 100).toFixed(1) : '0.0');
        const avgRtt = output.averageRoundTripTimeMilliseconds || output.averageRoundTripTime || null;
        const minRtt = output.minimumRoundTripTimeMilliseconds || output.minimumRoundTripTime || null;
        const maxRtt = output.maximumRoundTripTimeMilliseconds || output.maximumRoundTripTime || null;
        const replies = output.replies || [];
        
        // Format ping output
        let formattedOutput = `PING ${destination} (${destination}): 56 data bytes\n\n`;
        
        // Add individual replies if available
        if (replies && Array.isArray(replies) && replies.length > 0) {
          replies.forEach((reply, idx) => {
            const seq = reply.sequenceNumber !== undefined ? reply.sequenceNumber : idx;
            const time = reply.roundTripTimeMilliseconds !== undefined 
              ? parseFloat(reply.roundTripTimeMilliseconds).toFixed(3) 
              : 'N/A';
            const ttl = reply.ttl !== undefined ? reply.ttl : 111;
            const sourceIP = reply.sourceIP || destination;
            formattedOutput += `64 bytes from ${sourceIP}: icmp_seq=${seq} ttl=${ttl} time=${time} ms\n`;
          });
        }
        
        // Add statistics
        formattedOutput += `\n--- ${destination} ping statistics ---\n`;
        formattedOutput += `${transmitted} packets transmitted, ${received} packets received, ${packetLoss}% packet loss`;
        
        // Add round-trip times if available
        if (minRtt !== null && avgRtt !== null && maxRtt !== null) {
          const min = typeof minRtt === 'string' ? parseFloat(minRtt).toFixed(3) : minRtt.toFixed(3);
          const avg = typeof avgRtt === 'string' ? parseFloat(avgRtt).toFixed(3) : avgRtt.toFixed(3);
          const max = typeof maxRtt === 'string' ? parseFloat(maxRtt).toFixed(3) : maxRtt.toFixed(3);
          formattedOutput += `\nround-trip min/avg/max = ${min}/${avg}/${max} ms`;
        } else if (avgRtt !== null) {
          const avg = typeof avgRtt === 'string' ? parseFloat(avgRtt).toFixed(3) : avgRtt.toFixed(3);
          formattedOutput += `\naverage round-trip time = ${avg} ms`;
        }
        
        // Add status information if available
        if (data.failReason) {
          formattedOutput += `\n\nError: ${data.failReason}`;
        }
        if (data.endTime) {
          const endTime = new Date(data.endTime).toLocaleString();
          formattedOutput += `\nCompleted at: ${endTime}`;
        }
        
        return (
          <Box>
            <Chip label="Ping Results" size="small" sx={{ mb: 2 }} color="primary" />
            <Paper 
              variant="outlined" 
              sx={{ 
                p: 2, 
                bgcolor: 'background.paper',
                fontFamily: 'monospace',
                fontSize: '0.875rem',
                lineHeight: 1.6,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                maxHeight: 500,
                overflow: 'auto',
                color: 'text.primary',
              }}
            >
              {formattedOutput}
            </Paper>
          </Box>
        );
      }
      
      // If there's an output field as string, check if it's already formatted
      if (data.output && typeof data.output === 'string') {
        // Check if it looks like ping output already
        if (data.output.includes('PING') || data.output.includes('ping statistics')) {
          return (
            <Box>
              <Chip label="Ping Results" size="small" sx={{ mb: 1 }} />
              <Paper 
                variant="outlined" 
                sx={{ 
                  p: 2, 
                  bgcolor: 'background.paper',
                  fontFamily: 'monospace',
                  fontSize: '0.875rem',
                  lineHeight: 1.6,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                  maxHeight: 500,
                  overflow: 'auto',
                  color: 'text.primary',
                }}
              >
                {data.output}
              </Paper>
            </Box>
          );
        }
      }
    }
    
    // Handle AP diagnostics with special formatting
    if (resultType === 'ap' && typeof data === 'object' && data !== null) {
      // Helper function to normalize field names (handle both camelCase and snake_case)
      const normalizeFieldName = (fieldName) => {
        // Convert snake_case to camelCase for comparison
        return fieldName.replace(/_([a-z])/g, (match, letter) => letter.toUpperCase());
      };

      // Helper to find field in data (check both original and normalized names)
      const findField = (data, fieldName) => {
        if (data.hasOwnProperty(fieldName)) return fieldName;
        const normalized = normalizeFieldName(fieldName);
        if (data.hasOwnProperty(normalized)) return normalized;
        // Check snake_case version
        const snakeCase = fieldName.replace(/([A-Z])/g, '_$1').toLowerCase();
        if (data.hasOwnProperty(snakeCase)) return snakeCase;
        return null;
      };

      // Helper to get value from data (check multiple field name variations)
      const getFieldValue = (data, fieldName) => {
        const actualKey = findField(data, fieldName);
        if (actualKey) {
          return data[actualKey];
        }
        return undefined;
      };

      const formatValue = (value) => {
        if (value === null || value === undefined) return 'N/A';
        if (typeof value === 'boolean') return value ? 'Yes' : 'No';
        if (Array.isArray(value)) {
          if (value.length === 0) return 'None';
          return value.map((v, i) => typeof v === 'object' ? JSON.stringify(v, null, 2) : String(v)).join(', ');
        }
        if (typeof value === 'object') {
          // For nested objects, try to format nicely
          const keys = Object.keys(value);
          if (keys.length <= 3) {
            return keys.map(k => `${k}: ${value[k]}`).join(', ');
          }
          return JSON.stringify(value, null, 2);
        }
        return String(value);
      };

      const formatLabel = (key) => {
        return key
          .replace(/_/g, ' ')
          .replace(/([A-Z])/g, ' $1')
          .replace(/^./, str => str.toUpperCase())
          .trim();
      };

      // Extract actual data - handle nested structures
      let actualData = data;
      if (data.items && Array.isArray(data.items) && data.items.length > 0) {
        actualData = data.items[0]; // Use first item if it's an array
      } else if (data.result && typeof data.result === 'object') {
        actualData = data.result;
      } else if (data.data && typeof data.data === 'object') {
        actualData = data.data;
      }

      // Get all available keys from actual data
      const allKeys = Object.keys(actualData).filter(key => 
        actualData[key] !== null && 
        actualData[key] !== undefined &&
        key !== 'items' && 
        key !== 'result' && 
        key !== 'data'
      );

      // Group fields into logical sections with flexible field name matching
      const deviceInfo = {
        'Device Information': [
          'id', 'deviceName', 'device_name', 'model', 'serialNumber', 'serial_number',
          'serial', 'firmwareVersion', 'firmware_version', 'firmware', 'version',
          'deployment', 'status', 'state', 'uptime', 'lastSeen', 'last_seen'
        ],
        'Network Configuration': [
          'ipv4', 'ipv6', 'ip', 'ipAddress', 'ip_address', 'defaultGateway', 'default_gateway',
          'gateway', 'subnetMask', 'subnet_mask', 'subnet', 'dnsServers', 'dns_servers', 'dns',
          'vlan', 'vlanId', 'vlan_id', 'countryCode', 'country_code', 'country',
          'bandSelection', 'band_selection'
        ],
        'Location & Site': [
          'siteId', 'site_id', 'site', 'siteName', 'site_name', 'location',
          'latitude', 'lat', 'longitude', 'lng', 'lon', 'address',
          'floor', 'building'
        ],
        'Radio Information': [
          'radioCount', 'radio_count', 'radios', 'radioTypes', 'radio_types',
          'radioType', 'radio_type', 'channel', 'channels', 'powerLevel', 'power_level',
          'power', 'operatingMode', 'operating_mode', 'mode', 'antennaGain', 'antenna_gain'
        ],
        'Performance & Status': [
          'clientCount', 'client_count', 'clients', 'throughput', 'signalStrength',
          'signal_strength', 'signal', 'noiseLevel', 'noise_level', 'noise',
          'utilization', 'usage', 'interference', 'rssi', 'snr'
        ]
      };

      // Find which fields exist in the data with flexible matching
      const availableSections = {};
      Object.keys(deviceInfo).forEach(section => {
        const fields = [];
        deviceInfo[section].forEach(field => {
          const actualKey = findField(actualData, field);
          if (actualKey && actualData[actualKey] !== null && actualData[actualKey] !== undefined) {
            fields.push(actualKey); // Use the actual key name from data
          }
        });
        if (fields.length > 0) {
          availableSections[section] = fields;
        }
      });

      // Collect all categorized fields
      const categorizedFields = new Set(
        Object.values(availableSections).flat()
      );
      
      // Find remaining fields
      const remainingFields = allKeys.filter(key => !categorizedFields.has(key));

      // Always show formatted output (never fall through to JSON)
      return (
        <Box>
          <Chip label="AP Diagnostics" size="small" sx={{ mb: 1 }} color="primary" />
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, maxHeight: 600, overflow: 'auto' }}>
            {/* Show categorized sections */}
            {Object.entries(availableSections).map(([sectionName, fields]) => (
              <Paper key={sectionName} variant="outlined" sx={{ p: 1.5, bgcolor: 'background.paper' }}>
                <Typography 
                  variant="subtitle2" 
                  sx={{ 
                    fontWeight: 600, 
                    mb: 1, 
                    color: 'primary.main',
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                    pb: 0.5
                  }}
                >
                  {sectionName}
                </Typography>
                <Grid container spacing={1}>
                  {fields.map((key) => (
                    <Grid item xs={12} sm={6} key={key}>
                      <Box sx={{ mb: 1 }}>
                        <Typography 
                          variant="caption" 
                          sx={{ 
                            fontWeight: 500, 
                            color: 'text.secondary', 
                            display: 'block', 
                            mb: 0.5
                          }}
                        >
                          {formatLabel(key)}
                        </Typography>
                        <Typography 
                          variant="body2" 
                          sx={{ 
                            fontFamily: typeof actualData[key] === 'object' && !Array.isArray(actualData[key])
                              ? 'monospace' 
                              : 'inherit',
                            wordBreak: 'break-word',
                            color: 'text.primary',
                          }}
                        >
                          {formatValue(actualData[key])}
                        </Typography>
                      </Box>
                    </Grid>
                  ))}
                </Grid>
              </Paper>
            ))}
            
            {/* Show remaining fields that weren't categorized */}
            {remainingFields.length > 0 && (
              <Paper variant="outlined" sx={{ p: 1.5, bgcolor: 'background.paper' }}>
                <Typography 
                  variant="subtitle2" 
                  sx={{ 
                    fontWeight: 600, 
                    mb: 1, 
                    color: 'primary.main',
                    borderBottom: '1px solid',
                    borderColor: 'divider',
                    pb: 0.5
                  }}
                >
                  Additional Information
                </Typography>
                <Grid container spacing={1}>
                  {remainingFields.map((key) => (
                    <Grid item xs={12} sm={6} key={key}>
                      <Box sx={{ mb: 1 }}>
                        <Typography 
                          variant="caption" 
                          sx={{ 
                            fontWeight: 500, 
                            color: 'text.secondary', 
                            display: 'block', 
                            mb: 0.5
                          }}
                        >
                          {formatLabel(key)}
                        </Typography>
                        <Typography 
                          variant="body2" 
                          sx={{ 
                            fontFamily: typeof actualData[key] === 'object' && !Array.isArray(actualData[key])
                              ? 'monospace' 
                              : 'inherit',
                            wordBreak: 'break-word',
                            color: 'text.primary',
                          }}
                        >
                          {formatValue(actualData[key])}
                        </Typography>
                      </Box>
                    </Grid>
                  ))}
                </Grid>
              </Paper>
            )}
            
            {/* If no fields at all, show a message */}
            {allKeys.length === 0 && (
              <Alert severity="info">
                No diagnostic data available
              </Alert>
            )}
          </Box>
        </Box>
      );
    }
    
    // Handle string results (configuration text, plain text)
    if (typeof data === 'string') {
      return (
        <Box>
          <Chip label="Text Output" size="small" sx={{ mb: 1 }} />
          <Paper 
            variant="outlined" 
            sx={{ 
              p: 1.5, 
              bgcolor: 'background.paper',
              fontFamily: 'monospace',
              fontSize: '0.875rem',
              lineHeight: 1.6,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              maxHeight: 500,
              overflow: 'auto',
              color: 'text.primary',
            }}
          >
            {data}
          </Paper>
        </Box>
      );
    }
    
    // Handle configuration field (show run-config)
    if (data.configuration && typeof data.configuration === 'string') {
      return (
        <Box>
          <Chip label="Configuration" size="small" sx={{ mb: 1 }} />
          <Paper 
            variant="outlined" 
            sx={{ 
              p: 1.5, 
              bgcolor: 'background.paper',
              fontFamily: 'monospace',
              fontSize: '0.875rem',
              lineHeight: 1.6,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
              maxHeight: 500,
              overflow: 'auto',
              color: 'text.primary',
            }}
          >
            {data.configuration}
          </Paper>
        </Box>
      );
    }
    
    // Handle arrays (items, interfaces, etc.)
    if (Array.isArray(data)) {
      if (data.length === 0) {
        return (
          <Alert severity="info">
            No data available
          </Alert>
        );
      }
      
      // If array of objects, show as table
      if (data.length > 0 && typeof data[0] === 'object' && data[0] !== null) {
        const keys = Object.keys(data[0]);
        if (keys.length === 0) {
          return (
            <Alert severity="info">
              Array contains empty objects
            </Alert>
          );
        }
        return (
          <Box>
            <Chip label={`${data.length} items`} size="small" sx={{ mb: 1 }} />
            <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 500 }}>
              <Table size="small" stickyHeader>
                <TableHead>
                  <TableRow>
                    {keys.map((key) => (
                      <TableCell key={key} sx={{ fontWeight: 'bold', bgcolor: 'grey.100' }}>
                        {key}
                      </TableCell>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {data.map((item, idx) => (
                    <TableRow key={idx} hover>
                      {keys.map((key) => (
                        <TableCell key={key}>
                          {typeof item[key] === 'object' 
                            ? JSON.stringify(item[key], null, 2)
                            : String(item[key] ?? '')}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </Box>
        );
      }
      
      // Simple array
      return (
        <Box>
            <Chip label={`Array (${data.length} items)`} size="small" sx={{ mb: 1 }} />
          <Paper variant="outlined" sx={{ p: 1.5, bgcolor: 'background.paper', color: 'text.primary' }}>
            {data.map((item, idx) => (
              <Box key={idx} sx={{ mb: 1, fontFamily: 'monospace', fontSize: '0.875rem', color: 'text.primary' }}>
                [{idx}]: {String(item)}
              </Box>
            ))}
          </Paper>
        </Box>
      );
    }
    
    // Handle items array in object (but skip if it's AP diagnostics)
    if (data.items && Array.isArray(data.items) && resultType !== 'ap') {
      if (data.items.length === 0) {
        return (
          <Alert severity="info">
            No items available
          </Alert>
        );
      }
      
      const keys = Object.keys(data.items[0] || {});
      if (keys.length === 0) {
        return (
          <Alert severity="info">
            Items array contains empty objects
          </Alert>
        );
      }
      return (
        <Box>
          <Box sx={{ display: 'flex', gap: 1, mb: 1, alignItems: 'center' }}>
            <Chip label={`${data.items.length} items`} size="small" />
            {data.count && (
              <Chip label={`Total: ${data.count}`} size="small" variant="outlined" />
            )}
          </Box>
          <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 500 }}>
            <Table size="small" stickyHeader>
              <TableHead>
                <TableRow>
                  {keys.map((key) => (
                    <TableCell key={key} sx={{ fontWeight: 'bold', bgcolor: 'grey.100' }}>
                      {key}
                    </TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {data.items.map((item, idx) => (
                  <TableRow key={idx} hover>
                    {keys.map((key) => (
                      <TableCell key={key}>
                        {typeof item[key] === 'object' 
                          ? JSON.stringify(item[key], null, 2)
                          : String(item[key] ?? '')}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </Box>
      );
    }
    
    // Handle null or undefined
    if (data === null || data === undefined) {
      return (
        <Alert severity="info">
          No data returned
        </Alert>
      );
    }
    
    // Handle objects - format as key-value pairs or JSON (but skip if already handled)
    if (typeof data === 'object' && data !== null && resultType !== 'ap') {
      const keys = Object.keys(data);
      
      // Empty object
      if (keys.length === 0) {
        return (
          <Alert severity="info">
            Empty result
          </Alert>
        );
      }
      
      // If it's a simple object with few keys, show as key-value pairs
      if (keys.length <= 10 && !keys.some(k => typeof data[k] === 'object' && data[k] !== null && !Array.isArray(data[k]))) {
        return (
          <Box>
            <Chip label="Object Data" size="small" sx={{ mb: 1 }} />
            <Paper variant="outlined" sx={{ p: 1.5, bgcolor: 'background.paper', color: 'text.primary' }}>
              {keys.map((key) => (
                <Box key={key} sx={{ mb: 1, pb: 1, borderBottom: '1px solid', borderColor: 'divider' }}>
                  <Typography variant="caption" sx={{ fontWeight: 'bold', color: 'text.secondary', display: 'block', mb: 0.5 }}>
                    {key}
                  </Typography>
                  <Typography 
                    variant="body2" 
                    sx={{ 
                      fontFamily: typeof data[key] === 'string' ? 'monospace' : 'inherit',
                      wordBreak: 'break-word',
                      color: 'text.primary',
                    }}
                  >
                    {typeof data[key] === 'object' 
                      ? JSON.stringify(data[key], null, 2)
                      : String(data[key] ?? 'N/A')}
                  </Typography>
                </Box>
              ))}
            </Paper>
          </Box>
        );
      }
      
      // Complex object - show as formatted JSON
      return (
        <Box>
          <Chip label="JSON Data" size="small" sx={{ mb: 1 }} />
          <Paper 
            variant="outlined" 
            sx={{ 
              p: 1.5, 
              bgcolor: 'background.paper',
              fontFamily: 'monospace',
              fontSize: '0.875rem',
              lineHeight: 1.8,
              maxHeight: 500,
              overflow: 'auto',
              color: 'text.primary',
            }}
          >
            <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', color: 'inherit' }}>
              {JSON.stringify(data, null, 2)}
            </pre>
          </Paper>
        </Box>
      );
    }
    
    // Fallback
    return (
      <Box>
        <Paper variant="outlined" sx={{ p: 1.5, bgcolor: 'background.paper', fontFamily: 'monospace', color: 'text.primary' }}>
          {String(data)}
        </Paper>
      </Box>
    );
  };

  return (
    <Box>
      <Box sx={{ mb: 2 }}>
        <Typography variant="h4" sx={{ fontWeight: 700, mb: 0.5 }}>
          Network Troubleshooting
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Diagnostic tools for troubleshooting network connectivity and viewing device configurations
        </Typography>
      </Box>

      <Grid container spacing={2}>
        {/* Left Column - Troubleshooting Tools */}
        <Grid item xs={12} md={8}>
          <Grid container spacing={2}>
            {/* Ping Test Card */}
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <NetworkCheckIcon color="primary" />
                      <Typography variant="h6">Ping Test</Typography>
                    </Box>
                    <IconButton size="small" onClick={() => toggleCard('ping')}>
                      {expandedCard === 'ping' ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                    </IconButton>
                  </Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    Test network connectivity by running ping from a device
                  </Typography>
                  <Collapse in={expandedCard === 'ping'}>
                    <Box>
                      <DeviceSelector
                        value={deviceSerial}
                        onChange={setDeviceSerial}
                        required={true}
                        label="Device"
                        helperText="Select a device"
                        disabled={devicesLoading}
                        sx={{ mb: 1 }}
                      />
                      <TextField
                        fullWidth
                        label="Target IP or Hostname"
                        value={pingTarget}
                        onChange={(e) => setPingTarget(e.target.value)}
                        sx={{ mb: 1 }}
                        placeholder="e.g., 8.8.8.8 or google.com"
                      />
                      <Button
                        variant="contained"
                        fullWidth
                        onClick={handlePingTest}
                        disabled={loading.ping}
                        startIcon={loading.ping ? <CircularProgress size={20} /> : <NetworkCheckIcon />}
                      >
                        {loading.ping ? 'Running...' : 'Run Ping Test'}
                      </Button>
                    </Box>
                  </Collapse>
                </CardContent>
              </Card>
            </Grid>

            {/* Client Session Card */}
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <PhonelinkRingIcon color="primary" />
                      <Typography variant="h6">Client Session</Typography>
                    </Box>
                    <IconButton size="small" onClick={() => toggleCard('client')}>
                      {expandedCard === 'client' ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                    </IconButton>
                  </Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    View detailed session information for a connected client
                  </Typography>
                  <Collapse in={expandedCard === 'client'}>
                    <Box>
                      <TextField
                        fullWidth
                        label="Client MAC Address"
                        value={clientMac}
                        onChange={(e) => setClientMac(e.target.value)}
                        sx={{ mb: 1 }}
                        placeholder="e.g., aa:bb:cc:dd:ee:ff"
                      />
                      <Button
                        variant="contained"
                        fullWidth
                        onClick={handleGetClientSession}
                        disabled={loading.client}
                        startIcon={loading.client ? <CircularProgress size={20} /> : <PhonelinkRingIcon />}
                      >
                        {loading.client ? 'Fetching...' : 'Get Client Session'}
                      </Button>
                    </Box>
                  </Collapse>
                </CardContent>
              </Card>
            </Grid>

            {/* AP Diagnostics Card */}
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <BugReportIcon color="primary" />
                      <Typography variant="h6">AP Diagnostics</Typography>
                    </Box>
                    <IconButton size="small" onClick={() => toggleCard('ap')}>
                      {expandedCard === 'ap' ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                    </IconButton>
                  </Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    Get detailed diagnostic information for an Access Point
                  </Typography>
                  <Collapse in={expandedCard === 'ap'}>
                    <Box>
                      <DeviceSelector
                        value={apSerial}
                        onChange={setApSerial}
                        required={true}
                        label="Access Point"
                        deviceType="AP"
                        helperText="Select an access point"
                        disabled={devicesLoading}
                        sx={{ mb: 1 }}
                      />
                      <Button
                        variant="contained"
                        fullWidth
                        onClick={handleGetAPDiagnostics}
                        disabled={loading.ap}
                        startIcon={loading.ap ? <CircularProgress size={20} /> : <BugReportIcon />}
                      >
                        {loading.ap ? 'Fetching...' : 'Get AP Diagnostics'}
                      </Button>
                    </Box>
                  </Collapse>
                </CardContent>
              </Card>
            </Grid>

            {/* Tech Support Card */}
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <BugReportIcon color="primary" />
                      <Typography variant="h6">Tech Support</Typography>
                    </Box>
                    <IconButton size="small" onClick={() => toggleCard('techSupport')}>
                      {expandedCard === 'techSupport' ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                    </IconButton>
                  </Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    Get technical support information from a device
                  </Typography>
                  <Collapse in={expandedCard === 'techSupport'}>
                    <Box>
                      <DeviceSelector
                        value={showCmdSerial}
                        onChange={setShowCmdSerial}
                        required={true}
                        label="Device"
                        helperText="Select a device"
                        disabled={devicesLoading}
                        sx={{ mb: 1 }}
                      />
                      <Button
                        variant="contained"
                        fullWidth
                        onClick={handleShowTechSupport}
                        disabled={loading.techSupport || !showCmdSerial}
                        startIcon={loading.techSupport ? <CircularProgress size={20} /> : <BugReportIcon />}
                      >
                        {loading.techSupport ? 'Loading...' : 'Get Tech Support'}
                      </Button>
                    </Box>
                  </Collapse>
                </CardContent>
              </Card>
            </Grid>

            {/* Export Configuration Card */}
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <DownloadIcon color="primary" />
                      <Typography variant="h6">Export Configuration</Typography>
                    </Box>
                    <IconButton size="small" onClick={() => toggleCard('export')}>
                      {expandedCard === 'export' ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                    </IconButton>
                  </Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    Export device configuration to a file
                  </Typography>
                  <Collapse in={expandedCard === 'export'}>
                    <Box>
                      <DeviceSelector
                        value={showCmdSerial}
                        onChange={setShowCmdSerial}
                        required={true}
                        label="Device"
                        helperText="Select a device"
                        disabled={devicesLoading}
                        sx={{ mb: 1 }}
                      />
                      <Button
                        variant="contained"
                        fullWidth
                        onClick={handleExportConfig}
                        disabled={loading.export || !showCmdSerial}
                        startIcon={loading.export ? <CircularProgress size={20} /> : <DownloadIcon />}
                      >
                        {loading.export ? 'Exporting...' : 'Export Configuration'}
                      </Button>
                    </Box>
                  </Collapse>
                </CardContent>
              </Card>
            </Grid>

            {/* CX Switch Troubleshooting Section */}
            <Grid item xs={12}>
              <Divider sx={{ my: 1 }}>
                <Chip label="CX Switch Troubleshooting" color="primary" />
              </Divider>
            </Grid>

            {/* CX Traceroute Card */}
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <RouteIcon color="primary" />
                      <Typography variant="h6">CX Traceroute</Typography>
                    </Box>
                    <IconButton size="small" onClick={() => toggleCard('cxTraceroute')}>
                      {expandedCard === 'cxTraceroute' ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                    </IconButton>
                  </Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    Trace the network path to a destination from a CX switch
                  </Typography>
                  <Collapse in={expandedCard === 'cxTraceroute'}>
                    <Box>
                      <DeviceSelector
                        value={cxSerial}
                        onChange={setCxSerial}
                        required={true}
                        label="CX Switch"
                        deviceType="Switch"
                        helperText="Select a CX switch"
                        disabled={devicesLoading}
                        sx={{ mb: 1 }}
                      />
                      <TextField
                        fullWidth
                        label="Target IP or Hostname"
                        value={cxTracerouteTarget}
                        onChange={(e) => setCxTracerouteTarget(e.target.value)}
                        sx={{ mb: 1 }}
                        placeholder="e.g., 8.8.8.8 or google.com"
                      />
                      <Button
                        variant="contained"
                        fullWidth
                        onClick={handleCxTraceroute}
                        disabled={loading.cxTraceroute}
                        startIcon={loading.cxTraceroute ? <CircularProgress size={20} /> : <RouteIcon />}
                      >
                        {loading.cxTraceroute ? 'Running...' : 'Run Traceroute'}
                      </Button>
                    </Box>
                  </Collapse>
                </CardContent>
              </Card>
            </Grid>

            {/* CX PoE Bounce Card */}
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <PowerIcon color="primary" />
                      <Typography variant="h6">CX PoE Bounce</Typography>
                    </Box>
                    <IconButton size="small" onClick={() => toggleCard('cxPoeBounce')}>
                      {expandedCard === 'cxPoeBounce' ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                    </IconButton>
                  </Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    Bounce PoE power on a port of a CX switch
                  </Typography>
                  <Collapse in={expandedCard === 'cxPoeBounce'}>
                    <Box>
                      <DeviceSelector
                        value={cxSerial}
                        onChange={setCxSerial}
                        required={true}
                        label="CX Switch"
                        deviceType="Switch"
                        helperText="Select a CX switch"
                        disabled={devicesLoading}
                        sx={{ mb: 1 }}
                      />
                      <TextField
                        fullWidth
                        label="Port"
                        value={cxPoePort}
                        onChange={(e) => setCxPoePort(e.target.value)}
                        sx={{ mb: 1 }}
                        placeholder="e.g., 1/1"
                      />
                      <Button
                        variant="contained"
                        fullWidth
                        onClick={handleCxPoeBounce}
                        disabled={loading.cxPoeBounce}
                        startIcon={loading.cxPoeBounce ? <CircularProgress size={20} /> : <PowerIcon />}
                      >
                        {loading.cxPoeBounce ? 'Running...' : 'Bounce PoE'}
                      </Button>
                    </Box>
                  </Collapse>
                </CardContent>
              </Card>
            </Grid>

            {/* CX Port Bounce Card */}
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <RouterIcon color="primary" />
                      <Typography variant="h6">CX Port Bounce</Typography>
                    </Box>
                    <IconButton size="small" onClick={() => toggleCard('cxPortBounce')}>
                      {expandedCard === 'cxPortBounce' ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                    </IconButton>
                  </Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    Bounce a port on a CX switch
                  </Typography>
                  <Collapse in={expandedCard === 'cxPortBounce'}>
                    <Box>
                      <DeviceSelector
                        value={cxSerial}
                        onChange={setCxSerial}
                        required={true}
                        label="CX Switch"
                        deviceType="Switch"
                        helperText="Select a CX switch"
                        disabled={devicesLoading}
                        sx={{ mb: 1 }}
                      />
                      <TextField
                        fullWidth
                        label="Port"
                        value={cxPortBouncePort}
                        onChange={(e) => setCxPortBouncePort(e.target.value)}
                        sx={{ mb: 1 }}
                        placeholder="e.g., 1/1"
                      />
                      <Button
                        variant="contained"
                        fullWidth
                        onClick={handleCxPortBounce}
                        disabled={loading.cxPortBounce}
                        startIcon={loading.cxPortBounce ? <CircularProgress size={20} /> : <RouterIcon />}
                      >
                        {loading.cxPortBounce ? 'Running...' : 'Bounce Port'}
                      </Button>
                    </Box>
                  </Collapse>
                </CardContent>
              </Card>
            </Grid>

            {/* CX Cable Test Card */}
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <CableIcon color="primary" />
                      <Typography variant="h6">CX Cable Test</Typography>
                    </Box>
                    <IconButton size="small" onClick={() => toggleCard('cxCableTest')}>
                      {expandedCard === 'cxCableTest' ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                    </IconButton>
                  </Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    Test cable connectivity on a port of a CX switch
                  </Typography>
                  <Collapse in={expandedCard === 'cxCableTest'}>
                    <Box>
                      <DeviceSelector
                        value={cxSerial}
                        onChange={setCxSerial}
                        required={true}
                        label="CX Switch"
                        deviceType="Switch"
                        helperText="Select a CX switch"
                        disabled={devicesLoading}
                        sx={{ mb: 1 }}
                      />
                      <TextField
                        fullWidth
                        label="Port"
                        value={cxCableTestPort}
                        onChange={(e) => setCxCableTestPort(e.target.value)}
                        sx={{ mb: 1 }}
                        placeholder="e.g., 1/1"
                      />
                      <Button
                        variant="contained"
                        fullWidth
                        onClick={handleCxCableTest}
                        disabled={loading.cxCableTest}
                        startIcon={loading.cxCableTest ? <CircularProgress size={20} /> : <CableIcon />}
                      >
                        {loading.cxCableTest ? 'Running...' : 'Run Cable Test'}
                      </Button>
                    </Box>
                  </Collapse>
                </CardContent>
              </Card>
            </Grid>

            {/* CX HTTP Test Card */}
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <HttpIcon color="primary" />
                      <Typography variant="h6">CX HTTP Test</Typography>
                    </Box>
                    <IconButton size="small" onClick={() => toggleCard('cxHttpTest')}>
                      {expandedCard === 'cxHttpTest' ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                    </IconButton>
                  </Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    Test HTTP connectivity from a CX switch
                  </Typography>
                  <Collapse in={expandedCard === 'cxHttpTest'}>
                    <Box>
                      <DeviceSelector
                        value={cxSerial}
                        onChange={setCxSerial}
                        required={true}
                        label="CX Switch"
                        deviceType="Switch"
                        helperText="Select a CX switch"
                        disabled={devicesLoading}
                        sx={{ mb: 1 }}
                      />
                      <TextField
                        fullWidth
                        label="URL"
                        value={cxHttpUrl}
                        onChange={(e) => setCxHttpUrl(e.target.value)}
                        sx={{ mb: 1 }}
                        placeholder="e.g., http://example.com"
                      />
                      <Button
                        variant="contained"
                        fullWidth
                        onClick={handleCxHttpTest}
                        disabled={loading.cxHttpTest}
                        startIcon={loading.cxHttpTest ? <CircularProgress size={20} /> : <HttpIcon />}
                      >
                        {loading.cxHttpTest ? 'Running...' : 'Run HTTP Test'}
                      </Button>
                    </Box>
                  </Collapse>
                </CardContent>
              </Card>
            </Grid>

            {/* CX AAA Test Card */}
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <SecurityIcon color="primary" />
                      <Typography variant="h6">CX AAA Test</Typography>
                    </Box>
                    <IconButton size="small" onClick={() => toggleCard('cxAaaTest')}>
                      {expandedCard === 'cxAaaTest' ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                    </IconButton>
                  </Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    Test AAA authentication from a CX switch
                  </Typography>
                  <Collapse in={expandedCard === 'cxAaaTest'}>
                    <Box>
                      <DeviceSelector
                        value={cxSerial}
                        onChange={setCxSerial}
                        required={true}
                        label="CX Switch"
                        deviceType="Switch"
                        helperText="Select a CX switch"
                        disabled={devicesLoading}
                        sx={{ mb: 1 }}
                      />
                      <TextField
                        fullWidth
                        label="Username"
                        value={cxAaaUsername}
                        onChange={(e) => setCxAaaUsername(e.target.value)}
                        sx={{ mb: 1 }}
                        placeholder="Enter username"
                      />
                      <TextField
                        fullWidth
                        type="password"
                        label="Password"
                        value={cxAaaPassword}
                        onChange={(e) => setCxAaaPassword(e.target.value)}
                        sx={{ mb: 1 }}
                        placeholder="Enter password"
                      />
                      <Button
                        variant="contained"
                        fullWidth
                        onClick={handleCxAaaTest}
                        disabled={loading.cxAaaTest}
                        startIcon={loading.cxAaaTest ? <CircularProgress size={20} /> : <SecurityIcon />}
                      >
                        {loading.cxAaaTest ? 'Running...' : 'Run AAA Test'}
                      </Button>
                    </Box>
                  </Collapse>
                </CardContent>
              </Card>
            </Grid>

            {/* CX Show Commands Card */}
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <CodeIcon color="primary" />
                      <Typography variant="h6">CX Show Commands</Typography>
                    </Box>
                    <IconButton size="small" onClick={() => toggleCard('cxShowCommands')}>
                      {expandedCard === 'cxShowCommands' ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                    </IconButton>
                  </Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    List or run show commands on a CX switch
                  </Typography>
                  <Collapse in={expandedCard === 'cxShowCommands'}>
                    <Box>
                      <List sx={{ pt: 0, pb: 1 }}>
                        <ListItem
                          button
                          sx={{ borderRadius: 1, mb: 0.5 }}
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
                          sx={{ borderRadius: 1, mb: 0.5 }}
                        >
                          <ListItemIcon>
                            <HealthAndSafetyIcon color="primary" />
                          </ListItemIcon>
                          <ListItemText
                            primary="Check Device Health"
                            secondary="View configuration issues"
                          />
                        </ListItem>
                        <ListItem
                          button
                          sx={{ borderRadius: 1 }}
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
                      <Divider sx={{ my: 1 }} />
                      <DeviceSelector
                        value={cxSerial}
                        onChange={setCxSerial}
                        required={true}
                        label="CX Switch"
                        deviceType="Switch"
                        helperText="Select a CX switch"
                        disabled={devicesLoading}
                        sx={{ mb: 1 }}
                      />
                      <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
                        <Button
                          variant="outlined"
                          fullWidth
                          onClick={handleCxListShowCommands}
                          disabled={loading.cxListShowCommands}
                          startIcon={loading.cxListShowCommands ? <CircularProgress size={20} /> : <CodeIcon />}
                        >
                          {loading.cxListShowCommands ? 'Loading...' : 'List Commands'}
                        </Button>
                      </Box>
                      <TextField
                        fullWidth
                        label="Show Command"
                        value={cxShowCommand}
                        onChange={(e) => setCxShowCommand(e.target.value)}
                        sx={{ mb: 1 }}
                        placeholder="e.g., show version"
                      />
                      <Button
                        variant="contained"
                        fullWidth
                        onClick={handleCxRunShowCommand}
                        disabled={loading.cxRunShowCommand}
                        startIcon={loading.cxRunShowCommand ? <CircularProgress size={20} /> : <CodeIcon />}
                      >
                        {loading.cxRunShowCommand ? 'Running...' : 'Run Command'}
                      </Button>
                    </Box>
                  </Collapse>
                </CardContent>
              </Card>
            </Grid>

            {/* CX Locate Card */}
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <LocationIcon color="primary" />
                      <Typography variant="h6">CX Locate</Typography>
                    </Box>
                    <IconButton size="small" onClick={() => toggleCard('cxLocate')}>
                      {expandedCard === 'cxLocate' ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                    </IconButton>
                  </Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    Flash LEDs to locate a CX switch
                  </Typography>
                  <Collapse in={expandedCard === 'cxLocate'}>
                    <Box>
                      <DeviceSelector
                        value={cxSerial}
                        onChange={setCxSerial}
                        required={true}
                        label="CX Switch"
                        deviceType="Switch"
                        helperText="Select a CX switch"
                        disabled={devicesLoading}
                        sx={{ mb: 1 }}
                      />
                      <Box sx={{ display: 'flex', gap: 1, mb: 1 }}>
                        <Button
                          variant={cxLocateEnable ? 'contained' : 'outlined'}
                          fullWidth
                          onClick={() => {
                            setCxLocateEnable(true);
                            handleCxLocate(true);
                          }}
                          disabled={loading.cxLocate}
                          startIcon={loading.cxLocate ? <CircularProgress size={20} /> : <LocationIcon />}
                        >
                          {loading.cxLocate ? 'Enabling...' : 'Enable Locate'}
                        </Button>
                        <Button
                          variant={!cxLocateEnable ? 'contained' : 'outlined'}
                          fullWidth
                          onClick={() => {
                            setCxLocateEnable(false);
                            handleCxLocate(false);
                          }}
                          disabled={loading.cxLocate}
                          startIcon={loading.cxLocate ? <CircularProgress size={20} /> : <LocationIcon />}
                        >
                          {loading.cxLocate ? 'Disabling...' : 'Disable Locate'}
                        </Button>
                      </Box>
                    </Box>
                  </Collapse>
                </CardContent>
              </Card>
            </Grid>

            {/* CX Reboot Card */}
            <Grid item xs={12} md={6}>
              <Card>
                <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <RestartIcon color="error" />
                      <Typography variant="h6">CX Reboot</Typography>
                    </Box>
                    <IconButton size="small" onClick={() => toggleCard('cxReboot')}>
                      {expandedCard === 'cxReboot' ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                    </IconButton>
                  </Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    Reboot a CX switch (use with caution)
                  </Typography>
                  <Collapse in={expandedCard === 'cxReboot'}>
                    <Box>
                      <DeviceSelector
                        value={cxSerial}
                        onChange={setCxSerial}
                        required={true}
                        label="CX Switch"
                        deviceType="Switch"
                        helperText="Select a CX switch"
                        disabled={devicesLoading}
                        sx={{ mb: 1 }}
                      />
                      <Alert severity="warning" sx={{ mb: 1 }}>
                        Warning: This will reboot the switch and cause a network interruption.
                      </Alert>
                      <Button
                        variant="contained"
                        color="error"
                        fullWidth
                        onClick={handleCxReboot}
                        disabled={loading.cxReboot}
                        startIcon={loading.cxReboot ? <CircularProgress size={20} /> : <RestartIcon />}
                      >
                        {loading.cxReboot ? 'Rebooting...' : 'Reboot Switch'}
                      </Button>
                    </Box>
                  </Collapse>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Grid>

        {/* Right Column - Results */}
        <Grid item xs={12} md={4}>
          <Card sx={{ position: 'sticky', top: 10 }}>
            <CardContent sx={{ p: 2, '&:last-child': { pb: 2 } }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Box>
                  <Typography variant="h6">Results</Typography>
                  {result && result.type && (
                    <Typography variant="caption" color="text.secondary" sx={{ textTransform: 'capitalize' }}>
                      {result.type.replace(/([A-Z])/g, ' $1').trim()}
                    </Typography>
                  )}
                </Box>
                {result && (
                  <Tooltip title="Copy to clipboard">
                    <IconButton size="small" onClick={copyToClipboard}>
                      <ContentCopyIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                )}
              </Box>
              <Divider sx={{ mb: 1 }} />

              {error && (
                <Alert severity="error" sx={{ mb: 1 }} onClose={() => setError('')}>
                  {error}
                </Alert>
              )}

              {success && (
                <Alert severity="success" sx={{ mb: 1 }} onClose={() => setSuccess('')}>
                  {success}
                </Alert>
              )}

              {result ? (
                <Box sx={{ maxHeight: 600, overflow: 'auto' }}>
                  {renderResult()}
                </Box>
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 2 }}>
                  <BugReportIcon sx={{ fontSize: 48, color: 'text.disabled', mb: 1 }} />
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
