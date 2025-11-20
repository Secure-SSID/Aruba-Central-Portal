/**
 * API Explorer Page
 * Test and explore Aruba Central API endpoints
 */

import { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  TextField,
  Button,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Alert,
  CircularProgress,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import SendIcon from '@mui/icons-material/Send';
import { Light as SyntaxHighlighter } from 'react-syntax-highlighter';
import json from 'react-syntax-highlighter/dist/esm/languages/hljs/json';
import { atomOneDark } from 'react-syntax-highlighter/dist/esm/styles/hljs';
import DownloadIcon from '@mui/icons-material/Download';
import { explorerAPI } from '../services/api';

SyntaxHighlighter.registerLanguage('json', json);

// Common API endpoints for quick access
// Using New Central API (v1alpha1) endpoints
// Base URL: https://internal.api.central.arubanetworks.com
const COMMON_ENDPOINTS = [
  // ========== Devices & Inventory ==========
  { 
    path: '/network-monitoring/v1alpha1/devices', 
    method: 'GET', 
    description: 'Get all devices',
    params: { limit: 20 },
    notes: 'Returns all device types (AP, SWITCH, GATEWAY). Filter by deviceType field.',
    category: 'Devices'
  },
  { 
    path: '/network-monitoring/v1alpha1/devices', 
    method: 'GET', 
    description: 'Get all switches',
    params: { filter: "deviceType eq 'SWITCH'", limit: 20 },
    notes: 'Filter devices by deviceType to get switches only',
    category: 'Devices'
  },
  { 
    path: '/network-monitoring/v1alpha1/devices', 
    method: 'GET', 
    description: 'Get all gateways',
    params: { filter: "deviceType eq 'GATEWAY'", limit: 20 },
    notes: 'Filter devices by deviceType to get gateways only',
    category: 'Devices'
  },
  { 
    path: '/network-monitoring/v1alpha1/device-inventory/{serial}', 
    method: 'GET', 
    description: 'Get device inventory details',
    params: {},
    notes: 'Replace {serial} with actual device serial number',
    category: 'Devices'
  },
  
  // ========== Access Points ==========
  {
    path: '/network-monitoring/v1alpha1/aps',
    method: 'GET',
    description: 'Get all access points',
    params: { limit: 20 },
    notes: 'Supports filter, sort, limit, and next query parameters',
    category: 'Access Points'
  },
  {
    path: '/network-monitoring/v1alpha1/aps',
    method: 'GET',
    description: 'Get APs by status (Up)',
    params: { filter: "status eq 'Up'", limit: 50 },
    notes: 'Filter APs by status',
    category: 'Access Points'
  },
  {
    path: '/network-monitoring/v1alpha1/aps/{serial}',
    method: 'GET',
    description: 'Get AP details',
    params: {},
    notes: 'Replace {serial} with actual AP serial number',
    category: 'Access Points'
  },
  {
    path: '/network-monitoring/v1alpha1/aps/{serial}/radios',
    method: 'GET',
    description: 'Get AP radio information',
    params: {},
    notes: 'Replace {serial} with actual AP serial number',
    category: 'Access Points'
  },
  {
    path: '/network-monitoring/v1alpha1/aps/{serial}/ports',
    method: 'GET',
    description: 'Get AP port information',
    params: {},
    notes: 'Replace {serial} with actual AP serial number',
    category: 'Access Points'
  },
  {
    path: '/network-monitoring/v1alpha1/aps/{serial}/cpu-utilization-trends',
    method: 'GET',
    description: 'Get AP CPU utilization trends',
    params: { interval: '5m', duration: '1h' },
    notes: 'Replace {serial} with actual AP serial number. interval: 5m, 1h, 1d. duration: 1h, 24h, 7d',
    category: 'Access Points'
  },
  {
    path: '/network-monitoring/v1alpha1/aps/{serial}/memory-utilization-trends',
    method: 'GET',
    description: 'Get AP memory utilization trends',
    params: { interval: '5m', duration: '1h' },
    notes: 'Replace {serial} with actual AP serial number',
    category: 'Access Points'
  },
  {
    path: '/network-monitoring/v1alpha1/aps/{serial}/power-consumption-trends',
    method: 'GET',
    description: 'Get AP power consumption trends',
    params: { interval: '5m', duration: '1h' },
    notes: 'Replace {serial} with actual AP serial number',
    category: 'Access Points'
  },
  {
    path: '/network-monitoring/v1alpha1/aps/{serial}/throughput',
    method: 'GET',
    description: 'Get AP throughput trends',
    params: { interval: '5m', duration: '1h' },
    notes: 'Replace {serial} with actual AP serial number',
    category: 'Access Points'
  },
  {
    path: '/network-monitoring/v1alpha1/aps/bandwidth/top',
    method: 'GET',
    description: 'Get top APs by bandwidth usage',
    params: { count: 10 },
    notes: 'Returns top N APs by bandwidth usage',
    category: 'Access Points'
  },
  
  // ========== Switches ==========
  {
    path: '/network-monitoring/v1alpha1/switches',
    method: 'GET',
    description: 'Get all switches',
    params: { limit: 20 },
    notes: 'Get list of all switches with monitoring data',
    category: 'Switches'
  },
  {
    path: '/network-monitoring/v1alpha1/switches/{serial}',
    method: 'GET',
    description: 'Get switch details',
    params: {},
    notes: 'Replace {serial} with actual switch serial number',
    category: 'Switches'
  },
  {
    path: '/network-monitoring/v1alpha1/switch/{serial}/interfaces',
    method: 'GET',
    description: 'Get switch interfaces',
    params: {},
    notes: 'Replace {serial} with actual switch serial number',
    category: 'Switches'
  },
  {
    path: '/network-monitoring/v1alpha1/switch/{serial}/vlans',
    method: 'GET',
    description: 'Get switch VLANs',
    params: {},
    notes: 'Replace {serial} with actual switch serial number',
    category: 'Switches'
  },
  {
    path: '/network-monitoring/v1alpha1/switch/{serial}/cpu-utilization-trends',
    method: 'GET',
    description: 'Get switch CPU utilization trends',
    params: { interval: '5m', duration: '1h' },
    notes: 'Replace {serial} with actual switch serial number',
    category: 'Switches'
  },
  {
    path: '/network-monitoring/v1alpha1/switch/{serial}/memory-utilization-trends',
    method: 'GET',
    description: 'Get switch memory utilization trends',
    params: { interval: '5m', duration: '1h' },
    notes: 'Replace {serial} with actual switch serial number',
    category: 'Switches'
  },
  {
    path: '/network-monitoring/v1alpha1/switches/{serial}/ports',
    method: 'GET',
    description: 'Get switch ports',
    params: {},
    notes: 'Replace {serial} with actual switch serial number',
    category: 'Switches'
  },
  
  // ========== Gateways ==========
  {
    path: '/network-monitoring/v1alpha1/gateways',
    method: 'GET',
    description: 'Get all gateways',
    params: { limit: 20 },
    notes: 'Get list of all gateways',
    category: 'Gateways'
  },
  {
    path: '/network-monitoring/v1alpha1/gateways/{serial}',
    method: 'GET',
    description: 'Get gateway details',
    params: {},
    notes: 'Replace {serial} with actual gateway serial number',
    category: 'Gateways'
  },
  {
    path: '/network-monitoring/v1alpha1/gateways/{serial}/tunnels',
    method: 'GET',
    description: 'Get gateway tunnels',
    params: {},
    notes: 'Replace {serial} with actual gateway serial number',
    category: 'Gateways'
  },
  
  // ========== Clients ==========
  { 
    path: '/network-monitoring/v1alpha1/clients', 
    method: 'GET', 
    description: 'Get all clients',
    params: {},
    notes: 'Optional site-id query parameter to filter by site',
    category: 'Clients'
  },
  { 
    path: '/network-monitoring/v1alpha1/clients/{mac}/session', 
    method: 'GET', 
    description: 'Get client session details',
    params: {},
    notes: 'Replace {mac} with client MAC address (format: XX:XX:XX:XX:XX:XX)',
    category: 'Clients'
  },
  { 
    path: '/network-monitoring/v1alpha1/clients/trends', 
    method: 'GET', 
    description: 'Get client connection trends',
    params: {},
    notes: 'Optional site-id query parameter',
    category: 'Clients'
  },
  { 
    path: '/network-monitoring/v1alpha1/clients/usage/topn', 
    method: 'GET', 
    description: 'Get top clients by usage',
    params: {},
    notes: 'Optional site-id query parameter',
    category: 'Clients'
  },
  
  // ========== WLANs ==========
  { 
    path: '/network-monitoring/v1alpha1/wlans', 
    method: 'GET', 
    description: 'Get all WLANs (SSIDs)',
    params: {},
    notes: 'Returns all wireless networks configured in Central',
    category: 'WLANs'
  },
  {
    path: '/network-monitoring/v1alpha1/wlans/{wlan_name}/throughput',
    method: 'GET',
    description: 'Get WLAN throughput trends',
    params: { interval: '5m', duration: '1h' },
    notes: 'Replace {wlan_name} with actual WLAN/SSID name',
    category: 'WLANs'
  },
  
  // ========== Sites & Health ==========
  { 
    path: '/network-monitoring/v1alpha1/sites-health', 
    method: 'GET', 
    description: 'Get sites health overview',
    params: {},
    notes: 'Provides read-only site information with health metrics',
    category: 'Sites & Health'
  },
  {
    path: '/network-monitoring/v1alpha1/site-health/{site_id}',
    method: 'GET',
    description: 'Get specific site health',
    params: {},
    notes: 'Replace {site_id} with actual site ID',
    category: 'Sites & Health'
  },
  {
    path: '/network-monitoring/v1alpha1/sites-device-health',
    method: 'GET',
    description: 'Get sites device health',
    params: {},
    notes: 'Get device health metrics across all sites',
    category: 'Sites & Health'
  },
  {
    path: '/network-monitoring/v1alpha1/tenant-device-health',
    method: 'GET',
    description: 'Get tenant device health',
    params: {},
    notes: 'Get device health metrics for entire tenant',
    category: 'Sites & Health'
  },
  
  // ========== Alerts ==========
  {
    path: '/network-monitoring/v1alpha1/alerts',
    method: 'GET',
    description: 'Get all alerts',
    params: { limit: 100 },
    notes: 'Get network alerts. Optional: limit, severity, site-id',
    category: 'Alerts'
  },
  {
    path: '/network-monitoring/v1alpha1/alerts/{alert_id}',
    method: 'GET',
    description: 'Get alert details',
    params: {},
    notes: 'Replace {alert_id} with actual alert ID',
    category: 'Alerts'
  },
  {
    path: '/network-monitoring/v1alpha1/alerts/{alert_id}/acknowledge',
    method: 'POST',
    description: 'Acknowledge alert',
    params: {},
    body: {},
    notes: 'Replace {alert_id} with actual alert ID',
    category: 'Alerts'
  },
  
  // ========== Applications ==========
  {
    path: '/network-monitoring/v1alpha1/applications',
    method: 'GET',
    description: 'Get applications',
    params: {},
    notes: 'Get application visibility data. Optional: site-id, limit',
    category: 'Applications'
  },
  {
    path: '/network-monitoring/v1alpha1/applications/top',
    method: 'GET',
    description: 'Get top applications',
    params: { count: 10 },
    notes: 'Get top N applications by usage. Optional: site-id',
    category: 'Applications'
  },
  
  // ========== Reporting & Analytics ==========
  {
    path: '/network-monitoring/v1alpha1/top-aps-by-wireless-usage',
    method: 'GET',
    description: 'Get top APs by wireless usage',
    params: { count: 10 },
    notes: 'Returns top N APs by wireless bandwidth usage. Optional: site-id, from_timestamp, to_timestamp',
    category: 'Reporting'
  },
  {
    path: '/network-monitoring/v1alpha1/top-aps-by-client-count',
    method: 'GET',
    description: 'Get top APs by client count',
    params: { count: 10 },
    notes: 'Returns top N APs by number of connected clients. Optional: site-id',
    category: 'Reporting'
  },
  {
    path: '/network-monitoring/v1alpha1/network-usage',
    method: 'GET',
    description: 'Get network usage',
    params: {},
    notes: 'Get overall network usage statistics. Optional: site-id, timeframe',
    category: 'Reporting'
  },
  {
    path: '/network-monitoring/v1alpha1/wireless-health',
    method: 'GET',
    description: 'Get wireless health',
    params: {},
    notes: 'Get wireless network health metrics. Optional: site-id',
    category: 'Reporting'
  },
  {
    path: '/network-monitoring/v1alpha1/top-ssids-by-usage',
    method: 'GET',
    description: 'Get top SSIDs by usage',
    params: { count: 10 },
    notes: 'Returns top N SSIDs by usage. Optional: site-id',
    category: 'Reporting'
  },
  
  // ========== Swarms (AP Groups) ==========
  {
    path: '/network-monitoring/v1alpha1/swarms',
    method: 'GET',
    description: 'Get all swarms',
    params: { limit: 20 },
    notes: 'Get all AP swarms (groups)',
    category: 'Swarms'
  },
  {
    path: '/network-monitoring/v1alpha1/swarms/{swarm_id}',
    method: 'GET',
    description: 'Get swarm details',
    params: {},
    notes: 'Replace {swarm_id} with actual swarm ID',
    category: 'Swarms'
  },
  
  // ========== Firewall & Security ==========
  {
    path: '/network-monitoring/v1alpha1/firewall/sessions',
    method: 'GET',
    description: 'Get firewall sessions',
    params: { limit: 100 },
    notes: 'Get active firewall sessions. Optional: gateway_serial, limit',
    category: 'Security'
  },
  {
    path: '/network-monitoring/v1alpha1/idps/events',
    method: 'GET',
    description: 'Get IDPS events',
    params: { limit: 100 },
    notes: 'Get Intrusion Detection/Prevention System events. Optional: site-id, limit',
    category: 'Security'
  },
];

function APIExplorerPage() {
  const [endpoint, setEndpoint] = useState('');
  const [method, setMethod] = useState('GET');
  const [params, setParams] = useState('');
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(false);
  const [response, setResponse] = useState(null);
  const [error, setError] = useState('');

  const handleExecute = async () => {
    setLoading(true);
    setError('');
    setResponse(null);

    try {
      // Parse params and body
      let parsedParams = {};
      let parsedBody = {};

      if (params.trim()) {
        try {
          parsedParams = JSON.parse(params);
        } catch (e) {
          throw new Error('Invalid JSON in parameters');
        }
      }

      if (body.trim() && (method === 'POST' || method === 'PUT')) {
        try {
          parsedBody = JSON.parse(body);
        } catch (e) {
          throw new Error('Invalid JSON in request body');
        }
      }

      // Execute request
      const result = await explorerAPI.executeRequest(
        endpoint,
        method,
        parsedParams,
        parsedBody
      );

      setResponse(result);
    } catch (err) {
      setError(err.message || 'Request failed');
    } finally {
      setLoading(false);
    }
  };

  const loadEndpoint = (path, httpMethod, exampleParams = null, exampleBody = null) => {
    setEndpoint(path);
    setMethod(httpMethod);
    setParams(exampleParams ? JSON.stringify(exampleParams, null, 2) : '');
    setBody(exampleBody ? JSON.stringify(exampleBody, null, 2) : '');
    setResponse(null);
    setError('');
  };

  /**
   * Convert API response data to CSV format
   * Handles various response structures intelligently
   */
  const convertToCSV = (data) => {
    if (!data) return null;

    // Extract array of items from common response structures
    let items = [];
    
    // Handle common Aruba Central API response format: { count: X, items: [...] }
    if (data.items && Array.isArray(data.items)) {
      items = data.items;
    }
    // Handle direct array
    else if (Array.isArray(data)) {
      items = data;
    }
    // Handle single object - convert to array with one item
    else if (typeof data === 'object' && data !== null) {
      items = [data];
    }
    else {
      return null;
    }

    if (items.length === 0) {
      return null;
    }

    // Flatten nested objects and collect all possible headers
    const flattenedItems = items.map(item => flattenObject(item));
    const allHeaders = new Set();
    flattenedItems.forEach(item => {
      Object.keys(item).forEach(key => allHeaders.add(key));
    });

    const headers = Array.from(allHeaders).sort();

    // Create CSV rows
    const csvRows = [
      // Header row with readable column names
      headers.map(h => formatHeader(h)).join(','),
      // Data rows
      ...flattenedItems.map(item => {
        return headers.map(header => {
          const value = item[header];
          return escapeCSVValue(value);
        }).join(',');
      })
    ];

    return csvRows.join('\n');
  };

  /**
   * Flatten nested objects into dot-notation keys
   */
  const flattenObject = (obj, prefix = '', result = {}) => {
    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const newKey = prefix ? `${prefix}.${key}` : key;
        const value = obj[key];

        if (value === null || value === undefined) {
          result[newKey] = '';
        } else if (Array.isArray(value)) {
          // Handle arrays - join with semicolon or take first item if it's an object
          if (value.length === 0) {
            result[newKey] = '';
          } else if (typeof value[0] === 'object') {
            // Array of objects - flatten each and join
            const flattened = value.map((item, idx) => {
              const flat = {};
              flattenObject(item, `${newKey}[${idx}]`, flat);
              return Object.entries(flat).map(([k, v]) => `${k}: ${v}`).join('; ');
            });
            result[newKey] = flattened.join(' | ');
          } else {
            result[newKey] = value.join('; ');
          }
        } else if (typeof value === 'object') {
          // Recursively flatten nested objects
          flattenObject(value, newKey, result);
        } else {
          result[newKey] = value;
        }
      }
    }
    return result;
  };

  /**
   * Format header names to be more readable
   */
  const formatHeader = (header) => {
    // Escape header if it contains comma or quote
    let formatted = header
      .replace(/([A-Z])/g, ' $1') // Add space before capital letters
      .replace(/\./g, ' > ') // Replace dots with " > "
      .replace(/_/g, ' ') // Replace underscores with spaces
      .replace(/\[(\d+)\]/g, ' [$1]') // Keep array indices readable
      .trim();
    
    // Capitalize first letter of each word, but preserve common abbreviations
    const words = formatted.split(' ');
    const formattedWords = words.map((word, idx) => {
      const lower = word.toLowerCase();
      // Preserve common abbreviations
      if (['id', 'ip', 'mac', 'ssid', 'vlan', 'cpu', 'api', 'url'].includes(lower)) {
        return lower.toUpperCase();
      }
      // Capitalize first letter
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    });
    
    formatted = formattedWords.join(' ');
    
    // Escape if needed
    if (formatted.includes(',') || formatted.includes('"')) {
      return `"${formatted.replace(/"/g, '""')}"`;
    }
    
    return formatted;
  };

  /**
   * Escape CSV value properly and format for readability
   */
  const escapeCSVValue = (value) => {
    if (value === null || value === undefined) {
      return '';
    }

    // Format dates/timestamps
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) {
      try {
        const date = new Date(value);
        if (!isNaN(date.getTime())) {
          // Format as readable date/time
          return date.toLocaleString();
        }
      } catch (e) {
        // Not a valid date, continue
      }
    }

    // Format numbers with commas for readability
    if (typeof value === 'number') {
      // For large numbers, add thousand separators
      if (value >= 1000) {
        return value.toLocaleString();
      }
      return String(value);
    }

    const stringValue = String(value);
    
    // If value contains comma, quote, or newline, wrap in quotes and escape quotes
    if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
      return `"${stringValue.replace(/"/g, '""')}"`;
    }
    
    return stringValue;
  };

  /**
   * Export response data to CSV
   */
  const handleExportCSV = () => {
    if (!response || !response.success || !response.data) {
      return;
    }

    const csvContent = convertToCSV(response.data);
    if (!csvContent) {
      setError('No data available to export. Response may be empty or in an unsupported format.');
      return;
    }

    // Generate filename from endpoint
    const endpointName = endpoint
      .replace(/^\//, '')
      .replace(/\//g, '_')
      .replace(/\{.*?\}/g, '')
      .replace(/[^a-zA-Z0-9_]/g, '_')
      .toLowerCase() || 'api_response';
    
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `${endpointName}_${timestamp}.csv`;

    // Create and download file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <Box>
      {/* Page Header */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
          API Explorer
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Test and explore Aruba Central API endpoints interactively
        </Typography>
      </Box>

      {/* Quick Access Endpoints */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Common Endpoints ({COMMON_ENDPOINTS.length} available)
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Click to quickly load an endpoint. Organized by category.
          </Typography>
          
          {/* Group endpoints by category */}
          {Object.entries(
            COMMON_ENDPOINTS.reduce((acc, ep) => {
              const category = ep.category || 'Other';
              if (!acc[category]) acc[category] = [];
              acc[category].push(ep);
              return acc;
            }, {})
          ).map(([category, endpoints]) => (
            <Box key={category} sx={{ mb: 3 }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600, mb: 1, color: 'primary.main' }}>
                {category} ({endpoints.length})
              </Typography>
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {endpoints.map((ep, index) => (
                  <Chip
                    key={`${category}-${index}`}
                    label={ep.description}
                    onClick={() => loadEndpoint(ep.path, ep.method, ep.params, ep.body)}
                    clickable
                    variant="outlined"
                    size="small"
                    sx={{
                      '&:hover': {
                        backgroundColor: 'primary.main',
                        color: 'white',
                      },
                    }}
                  />
                ))}
              </Box>
            </Box>
          ))}
        </CardContent>
      </Card>

      {/* Request Configuration */}
      <Card sx={{ mb: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Request Configuration
          </Typography>

          {/* Method and Endpoint */}
          <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
            <FormControl sx={{ minWidth: 120 }}>
              <InputLabel>Method</InputLabel>
              <Select
                value={method}
                onChange={(e) => setMethod(e.target.value)}
                label="Method"
              >
                <MenuItem value="GET">GET</MenuItem>
                <MenuItem value="POST">POST</MenuItem>
                <MenuItem value="PUT">PUT</MenuItem>
                <MenuItem value="DELETE">DELETE</MenuItem>
              </Select>
            </FormControl>

            <TextField
              fullWidth
              label="API Endpoint"
              placeholder="/monitoring/v1/devices"
              value={endpoint}
              onChange={(e) => setEndpoint(e.target.value)}
              helperText="Enter the API endpoint path (e.g., /monitoring/v1/devices)"
            />
          </Box>

          {/* Parameters Accordion */}
          <Accordion sx={{ mb: 2 }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography>Query Parameters (Optional)</Typography>
            </AccordionSummary>
            <AccordionDetails>
              <TextField
                fullWidth
                multiline
                rows={4}
                placeholder='{"limit": 100, "offset": 0}'
                value={params}
                onChange={(e) => setParams(e.target.value)}
                helperText="Enter query parameters as JSON"
                sx={{ fontFamily: 'monospace' }}
              />
            </AccordionDetails>
          </Accordion>

          {/* Request Body Accordion */}
          {(method === 'POST' || method === 'PUT') && (
            <Accordion sx={{ mb: 2 }}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography>Request Body</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <TextField
                  fullWidth
                  multiline
                  rows={6}
                  placeholder='{"key": "value"}'
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  helperText="Enter request body as JSON"
                  sx={{ fontFamily: 'monospace' }}
                />
              </AccordionDetails>
            </Accordion>
          )}

          {/* Execute Button */}
          <Button
            variant="contained"
            size="large"
            onClick={handleExecute}
            disabled={loading || !endpoint}
            startIcon={loading ? <CircularProgress size={20} /> : <SendIcon />}
            sx={{ mt: 2 }}
          >
            {loading ? 'Executing...' : 'Execute Request'}
          </Button>
        </CardContent>
      </Card>

      {/* Error Display */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {/* Response Display */}
      {response && (
        <Card>
          <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">Response</Typography>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                {response.success && response.data && (
                  <Button
                    variant="outlined"
                    size="small"
                    startIcon={<DownloadIcon />}
                    onClick={handleExportCSV}
                    sx={{ mr: 1 }}
                  >
                    Export CSV
                  </Button>
                )}
                <Chip
                  label={response.success ? 'Success' : 'Error'}
                  color={response.success ? 'success' : 'error'}
                  size="small"
                />
              </Box>
            </Box>

            <Box
              sx={{
                borderRadius: 1,
                overflow: 'hidden',
                '& pre': {
                  margin: 0,
                  maxHeight: '500px',
                  overflow: 'auto',
                },
              }}
            >
              <SyntaxHighlighter
                language="json"
                style={atomOneDark}
                customStyle={{
                  padding: '16px',
                  fontSize: '14px',
                }}
              >
                {JSON.stringify(response.data || response.error, null, 2)}
              </SyntaxHighlighter>
            </Box>
          </CardContent>
        </Card>
      )}

      {/* Documentation */}
      <Card sx={{ mt: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Documentation
          </Typography>
          <Typography variant="body2" color="text.secondary" paragraph>
            Use this API Explorer to test Aruba Central API endpoints. All requests are proxied
            through the backend server to maintain security.
          </Typography>
          <Typography variant="body2" color="text.secondary">
            <strong>Tips:</strong>
          </Typography>
          <ul>
            <li>
              <Typography variant="body2" color="text.secondary">
                Start with GET requests to retrieve data
              </Typography>
            </li>
            <li>
              <Typography variant="body2" color="text.secondary">
                Use the common endpoints above for quick testing
              </Typography>
            </li>
            <li>
              <Typography variant="body2" color="text.secondary">
                Query parameters and request body must be valid JSON
              </Typography>
            </li>
            <li>
              <Typography variant="body2" color="text.secondary">
                Refer to the{' '}
                <a
                  href="https://developer.arubanetworks.com/new-central/reference"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: '#01a982' }}
                >
                  official New Central API documentation
                </a>{' '}
                for available endpoints. All endpoints use the base URL: <code>https://internal.api.central.arubanetworks.com</code>
              </Typography>
            </li>
          </ul>

          <Typography variant="body2" color="text.secondary" sx={{ mt: 3, mb: 1 }}>
            <strong>Important Notes:</strong>
          </Typography>
          <ul>
            <li>
              <Typography variant="body2" color="text.secondary">
                All endpoints use the <strong>New Central API (v1alpha1)</strong> format
              </Typography>
            </li>
            <li>
              <Typography variant="body2" color="text.secondary">
                Base URL: <code>https://internal.api.central.arubanetworks.com</code>
              </Typography>
            </li>
            <li>
              <Typography variant="body2" color="text.secondary">
                Legacy endpoints like <code>/monitoring/v1/*</code>, <code>/central/v2/*</code>, <code>/configuration/v1/*</code>, and <code>/platform/*</code> are <strong>not available</strong> in v1alpha1
              </Typography>
            </li>
            <li>
              <Typography variant="body2" color="text.secondary">
                For switches, use <code>/network-monitoring/v1alpha1/devices</code> with filter: <code>deviceType eq 'SWITCH'</code>
              </Typography>
            </li>
          </ul>

          <Typography variant="body2" color="text.secondary" sx={{ mt: 3, mb: 1 }}>
            <strong>Access Points Endpoint Examples:</strong>
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            The <code>/network-monitoring/v1alpha1/aps</code> endpoint supports advanced filtering:
          </Typography>
          <Box
            component="pre"
            sx={{
              backgroundColor: '#282c34',
              color: '#abb2bf',
              p: 2,
              borderRadius: 1,
              overflow: 'auto',
              fontSize: '12px',
              fontFamily: 'monospace',
            }}
          >
{`// Basic pagination
{"limit": 20}

// Filter by site
{"filter": "siteId eq 'YOUR_SITE_ID'"}

// Filter by status
{"filter": "status eq 'Up'"}

// Filter by model
{"filter": "model eq 'MODEL_NAME'"}

// Multiple filters (only 'and' supported)
{"filter": "status eq 'Up' and siteId eq 'YOUR_SITE_ID'"}

// Filter using 'in' operator
{"filter": "serialNumber in ('SERIAL_1', 'SERIAL_2')"}

// Sort results
{"sort": "deviceName asc", "limit": 50}

// Combine filter, sort, and limit
{"filter": "status eq 'Up'", "sort": "deviceName desc", "limit": 100}`}
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}

export default APIExplorerPage;
