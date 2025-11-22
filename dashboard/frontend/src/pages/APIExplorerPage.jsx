/**
 * API Explorer Page
 * Test and explore Aruba Central API endpoints
 */

import { useState, useEffect } from 'react';
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
import { explorerAPI, sitesConfigAPI, monitoringAPIv2, configAPI, deviceAPI } from '../services/api';
import DeviceSelector from '../components/DeviceSelector';
import { getErrorMessage } from '../utils/errorUtils';

SyntaxHighlighter.registerLanguage('json', json);

// Endpoints that support site-id query parameter
// Based on Aruba Central API documentation and endpoint notes
const ENDPOINTS_WITH_SITE_ID = [
  '/network-monitoring/v1alpha1/clients',
  '/network-monitoring/v1alpha1/clients/trends',
  '/network-monitoring/v1alpha1/clients/usage/topn',
  '/network-monitoring/v1alpha1/top-aps-by-wireless-usage',
  '/network-monitoring/v1alpha1/top-aps-by-client-count',
  '/network-monitoring/v1alpha1/network-usage',
  '/network-monitoring/v1alpha1/wireless-health',
  '/network-monitoring/v1alpha1/top-ssids-by-usage',
  '/network-monitoring/v1alpha1/applications',
  '/network-monitoring/v1alpha1/applications/top',
  '/network-monitoring/v1alpha1/alerts',
  '/network-monitoring/v1alpha1/idps/events',
];

/**
 * Endpoints that REQUIRE site-id parameter (backend returns 400 if missing)
 */
const ENDPOINTS_REQUIRING_SITE_ID = [
  '/network-monitoring/v1alpha1/clients',
  '/api/clients', // Backend endpoint
];

/**
 * Check if an endpoint requires a serial parameter (in path or query)
 * Detects patterns like /devices/{serial}, /aps/{serial}, /switches/{serial}
 * or query parameters like ?serial=XXX
 */
const requiresSerial = (endpoint) => {
  if (!endpoint) return false;
  
  // Parse endpoint to get base path without query params
  const [basePath] = endpoint.trim().split('?');
  const normalizedPath = basePath.toLowerCase().replace(/\/$/, '');
  
  // Patterns that indicate serial is required in path
  const serialPathPatterns = [
    /\/devices\/\{serial\}/i,
    /\/device\/\{serial\}/i,
    /\/aps\/\{serial\}/i,
    /\/ap\/\{serial\}/i,
    /\/switches\/\{serial\}/i,
    /\/switch\/\{serial\}/i,
    /\/gateways\/\{serial\}/i,
    /\/gateway\/\{serial\}/i,
    /\/monitoring\/aps\/\{serial\}/i,
    /\/monitoring\/switches\/\{serial\}/i,
    /\/monitoring\/devices\/\{serial\}/i,
  ];
  
  // Check if path contains {serial} placeholder
  if (serialPathPatterns.some(pattern => pattern.test(normalizedPath))) {
    return true;
  }
  
  // Check if path has a segment that looks like it needs serial
  // e.g., /monitoring/aps/ABC123, /devices/XYZ789
  const pathSegments = normalizedPath.split('/');
  const serialIndicators = ['aps', 'ap', 'switches', 'switch', 'devices', 'device', 'gateways', 'gateway'];
  
  for (let i = 0; i < pathSegments.length - 1; i++) {
    if (serialIndicators.includes(pathSegments[i])) {
      const nextSegment = pathSegments[i + 1];
      // If next segment exists and doesn't look like a known resource, it's likely a serial
      if (nextSegment && !['cpu', 'memory', 'power', 'interfaces', 'ports', 'radios'].includes(nextSegment)) {
        return true;
      }
    }
  }
  
  return false;
};

/**
 * Extract serial from endpoint path if present
 */
const extractSerialFromPath = (endpoint) => {
  if (!endpoint) return null;
  
  const [basePath] = endpoint.trim().split('?');
  const pathSegments = basePath.split('/').filter(s => s);
  
  const serialIndicators = ['aps', 'ap', 'switches', 'switch', 'devices', 'device', 'gateways', 'gateway'];
  
  for (let i = 0; i < pathSegments.length - 1; i++) {
    if (serialIndicators.includes(pathSegments[i].toLowerCase())) {
      const nextSegment = pathSegments[i + 1];
      // If next segment exists and doesn't look like a known resource, it's likely a serial
      if (nextSegment && !['cpu', 'memory', 'power', 'interfaces', 'ports', 'radios', 'trends', 'usage'].includes(nextSegment.toLowerCase())) {
        return nextSegment;
      }
    }
  }
  
  return null;
};

/**
 * Get device type from endpoint path (AP, SWITCH, GATEWAY)
 */
const getDeviceTypeFromEndpoint = (endpoint) => {
  if (!endpoint) return null;
  
  const [basePath] = endpoint.trim().split('?');
  const normalizedPath = basePath.toLowerCase();
  
  if (normalizedPath.includes('/ap/') || normalizedPath.includes('/aps/')) {
    return 'AP';
  }
  if (normalizedPath.includes('/switch/') || normalizedPath.includes('/switches/')) {
    return 'SWITCH';
  }
  if (normalizedPath.includes('/gateway/') || normalizedPath.includes('/gateways/')) {
    return 'GATEWAY';
  }
  
  return null;
};

/**
 * Check if an endpoint supports site-id parameter
 * Only returns true for list endpoints that actually support site-id, not detail endpoints
 */
const supportsSiteId = (endpoint) => {
  if (!endpoint) return false;
  
  // Parse endpoint to get base path without query params
  const [basePath] = endpoint.trim().split('?');
  const normalizedPath = basePath.toLowerCase().replace(/\/$/, ''); // Remove trailing slash
  
  // Known sub-resources that support site-id (these come after the base path)
  const knownSubResources = ['trends', 'usage', 'top'];
  
  // Check against exact endpoint matches (list endpoints only, not detail endpoints)
  return ENDPOINTS_WITH_SITE_ID.some(supportedPath => {
    const supportedPathNormalized = supportedPath.toLowerCase();
    
    // Exact match
    if (normalizedPath === supportedPathNormalized) {
      return true;
    }
    
    // Check if it's a known sub-resource endpoint (e.g., /clients/trends, /applications/top)
    if (normalizedPath.startsWith(supportedPathNormalized + '/')) {
      const afterBasePath = normalizedPath.substring(supportedPathNormalized.length + 1);
      
      // Check if it's a known sub-resource
      if (knownSubResources.some(resource => afterBasePath === resource || afterBasePath.startsWith(resource + '/'))) {
        return true;
      }
      
      // If there's something after the base path that's not a known sub-resource,
      // it's a detail endpoint (like /clients/{mac}/session or /alerts/{alert_id})
      // Detail endpoints don't support site-id
      return false;
    }
    
    return false;
  });
};

/**
 * Check if an endpoint REQUIRES site-id parameter
 * Returns true for endpoints that will return 400 if site-id is missing
 */
const requiresSiteId = (endpoint) => {
  if (!endpoint) return false;
  
  // Parse endpoint to get base path without query params
  const [basePath] = endpoint.trim().split('?');
  const normalizedPath = basePath.toLowerCase().replace(/\/$/, '');
  
  // Check against endpoints that require site-id
  return ENDPOINTS_REQUIRING_SITE_ID.some(requiredPath => {
    const requiredPathNormalized = requiredPath.toLowerCase();
    return normalizedPath === requiredPathNormalized || normalizedPath.endsWith(requiredPathNormalized);
  });
};

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
  {
    path: '/network-monitoring/v1alpha1/aps/{serial}/radios/{radio_id}/channel-utilization',
    method: 'GET',
    description: 'Get AP radio channel utilization',
    params: { interval: '5m', duration: '1h' },
    notes: 'Replace {serial} and {radio_id} with actual values',
    category: 'Access Points'
  },
  {
    path: '/network-monitoring/v1alpha1/aps/{serial}/radios/{radio_id}/channel-quality',
    method: 'GET',
    description: 'Get AP radio channel quality',
    params: { interval: '5m', duration: '1h' },
    notes: 'Replace {serial} and {radio_id} with actual values',
    category: 'Access Points'
  },
  {
    path: '/network-monitoring/v1alpha1/aps/{serial}/radios/{radio_id}/noise-floor',
    method: 'GET',
    description: 'Get AP radio noise floor',
    params: { interval: '5m', duration: '1h' },
    notes: 'Replace {serial} and {radio_id} with actual values',
    category: 'Access Points'
  },
  {
    path: '/network-monitoring/v1alpha1/aps/{serial}/radios/{radio_id}/transmission',
    method: 'GET',
    description: 'Get AP radio transmission info',
    params: { interval: '5m', duration: '1h' },
    notes: 'Replace {serial} and {radio_id} with actual values',
    category: 'Access Points'
  },
  {
    path: '/network-monitoring/v1alpha1/aps/{serial}/radios/{radio_id}/throughput',
    method: 'GET',
    description: 'Get AP radio throughput trend',
    params: { interval: '5m', duration: '1h' },
    notes: 'Replace {serial} and {radio_id} with actual values',
    category: 'Access Points'
  },
  {
    path: '/network-monitoring/v1alpha1/aps/{serial}/ports/{port_id}/frames',
    method: 'GET',
    description: 'Get AP port frame trends',
    params: { interval: '5m', duration: '1h' },
    notes: 'Replace {serial} and {port_id} with actual values',
    category: 'Access Points'
  },
  {
    path: '/network-monitoring/v1alpha1/aps/{serial}/ports/{port_id}/crc-errors',
    method: 'GET',
    description: 'Get AP port CRC errors',
    params: { interval: '5m', duration: '1h' },
    notes: 'Replace {serial} and {port_id} with actual values',
    category: 'Access Points'
  },
  {
    path: '/network-monitoring/v1alpha1/aps/{serial}/ports/{port_id}/collision-errors',
    method: 'GET',
    description: 'Get AP port collision errors',
    params: { interval: '5m', duration: '1h' },
    notes: 'Replace {serial} and {port_id} with actual values',
    category: 'Access Points'
  },
  {
    path: '/network-monitoring/v1alpha1/aps/{serial}/ports/{port_id}/throughput',
    method: 'GET',
    description: 'Get AP port throughput trend',
    params: { interval: '5m', duration: '1h' },
    notes: 'Replace {serial} and {port_id} with actual values',
    category: 'Access Points'
  },
  {
    path: '/network-monitoring/v1alpha1/aps/{serial}/wlans',
    method: 'GET',
    description: 'Get AP WLANs',
    params: {},
    notes: 'Replace {serial} with actual AP serial number',
    category: 'Access Points'
  },
  {
    path: '/network-monitoring/v1alpha1/aps/{serial}/wlans/{wlan_name}/throughput',
    method: 'GET',
    description: 'Get AP WLAN throughput trend',
    params: { interval: '5m', duration: '1h' },
    notes: 'Replace {serial} and {wlan_name} with actual values',
    category: 'Access Points'
  },
  {
    path: '/network-monitoring/v1alpha1/aps/{serial}/tunnels',
    method: 'GET',
    description: 'Get AP tunnels',
    params: {},
    notes: 'Replace {serial} with actual AP serial number',
    category: 'Access Points'
  },
  {
    path: '/network-monitoring/v1alpha1/aps/{serial}/tunnels/{tunnel_id}',
    method: 'GET',
    description: 'Get AP tunnel details',
    params: {},
    notes: 'Replace {serial} and {tunnel_id} with actual values',
    category: 'Access Points'
  },
  {
    path: '/network-monitoring/v1alpha1/aps/{serial}/tunnels/{tunnel_id}/throughput',
    method: 'GET',
    description: 'Get AP tunnel throughput trend',
    params: { interval: '5m', duration: '1h' },
    notes: 'Replace {serial} and {tunnel_id} with actual values',
    category: 'Access Points'
  },
  {
    path: '/network-monitoring/v1alpha1/aps/{serial}/tunnels/{tunnel_id}/packet-loss',
    method: 'GET',
    description: 'Get AP tunnel packet loss trend',
    params: { interval: '5m', duration: '1h' },
    notes: 'Replace {serial} and {tunnel_id} with actual values',
    category: 'Access Points'
  },
  {
    path: '/network-monitoring/v1alpha1/aps/{serial}/tunnels/{tunnel_id}/jitter',
    method: 'GET',
    description: 'Get AP tunnel jitter trend',
    params: { interval: '5m', duration: '1h' },
    notes: 'Replace {serial} and {tunnel_id} with actual values',
    category: 'Access Points'
  },
  {
    path: '/network-monitoring/v1alpha1/aps/{serial}/tunnels/{tunnel_id}/latency',
    method: 'GET',
    description: 'Get AP tunnel latency trend',
    params: { interval: '5m', duration: '1h' },
    notes: 'Replace {serial} and {tunnel_id} with actual values',
    category: 'Access Points'
  },
  {
    path: '/network-monitoring/v1alpha1/aps/{serial}/tunnels/{tunnel_id}/mos',
    method: 'GET',
    description: 'Get AP tunnel MOS score trend',
    params: { interval: '5m', duration: '1h' },
    notes: 'Replace {serial} and {tunnel_id} with actual values',
    category: 'Access Points'
  },
  {
    path: '/network-monitoring/v1alpha1/radios',
    method: 'GET',
    description: 'Get all radios',
    params: { limit: 20 },
    notes: 'Get list of all AP radios',
    category: 'Access Points'
  },
  {
    path: '/network-monitoring/v1alpha1/wlans/{wlan_name}',
    method: 'GET',
    description: 'Get specific WLAN by name',
    params: {},
    notes: 'Replace {wlan_name} with actual WLAN/SSID name',
    category: 'WLANs'
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
  {
    path: '/network-monitoring/v1alpha1/switch/{serial}/stack/{stack_id}',
    method: 'GET',
    description: 'Get switch stack member details',
    params: {},
    notes: 'Replace {serial} and {stack_id} with actual values',
    category: 'Switches'
  },
  {
    path: '/network-monitoring/v1alpha1/switch/{serial}/hardware',
    method: 'GET',
    description: 'Get switch hardware details',
    params: {},
    notes: 'Replace {serial} with actual switch serial number',
    category: 'Switches'
  },
  {
    path: '/network-monitoring/v1alpha1/switch/{serial}/lag',
    method: 'GET',
    description: 'Get switch LAG summary',
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
  {
    path: '/network-monitoring/v1alpha1/gateways/{serial}/cluster/leader',
    method: 'GET',
    description: 'Get gateway cluster leader details',
    params: {},
    notes: 'Replace {serial} with actual gateway serial number',
    category: 'Gateways'
  },
  {
    path: '/network-monitoring/v1alpha1/gateways/{serial}/cluster/vlan-mismatch',
    method: 'GET',
    description: 'Get gateway cluster VLAN mismatch summary',
    params: {},
    notes: 'Replace {serial} with actual gateway serial number',
    category: 'Gateways'
  },
  {
    path: '/network-monitoring/v1alpha1/gateways/{serial}/cluster/connectivity',
    method: 'GET',
    description: 'Get gateway cluster connectivity graph',
    params: {},
    notes: 'Replace {serial} with actual gateway serial number',
    category: 'Gateways'
  },
  {
    path: '/network-monitoring/v1alpha1/gateways/{serial}/vlans/{vlan_id}',
    method: 'GET',
    description: 'Get gateway VLAN detail',
    params: {},
    notes: 'Replace {serial} and {vlan_id} with actual values',
    category: 'Gateways'
  },
  {
    path: '/network-monitoring/v1alpha1/gateways/{serial}/cluster/members',
    method: 'GET',
    description: 'Get gateway cluster members',
    params: {},
    notes: 'Replace {serial} with actual gateway serial number',
    category: 'Gateways'
  },
  {
    path: '/network-monitoring/v1alpha1/gateways/{serial}/tunnels/{tunnel_id}',
    method: 'GET',
    description: 'Get gateway tunnel detail',
    params: {},
    notes: 'Replace {serial} and {tunnel_id} with actual values',
    category: 'Gateways'
  },
  {
    path: '/network-monitoring/v1alpha1/gateways/{serial}/interfaces/wired',
    method: 'GET',
    description: 'Get gateway wired interfaces',
    params: {},
    notes: 'Replace {serial} with actual gateway serial number',
    category: 'Gateways'
  },
  {
    path: '/network-monitoring/v1alpha1/gateways/{serial}/cluster/tunnels',
    method: 'GET',
    description: 'Get gateway cluster tunnels',
    params: {},
    notes: 'Replace {serial} with actual gateway serial number',
    category: 'Gateways'
  },
  {
    path: '/network-monitoring/v1alpha1/gateways/{serial}/vlans',
    method: 'GET',
    description: 'Get gateway VLANs',
    params: {},
    notes: 'Replace {serial} with actual gateway serial number',
    category: 'Gateways'
  },
  {
    path: '/network-monitoring/v1alpha1/gateways/{serial}/tunnels/lan',
    method: 'GET',
    description: 'Get gateway LAN tunnels',
    params: {},
    notes: 'Replace {serial} with actual gateway serial number',
    category: 'Gateways'
  },
  {
    path: '/network-monitoring/v1alpha1/gateways/{serial}/interfaces/wan',
    method: 'GET',
    description: 'Get gateway WAN interfaces',
    params: {},
    notes: 'Replace {serial} with actual gateway serial number',
    category: 'Gateways'
  },
  {
    path: '/network-monitoring/v1alpha1/gateways/{serial}/cpu-utilization-trends',
    method: 'GET',
    description: 'Get gateway CPU utilization trends',
    params: { interval: '5m', duration: '1h' },
    notes: 'Replace {serial} with actual gateway serial number',
    category: 'Gateways'
  },
  {
    path: '/network-monitoring/v1alpha1/gateways/{serial}/memory-utilization-trends',
    method: 'GET',
    description: 'Get gateway memory utilization trends',
    params: { interval: '5m', duration: '1h' },
    notes: 'Replace {serial} with actual gateway serial number',
    category: 'Gateways'
  },
  {
    path: '/network-monitoring/v1alpha1/gateways/{serial}/tunnels/lan/{tunnel_id}/throughput',
    method: 'GET',
    description: 'Get gateway LAN tunnel throughput trend',
    params: { interval: '5m', duration: '1h' },
    notes: 'Replace {serial} and {tunnel_id} with actual values',
    category: 'Gateways'
  },
  {
    path: '/network-monitoring/v1alpha1/gateways/{serial}/tunnels/wan/{tunnel_id}/throughput',
    method: 'GET',
    description: 'Get gateway WAN tunnel throughput trend',
    params: { interval: '5m', duration: '1h' },
    notes: 'Replace {serial} and {tunnel_id} with actual values',
    category: 'Gateways'
  },
  {
    path: '/network-monitoring/v1alpha1/gateways/{serial}/tunnels/lan/{tunnel_id}/status',
    method: 'GET',
    description: 'Get gateway LAN tunnel status trend',
    params: { interval: '5m', duration: '1h' },
    notes: 'Replace {serial} and {tunnel_id} with actual values',
    category: 'Gateways'
  },
  {
    path: '/network-monitoring/v1alpha1/gateways/{serial}/tunnels/wan/{tunnel_id}/status',
    method: 'GET',
    description: 'Get gateway WAN tunnel status trend',
    params: { interval: '5m', duration: '1h' },
    notes: 'Replace {serial} and {tunnel_id} with actual values',
    category: 'Gateways'
  },
  {
    path: '/network-monitoring/v1alpha1/gateways/{serial}/cluster/capacity-trends',
    method: 'GET',
    description: 'Get gateway cluster capacity trend',
    params: { interval: '5m', duration: '1h' },
    notes: 'Replace {serial} with actual gateway serial number',
    category: 'Gateways'
  },
  {
    path: '/network-monitoring/v1alpha1/gateways/{serial}/cluster/members/{member_id}/capacity-trends',
    method: 'GET',
    description: 'Get gateway cluster member capacity trend',
    params: { interval: '5m', duration: '1h' },
    notes: 'Replace {serial} and {member_id} with actual values',
    category: 'Gateways'
  },
  {
    path: '/network-monitoring/v1alpha1/gateways/{serial}/interfaces/{interface_id}/throughput',
    method: 'GET',
    description: 'Get gateway interface throughput trend',
    params: { interval: '5m', duration: '1h' },
    notes: 'Replace {serial} and {interface_id} with actual values',
    category: 'Gateways'
  },
  {
    path: '/network-monitoring/v1alpha1/gateways/{serial}/cluster/tunnels/health',
    method: 'GET',
    description: 'Get gateway cluster tunnel health summary',
    params: {},
    notes: 'Replace {serial} with actual gateway serial number',
    category: 'Gateways'
  },
  {
    path: '/network-monitoring/v1alpha1/gateways/{serial}/cluster/tunnels/status',
    method: 'GET',
    description: 'Get gateway cluster tunnel status summary',
    params: {},
    notes: 'Replace {serial} with actual gateway serial number',
    category: 'Gateways'
  },
  {
    path: '/network-monitoring/v1alpha1/gateways/{serial}/tunnels/health',
    method: 'GET',
    description: 'Get gateway tunnel health summary',
    params: {},
    notes: 'Replace {serial} with actual gateway serial number',
    category: 'Gateways'
  },
  {
    path: '/network-monitoring/v1alpha1/gateways/{serial}/wan/availability-trends',
    method: 'GET',
    description: 'Get gateway WAN availability trend',
    params: { interval: '5m', duration: '1h' },
    notes: 'Replace {serial} with actual gateway serial number',
    category: 'Gateways'
  },
  {
    path: '/network-monitoring/v1alpha1/gateways/{serial}/vpn/availability-trends',
    method: 'GET',
    description: 'Get gateway VPN availability trend',
    params: { interval: '5m', duration: '1h' },
    notes: 'Replace {serial} with actual gateway serial number',
    category: 'Gateways'
  },
  {
    path: '/network-monitoring/v1alpha1/gateways/{serial}/ports/{port_id}/frames',
    method: 'GET',
    description: 'Get gateway port frames trend',
    params: { interval: '5m', duration: '1h' },
    notes: 'Replace {serial} and {port_id} with actual values',
    category: 'Gateways'
  },
  {
    path: '/network-monitoring/v1alpha1/gateways/{serial}/ports/{port_id}/frames/errors',
    method: 'GET',
    description: 'Get gateway port frames errors trend',
    params: { interval: '5m', duration: '1h' },
    notes: 'Replace {serial} and {port_id} with actual values',
    category: 'Gateways'
  },
  {
    path: '/network-monitoring/v1alpha1/gateways/{serial}/ports/{port_id}/frames/packets',
    method: 'GET',
    description: 'Get gateway port frames packets trend',
    params: { interval: '5m', duration: '1h' },
    notes: 'Replace {serial} and {port_id} with actual values',
    category: 'Gateways'
  },
  {
    path: '/network-monitoring/v1alpha1/gateways/{serial}/tunnels/{tunnel_id}/dropped-packets',
    method: 'GET',
    description: 'Get gateway tunnel dropped packets trend',
    params: { interval: '5m', duration: '1h' },
    notes: 'Replace {serial} and {tunnel_id} with actual values',
    category: 'Gateways'
  },
  {
    path: '/network-monitoring/v1alpha1/gateways/{serial}/tunnels/wan',
    method: 'GET',
    description: 'Get gateway WAN tunnels',
    params: {},
    notes: 'Replace {serial} with actual gateway serial number',
    category: 'Gateways'
  },
  {
    path: '/network-monitoring/v1alpha1/gateways/{serial}/tunnels/wan/{tunnel_id}',
    method: 'GET',
    description: 'Get gateway WAN tunnel detail',
    params: {},
    notes: 'Replace {serial} and {tunnel_id} with actual values',
    category: 'Gateways'
  },
  {
    path: '/network-monitoring/v1alpha1/gateways/{serial}/tunnels/wan/health',
    method: 'GET',
    description: 'Get gateway WAN tunnel health summary',
    params: {},
    notes: 'Replace {serial} with actual gateway serial number',
    category: 'Gateways'
  },
  {
    path: '/network-monitoring/v1alpha1/gateways/{serial}/uplinks/{uplink_id}',
    method: 'GET',
    description: 'Get gateway uplink details',
    params: {},
    notes: 'Replace {serial} and {uplink_id} with actual values',
    category: 'Gateways'
  },
  {
    path: '/network-monitoring/v1alpha1/gateways/{serial}/uplinks/{uplink_id}/throughput',
    method: 'GET',
    description: 'Get gateway uplink throughput trend',
    params: { interval: '5m', duration: '1h' },
    notes: 'Replace {serial} and {uplink_id} with actual values',
    category: 'Gateways'
  },
  {
    path: '/network-monitoring/v1alpha1/gateways/{serial}/uplinks/{uplink_id}/compression',
    method: 'GET',
    description: 'Get gateway uplink WAN compression trends',
    params: { interval: '5m', duration: '1h' },
    notes: 'Replace {serial} and {uplink_id} with actual values',
    category: 'Gateways'
  },
  {
    path: '/network-monitoring/v1alpha1/gateways/{serial}/uplinks/{uplink_id}/probes',
    method: 'GET',
    description: 'Get gateway uplink probes',
    params: {},
    notes: 'Replace {serial} and {uplink_id} with actual values',
    category: 'Gateways'
  },
  {
    path: '/network-monitoring/v1alpha1/gateways/{serial}/uplinks/{uplink_id}/probes/{probe_id}/performance',
    method: 'GET',
    description: 'Get gateway uplink probe performance trends',
    params: { interval: '5m', duration: '1h' },
    notes: 'Replace {serial}, {uplink_id}, and {probe_id} with actual values',
    category: 'Gateways'
  },
  {
    path: '/network-monitoring/v1alpha1/gateways/{serial}/uplinks/{uplink_id}/modem-stats',
    method: 'GET',
    description: 'Get gateway uplink modem stats',
    params: {},
    notes: 'Replace {serial} and {uplink_id} with actual values',
    category: 'Gateways'
  },
  {
    path: '/network-monitoring/v1alpha1/gateways/{serial}/uplinks/{uplink_id}/wan-availability',
    method: 'GET',
    description: 'Get gateway uplink WAN availability trends',
    params: { interval: '5m', duration: '1h' },
    notes: 'Replace {serial} and {uplink_id} with actual values',
    category: 'Gateways'
  },
  {
    path: '/network-monitoring/v1alpha1/gateways/{serial}/uplinks/{uplink_id}/vpn-availability',
    method: 'GET',
    description: 'Get gateway uplink VPN availability trends',
    params: { interval: '5m', duration: '1h' },
    notes: 'Replace {serial} and {uplink_id} with actual values',
    category: 'Gateways'
  },
  {
    path: '/network-monitoring/v1alpha1/gateways/{serial}/uplinks/{uplink_id}/bandwidth',
    method: 'GET',
    description: 'Get gateway uplink aggregated bandwidth usage',
    params: {},
    notes: 'Replace {serial} and {uplink_id} with actual values',
    category: 'Gateways'
  },
  {
    path: '/network-monitoring/v1alpha1/gateways/{serial}/ports/{port_id}/bandwidth',
    method: 'GET',
    description: 'Get gateway port aggregated bandwidth usage',
    params: {},
    notes: 'Replace {serial} and {port_id} with actual values',
    category: 'Gateways'
  },
  {
    path: '/network-monitoring/v1alpha1/gateways/{serial}/tunnels/lan/{tunnel_id}/bandwidth',
    method: 'GET',
    description: 'Get gateway LAN tunnel aggregated bandwidth usage',
    params: {},
    notes: 'Replace {serial} and {tunnel_id} with actual values',
    category: 'Gateways'
  },
  {
    path: '/network-monitoring/v1alpha1/gateways/{serial}/tunnels/wan/{tunnel_id}/bandwidth',
    method: 'GET',
    description: 'Get gateway WAN tunnel aggregated bandwidth usage',
    params: {},
    notes: 'Replace {serial} and {tunnel_id} with actual values',
    category: 'Gateways'
  },
  {
    path: '/network-monitoring/v1alpha1/gateways/{serial}/hardware/temperature-trends',
    method: 'GET',
    description: 'Get gateway hardware temperature trends',
    params: { interval: '5m', duration: '1h' },
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
  {
    path: '/network-monitoring/v1alpha1/idps/threats',
    method: 'GET',
    description: 'Get IDPS threats',
    params: { limit: 100 },
    notes: 'Get list of IDPS threats. Optional: limit',
    category: 'Security'
  },
  {
    path: '/network-monitoring/v1alpha1/idps/threats/{threat_id}',
    method: 'GET',
    description: 'Get IDPS threat details',
    params: {},
    notes: 'Replace {threat_id} with actual threat ID',
    category: 'Security'
  },
  {
    path: '/network-monitoring/v1alpha1/firewall/sessions/blocked',
    method: 'GET',
    description: 'Get blocked firewall session logs',
    params: { limit: 100 },
    notes: 'Get blocked firewall sessions. Optional: gateway_serial, limit',
    category: 'Security'
  },
  {
    path: '/network-monitoring/v1alpha1/firewall/sessions/clients',
    method: 'GET',
    description: 'Get client firewall session logs',
    params: { limit: 100 },
    notes: 'Get client firewall sessions. Optional: gateway_serial, limit',
    category: 'Security'
  },
  {
    path: '/network-monitoring/v1alpha1/firewall/clients',
    method: 'GET',
    description: 'Get firewall clients list',
    params: { limit: 100 },
    notes: 'Get list of firewall clients. Optional: gateway_serial, limit',
    category: 'Security'
  },
  
  // ========== Troubleshooting ==========
  {
    path: '/troubleshooting/v1alpha1/switches/{serial}/ping',
    method: 'POST',
    description: 'Initiate Ping test on AOS-S Switch',
    params: {},
    body: { target: '8.8.8.8', count: 4 },
    notes: 'Replace {serial} with switch serial. Body: {target, count}',
    category: 'Troubleshooting'
  },
  {
    path: '/troubleshooting/v1alpha1/switches/{serial}/ping/{test_id}',
    method: 'GET',
    description: 'Get AOS-S Switch Ping test status and results',
    params: {},
    notes: 'Replace {serial} and {test_id} with actual values',
    category: 'Troubleshooting'
  },
  {
    path: '/troubleshooting/v1alpha1/switches/{serial}/traceroute',
    method: 'POST',
    description: 'Initiate Traceroute test on AOS-S Switch',
    params: {},
    body: { target: '8.8.8.8' },
    notes: 'Replace {serial} with switch serial. Body: {target}',
    category: 'Troubleshooting'
  },
  {
    path: '/troubleshooting/v1alpha1/switches/{serial}/traceroute/{test_id}',
    method: 'GET',
    description: 'Get AOS-S Switch Traceroute test status and results',
    params: {},
    notes: 'Replace {serial} and {test_id} with actual values',
    category: 'Troubleshooting'
  },
  {
    path: '/troubleshooting/v1alpha1/switches/{serial}/poe-bounce',
    method: 'POST',
    description: 'Initiate PoE Bounce test on AOS-S Switch',
    params: {},
    body: { port: '1/1' },
    notes: 'Replace {serial} with switch serial. Body: {port}',
    category: 'Troubleshooting'
  },
  {
    path: '/troubleshooting/v1alpha1/switches/{serial}/poe-bounce/{test_id}',
    method: 'GET',
    description: 'Get AOS-S Switch PoE Bounce test status and results',
    params: {},
    notes: 'Replace {serial} and {test_id} with actual values',
    category: 'Troubleshooting'
  },
  {
    path: '/troubleshooting/v1alpha1/switches/{serial}/port-bounce',
    method: 'POST',
    description: 'Initiate Port Bounce test on AOS-S Switch',
    params: {},
    body: { port: '1/1' },
    notes: 'Replace {serial} with switch serial. Body: {port}',
    category: 'Troubleshooting'
  },
  {
    path: '/troubleshooting/v1alpha1/switches/{serial}/port-bounce/{test_id}',
    method: 'GET',
    description: 'Get AOS-S Switch Port Bounce test status and results',
    params: {},
    notes: 'Replace {serial} and {test_id} with actual values',
    category: 'Troubleshooting'
  },
  {
    path: '/troubleshooting/v1alpha1/switches/{serial}/cable-test',
    method: 'POST',
    description: 'Initiate Cable Test on AOS-S Switch',
    params: {},
    body: { port: '1/1' },
    notes: 'Replace {serial} with switch serial. Body: {port}',
    category: 'Troubleshooting'
  },
  {
    path: '/troubleshooting/v1alpha1/switches/{serial}/cable-test/{test_id}',
    method: 'GET',
    description: 'Get AOS-S Switch Cable Test status and results',
    params: {},
    notes: 'Replace {serial} and {test_id} with actual values',
    category: 'Troubleshooting'
  },
  {
    path: '/troubleshooting/v1alpha1/switches/{serial}/arp-table',
    method: 'POST',
    description: 'Initiate Get Arp Table test on AOS-S Switch',
    params: {},
    body: {},
    notes: 'Replace {serial} with switch serial',
    category: 'Troubleshooting'
  },
  {
    path: '/troubleshooting/v1alpha1/switches/{serial}/arp-table/{test_id}',
    method: 'GET',
    description: 'Get AOS-S Switch Arp Table test status and results',
    params: {},
    notes: 'Replace {serial} and {test_id} with actual values',
    category: 'Troubleshooting'
  },
  {
    path: '/troubleshooting/v1alpha1/switches/{serial}/show-commands',
    method: 'GET',
    description: 'List show commands (AOS-S - top commands)',
    params: {},
    notes: 'Replace {serial} with switch serial',
    category: 'Troubleshooting'
  },
  {
    path: '/troubleshooting/v1alpha1/switches/{serial}/show-commands',
    method: 'POST',
    description: 'Run a show command (AOS-S)',
    params: {},
    body: { command: 'show version' },
    notes: 'Replace {serial} with switch serial. Body: {command}',
    category: 'Troubleshooting'
  },
  {
    path: '/troubleshooting/v1alpha1/switches/{serial}/show-commands/{test_id}',
    method: 'GET',
    description: 'Get show command status/result (AOS-S)',
    params: {},
    notes: 'Replace {serial} and {test_id} with actual values',
    category: 'Troubleshooting'
  },
  {
    path: '/troubleshooting/v1alpha1/switches/{serial}/reboot',
    method: 'POST',
    description: 'Reboot a AOS-S Switch',
    params: {},
    body: {},
    notes: 'Replace {serial} with switch serial',
    category: 'Troubleshooting'
  },
  {
    path: '/troubleshooting/v1alpha1/switches/{serial}/locate',
    method: 'POST',
    description: 'Locate a AOS-S Switch',
    params: {},
    body: { enable: true },
    notes: 'Replace {serial} with switch serial. Body: {enable}',
    category: 'Troubleshooting'
  },
  {
    path: '/troubleshooting/v1alpha1/aps/{serial}/ping',
    method: 'POST',
    description: 'Initiate Ping test on AP',
    params: {},
    body: { target: '8.8.8.8', count: 4 },
    notes: 'Replace {serial} with AP serial. Body: {target, count}',
    category: 'Troubleshooting'
  },
  {
    path: '/troubleshooting/v1alpha1/aps/{serial}/ping/{test_id}',
    method: 'GET',
    description: 'Get AP Ping test status and results',
    params: {},
    notes: 'Replace {serial} and {test_id} with actual values',
    category: 'Troubleshooting'
  },
  {
    path: '/troubleshooting/v1alpha1/aps/{serial}/traceroute',
    method: 'POST',
    description: 'Initiate Traceroute test on AP',
    params: {},
    body: { target: '8.8.8.8' },
    notes: 'Replace {serial} with AP serial. Body: {target}',
    category: 'Troubleshooting'
  },
  {
    path: '/troubleshooting/v1alpha1/aps/{serial}/traceroute/{test_id}',
    method: 'GET',
    description: 'Get AP Traceroute test status and results',
    params: {},
    notes: 'Replace {serial} and {test_id} with actual values',
    category: 'Troubleshooting'
  },
  {
    path: '/troubleshooting/v1alpha1/aps/{serial}/speedtest',
    method: 'POST',
    description: 'Initiate Speedtest on AP',
    params: {},
    body: { server: 'speedtest.net' },
    notes: 'Replace {serial} with AP serial. Body: {server}',
    category: 'Troubleshooting'
  },
  {
    path: '/troubleshooting/v1alpha1/aps/{serial}/speedtest/{test_id}',
    method: 'GET',
    description: 'Get AP Speedtest status and results',
    params: {},
    notes: 'Replace {serial} and {test_id} with actual values',
    category: 'Troubleshooting'
  },
  {
    path: '/troubleshooting/v1alpha1/aps/{serial}/http-test',
    method: 'POST',
    description: 'Initiate HTTP test on AP',
    params: {},
    body: { url: 'http://example.com' },
    notes: 'Replace {serial} with AP serial. Body: {url}',
    category: 'Troubleshooting'
  },
  {
    path: '/troubleshooting/v1alpha1/aps/{serial}/http-test/{test_id}',
    method: 'GET',
    description: 'Get AP HTTP test status and results',
    params: {},
    notes: 'Replace {serial} and {test_id} with actual values',
    category: 'Troubleshooting'
  },
  {
    path: '/troubleshooting/v1alpha1/aps/{serial}/https-test',
    method: 'POST',
    description: 'Initiate HTTPS test on AP',
    params: {},
    body: { url: 'https://example.com' },
    notes: 'Replace {serial} with AP serial. Body: {url}',
    category: 'Troubleshooting'
  },
  {
    path: '/troubleshooting/v1alpha1/aps/{serial}/https-test/{test_id}',
    method: 'GET',
    description: 'Get AP HTTPS test status and results',
    params: {},
    notes: 'Replace {serial} and {test_id} with actual values',
    category: 'Troubleshooting'
  },
  {
    path: '/troubleshooting/v1alpha1/aps/{serial}/tcp-test',
    method: 'POST',
    description: 'Initiate TCP test on AP',
    params: {},
    body: { host: 'example.com', port: 80 },
    notes: 'Replace {serial} with AP serial. Body: {host, port}',
    category: 'Troubleshooting'
  },
  {
    path: '/troubleshooting/v1alpha1/aps/{serial}/tcp-test/{test_id}',
    method: 'GET',
    description: 'Get AP TCP test status and results',
    params: {},
    notes: 'Replace {serial} and {test_id} with actual values',
    category: 'Troubleshooting'
  },
  {
    path: '/troubleshooting/v1alpha1/aps/{serial}/arp-table',
    method: 'POST',
    description: 'Initiate Get Arp Table test on AP',
    params: {},
    body: {},
    notes: 'Replace {serial} with AP serial',
    category: 'Troubleshooting'
  },
  {
    path: '/troubleshooting/v1alpha1/aps/{serial}/arp-table/{test_id}',
    method: 'GET',
    description: 'Get AP Arp Table test status and results',
    params: {},
    notes: 'Replace {serial} and {test_id} with actual values',
    category: 'Troubleshooting'
  },
  {
    path: '/troubleshooting/v1alpha1/aps/{serial}/nslookup',
    method: 'POST',
    description: 'Initiate Nslookup test on AP',
    params: {},
    body: { hostname: 'example.com' },
    notes: 'Replace {serial} with AP serial. Body: {hostname}',
    category: 'Troubleshooting'
  },
  {
    path: '/troubleshooting/v1alpha1/aps/{serial}/nslookup/{test_id}',
    method: 'GET',
    description: 'Get AP Nslookup test status and results',
    params: {},
    notes: 'Replace {serial} and {test_id} with actual values',
    category: 'Troubleshooting'
  },
  {
    path: '/troubleshooting/v1alpha1/aps/{serial}/aaa-test',
    method: 'POST',
    description: 'Initiate AAA test on AP',
    params: {},
    body: { username: 'test', password: 'test' },
    notes: 'Replace {serial} with AP serial. Body: {username, password}',
    category: 'Troubleshooting'
  },
  {
    path: '/troubleshooting/v1alpha1/aps/{serial}/aaa-test/{test_id}',
    method: 'GET',
    description: 'Get AP AAA test status and results',
    params: {},
    notes: 'Replace {serial} and {test_id} with actual values',
    category: 'Troubleshooting'
  },
  {
    path: '/troubleshooting/v1alpha1/aps/{serial}/show-commands',
    method: 'GET',
    description: 'List show commands (AP - top commands)',
    params: {},
    notes: 'Replace {serial} with AP serial',
    category: 'Troubleshooting'
  },
  {
    path: '/troubleshooting/v1alpha1/aps/{serial}/show-commands',
    method: 'POST',
    description: 'Run a show command (AP)',
    params: {},
    body: { command: 'show version' },
    notes: 'Replace {serial} with AP serial. Body: {command}',
    category: 'Troubleshooting'
  },
  {
    path: '/troubleshooting/v1alpha1/aps/{serial}/show-commands/{test_id}',
    method: 'GET',
    description: 'Get show command status/result (AP)',
    params: {},
    notes: 'Replace {serial} and {test_id} with actual values',
    category: 'Troubleshooting'
  },
  {
    path: '/troubleshooting/v1alpha1/aps/{serial}/reboot',
    method: 'POST',
    description: 'Reboot an Access Point',
    params: {},
    body: {},
    notes: 'Replace {serial} with AP serial',
    category: 'Troubleshooting'
  },
  {
    path: '/troubleshooting/v1alpha1/aps/{serial}/locate',
    method: 'POST',
    description: 'Locate an Access Point',
    params: {},
    body: { enable: true },
    notes: 'Replace {serial} with AP serial. Body: {enable}',
    category: 'Troubleshooting'
  },
  {
    path: '/troubleshooting/v1alpha1/aps/{serial}/disconnect-all',
    method: 'POST',
    description: 'Disconnect all users from an Access Point',
    params: {},
    body: {},
    notes: 'Replace {serial} with AP serial',
    category: 'Troubleshooting'
  },
  {
    path: '/troubleshooting/v1alpha1/aps/{serial}/disconnect-user',
    method: 'POST',
    description: 'Disconnect a specific user by MAC address from an Access Point',
    params: {},
    body: { mac: '00:11:22:33:44:55' },
    notes: 'Replace {serial} with AP serial. Body: {mac}',
    category: 'Troubleshooting'
  },
  {
    path: '/troubleshooting/v1alpha1/aps/{serial}/disconnect-wlan',
    method: 'POST',
    description: 'Disconnect all users from a specific network (SSID) on an Access Point',
    params: {},
    body: { ssid: 'MyNetwork' },
    notes: 'Replace {serial} with AP serial. Body: {ssid}',
    category: 'Troubleshooting'
  },
  // ========== CX Switches Troubleshooting ==========
  {
    path: '/network-troubleshooting/v1alpha1/cx/{serial-number}/ping',
    method: 'POST',
    description: 'Initiate a Ping test on a CX Switch',
    params: {},
    body: { destination: '8.8.8.8' },
    notes: 'Replace {serial-number} with CX switch serial. Body: {destination}. Reference: https://developer.arubanetworks.com/new-central/reference/initiatecxping',
    category: 'Troubleshooting'
  },
  {
    path: '/network-troubleshooting/v1alpha1/cx/{serial-number}/ping/async-operations/{task-id}',
    method: 'GET',
    description: 'Get CX Switch Ping test status and results',
    params: {},
    notes: 'Replace {serial-number} and {task-id} with actual values',
    category: 'Troubleshooting'
  },
  {
    path: '/network-troubleshooting/v1alpha1/cx/{serial-number}/traceroute',
    method: 'POST',
    description: 'Initiate a Traceroute test on a CX Switch',
    params: {},
    body: { destination: '8.8.8.8' },
    notes: 'Replace {serial-number} with CX switch serial. Body: {destination}',
    category: 'Troubleshooting'
  },
  {
    path: '/network-troubleshooting/v1alpha1/cx/{serial-number}/traceroute/async-operations/{task-id}',
    method: 'GET',
    description: 'Get CX Switch Traceroute test status and results',
    params: {},
    notes: 'Replace {serial-number} and {task-id} with actual values',
    category: 'Troubleshooting'
  },
  {
    path: '/network-troubleshooting/v1alpha1/cx/{serial-number}/poeBounce',
    method: 'POST',
    description: 'Initiate a PoE Bounce test on a CX Switch',
    params: {},
    body: { port: '1/1' },
    notes: 'Replace {serial-number} with CX switch serial. Body: {port}',
    category: 'Troubleshooting'
  },
  {
    path: '/network-troubleshooting/v1alpha1/cx/{serial-number}/poeBounce/async-operations/{task-id}',
    method: 'GET',
    description: 'Get CX Switch PoE Bounce test status and results',
    params: {},
    notes: 'Replace {serial-number} and {task-id} with actual values',
    category: 'Troubleshooting'
  },
  {
    path: '/network-troubleshooting/v1alpha1/cx/{serial-number}/portBounce',
    method: 'POST',
    description: 'Initiate a Port Bounce test on a CX Switch',
    params: {},
    body: { port: '1/1' },
    notes: 'Replace {serial-number} with CX switch serial. Body: {port}',
    category: 'Troubleshooting'
  },
  {
    path: '/network-troubleshooting/v1alpha1/cx/{serial-number}/portBounce/async-operations/{task-id}',
    method: 'GET',
    description: 'Get CX Switch Port Bounce test status and results',
    params: {},
    notes: 'Replace {serial-number} and {task-id} with actual values',
    category: 'Troubleshooting'
  },
  {
    path: '/network-troubleshooting/v1alpha1/cx/{serial-number}/cableTest',
    method: 'POST',
    description: 'Initiate a Cable Test on a CX Switch',
    params: {},
    body: { port: '1/1' },
    notes: 'Replace {serial-number} with CX switch serial. Body: {port}',
    category: 'Troubleshooting'
  },
  {
    path: '/network-troubleshooting/v1alpha1/cx/{serial-number}/cableTest/async-operations/{task-id}',
    method: 'GET',
    description: 'Get CX Switch Cable Test status and results',
    params: {},
    notes: 'Replace {serial-number} and {task-id} with actual values',
    category: 'Troubleshooting'
  },
  {
    path: '/network-troubleshooting/v1alpha1/cx/{serial-number}/httpTest',
    method: 'POST',
    description: 'Initiate a Http test on a CX Switch',
    params: {},
    body: { url: 'http://example.com' },
    notes: 'Replace {serial-number} with CX switch serial. Body: {url}',
    category: 'Troubleshooting'
  },
  {
    path: '/network-troubleshooting/v1alpha1/cx/{serial-number}/httpTest/async-operations/{task-id}',
    method: 'GET',
    description: 'Get CX Switch Http test status and results',
    params: {},
    notes: 'Replace {serial-number} and {task-id} with actual values',
    category: 'Troubleshooting'
  },
  {
    path: '/network-troubleshooting/v1alpha1/cx/{serial-number}/aaaTest',
    method: 'POST',
    description: 'Initiate a Aaa test on a CX Switch',
    params: {},
    body: { username: 'test', password: 'test' },
    notes: 'Replace {serial-number} with CX switch serial. Body: {username, password}',
    category: 'Troubleshooting'
  },
  {
    path: '/network-troubleshooting/v1alpha1/cx/{serial-number}/aaaTest/async-operations/{task-id}',
    method: 'GET',
    description: 'Get CX Switch Aaa test status and results',
    params: {},
    notes: 'Replace {serial-number} and {task-id} with actual values',
    category: 'Troubleshooting'
  },
  {
    path: '/network-troubleshooting/v1alpha1/cx/{serial-number}/showCommand',
    method: 'GET',
    description: 'List show commands (CX - strict supported list)',
    params: {},
    notes: 'Replace {serial-number} with CX switch serial',
    category: 'Troubleshooting'
  },
  {
    path: '/network-troubleshooting/v1alpha1/cx/{serial-number}/showCommand',
    method: 'POST',
    description: 'Run a show command (CX)',
    params: {},
    body: { command: 'show version' },
    notes: 'Replace {serial-number} with CX switch serial. Body: {command}',
    category: 'Troubleshooting'
  },
  {
    path: '/network-troubleshooting/v1alpha1/cx/{serial-number}/showCommand/async-operations/{task-id}',
    method: 'GET',
    description: 'Get show command status/result (CX)',
    params: {},
    notes: 'Replace {serial-number} and {task-id} with actual values',
    category: 'Troubleshooting'
  },
  {
    path: '/network-troubleshooting/v1alpha1/cx/{serial-number}/locate',
    method: 'POST',
    description: 'Locate a CX Switch',
    params: {},
    body: { enable: true },
    notes: 'Replace {serial-number} with CX switch serial. Body: {enable}',
    category: 'Troubleshooting'
  },
  {
    path: '/network-troubleshooting/v1alpha1/cx/{serial-number}/reboot',
    method: 'POST',
    description: 'Reboot a CX Switch',
    params: {},
    body: {},
    notes: 'Replace {serial-number} with CX switch serial',
    category: 'Troubleshooting'
  },
  {
    path: '/troubleshooting/v1alpha1/gateways/{serial}/ping',
    method: 'POST',
    description: 'Initiate Ping test on Gateway',
    params: {},
    body: { target: '8.8.8.8', count: 4 },
    notes: 'Replace {serial} with gateway serial. Body: {target, count}',
    category: 'Troubleshooting'
  },
  {
    path: '/troubleshooting/v1alpha1/gateways/{serial}/ping/{test_id}',
    method: 'GET',
    description: 'Get Gateway Ping test status and results',
    params: {},
    notes: 'Replace {serial} and {test_id} with actual values',
    category: 'Troubleshooting'
  },
  {
    path: '/troubleshooting/v1alpha1/gateways/{serial}/ping-mtu-sweep',
    method: 'POST',
    description: 'Run PingMtuSweep (Gateway)',
    params: {},
    body: { target: '8.8.8.8' },
    notes: 'Replace {serial} with gateway serial. Body: {target}',
    category: 'Troubleshooting'
  },
  {
    path: '/troubleshooting/v1alpha1/gateways/{serial}/ping-mtu-sweep/{test_id}',
    method: 'GET',
    description: 'Get PingMtuSweep status/result (Gateway)',
    params: {},
    notes: 'Replace {serial} and {test_id} with actual values',
    category: 'Troubleshooting'
  },
  {
    path: '/troubleshooting/v1alpha1/gateways/{serial}/traceroute',
    method: 'POST',
    description: 'Initiate Traceroute test on Gateway',
    params: {},
    body: { target: '8.8.8.8' },
    notes: 'Replace {serial} with gateway serial. Body: {target}',
    category: 'Troubleshooting'
  },
  {
    path: '/troubleshooting/v1alpha1/gateways/{serial}/traceroute/{test_id}',
    method: 'GET',
    description: 'Get Gateway Traceroute test status and results',
    params: {},
    notes: 'Replace {serial} and {test_id} with actual values',
    category: 'Troubleshooting'
  },
  {
    path: '/troubleshooting/v1alpha1/gateways/{serial}/poe-bounce',
    method: 'POST',
    description: 'Initiate PoE Bounce test on Gateway',
    params: {},
    body: { port: '1/1' },
    notes: 'Replace {serial} with gateway serial. Body: {port}',
    category: 'Troubleshooting'
  },
  {
    path: '/troubleshooting/v1alpha1/gateways/{serial}/poe-bounce/{test_id}',
    method: 'GET',
    description: 'Get Gateway PoE Bounce test status and results',
    params: {},
    notes: 'Replace {serial} and {test_id} with actual values',
    category: 'Troubleshooting'
  },
  {
    path: '/troubleshooting/v1alpha1/gateways/{serial}/port-bounce',
    method: 'POST',
    description: 'Initiate Port Bounce test on Gateway',
    params: {},
    body: { port: '1/1' },
    notes: 'Replace {serial} with gateway serial. Body: {port}',
    category: 'Troubleshooting'
  },
  {
    path: '/troubleshooting/v1alpha1/gateways/{serial}/port-bounce/{test_id}',
    method: 'GET',
    description: 'Get Gateway Port Bounce test status and results',
    params: {},
    notes: 'Replace {serial} and {test_id} with actual values',
    category: 'Troubleshooting'
  },
  {
    path: '/troubleshooting/v1alpha1/gateways/{serial}/iperf',
    method: 'POST',
    description: 'Initiate Iperf test on Gateway',
    params: {},
    body: { target: '192.168.1.1' },
    notes: 'Replace {serial} with gateway serial. Body: {target}',
    category: 'Troubleshooting'
  },
  {
    path: '/troubleshooting/v1alpha1/gateways/{serial}/iperf/{test_id}',
    method: 'GET',
    description: 'Get Gateway Iperf test status and results',
    params: {},
    notes: 'Replace {serial} and {test_id} with actual values',
    category: 'Troubleshooting'
  },
  {
    path: '/troubleshooting/v1alpha1/gateways/{serial}/http-test',
    method: 'POST',
    description: 'Initiate HTTP test on Gateway',
    params: {},
    body: { url: 'http://example.com' },
    notes: 'Replace {serial} with gateway serial. Body: {url}',
    category: 'Troubleshooting'
  },
  {
    path: '/troubleshooting/v1alpha1/gateways/{serial}/http-test/{test_id}',
    method: 'GET',
    description: 'Get Gateway HTTP test status and results',
    params: {},
    notes: 'Replace {serial} and {test_id} with actual values',
    category: 'Troubleshooting'
  },
  {
    path: '/troubleshooting/v1alpha1/gateways/{serial}/https-test',
    method: 'POST',
    description: 'Initiate HTTPS test on Gateway',
    params: {},
    body: { url: 'https://example.com' },
    notes: 'Replace {serial} with gateway serial. Body: {url}',
    category: 'Troubleshooting'
  },
  {
    path: '/troubleshooting/v1alpha1/gateways/{serial}/https-test/{test_id}',
    method: 'GET',
    description: 'Get Gateway HTTPS test status and results',
    params: {},
    notes: 'Replace {serial} and {test_id} with actual values',
    category: 'Troubleshooting'
  },
  {
    path: '/troubleshooting/v1alpha1/gateways/{serial}/arp-table',
    method: 'POST',
    description: 'Initiate Get Arp Table test on Gateway',
    params: {},
    body: {},
    notes: 'Replace {serial} with gateway serial',
    category: 'Troubleshooting'
  },
  {
    path: '/troubleshooting/v1alpha1/gateways/{serial}/arp-table/{test_id}',
    method: 'GET',
    description: 'Get Gateway Arp Table test status and results',
    params: {},
    notes: 'Replace {serial} and {test_id} with actual values',
    category: 'Troubleshooting'
  },
  {
    path: '/troubleshooting/v1alpha1/gateways/{serial}/show-commands',
    method: 'GET',
    description: 'List show commands (Gateway - top commands)',
    params: {},
    notes: 'Replace {serial} with gateway serial',
    category: 'Troubleshooting'
  },
  {
    path: '/troubleshooting/v1alpha1/gateways/{serial}/show-commands',
    method: 'POST',
    description: 'Run a show command (Gateway)',
    params: {},
    body: { command: 'show version' },
    notes: 'Replace {serial} with gateway serial. Body: {command}',
    category: 'Troubleshooting'
  },
  {
    path: '/troubleshooting/v1alpha1/gateways/{serial}/show-commands/{test_id}',
    method: 'GET',
    description: 'Get show command status/result (Gateway)',
    params: {},
    notes: 'Replace {serial} and {test_id} with actual values',
    category: 'Troubleshooting'
  },
  {
    path: '/troubleshooting/v1alpha1/gateways/{serial}/reboot',
    method: 'POST',
    description: 'Reboot a Gateway',
    params: {},
    body: {},
    notes: 'Replace {serial} with gateway serial',
    category: 'Troubleshooting'
  },
  {
    path: '/troubleshooting/v1alpha1/gateways/{serial}/disconnect-all',
    method: 'POST',
    description: 'Disconnect all clients from a Gateway',
    params: {},
    body: {},
    notes: 'Replace {serial} with gateway serial',
    category: 'Troubleshooting'
  },
  {
    path: '/troubleshooting/v1alpha1/gateways/{serial}/disconnect-client',
    method: 'POST',
    description: 'Disconnect a specific client by MAC address from a Gateway',
    params: {},
    body: { mac: '00:11:22:33:44:55' },
    notes: 'Replace {serial} with gateway serial. Body: {mac}',
    category: 'Troubleshooting'
  },
  {
    path: '/troubleshooting/v1alpha1/gateways/{serial}/halt',
    method: 'POST',
    description: 'Halt a Gateway',
    params: {},
    body: {},
    notes: 'Replace {serial} with gateway serial',
    category: 'Troubleshooting'
  },
  
  // ========== Services ==========
  {
    path: '/services/v1alpha1/location/devices',
    method: 'GET',
    description: 'List devices with location information',
    params: { limit: 20 },
    notes: 'Get devices with location data. Optional: limit',
    category: 'Services'
  },
  {
    path: '/services/v1alpha1/location/{location_id}',
    method: 'GET',
    description: 'Get location resource',
    params: {},
    notes: 'Replace {location_id} with actual location ID',
    category: 'Services'
  },
  {
    path: '/services/v1alpha1/location/devices/{serial}',
    method: 'GET',
    description: 'Get device location details',
    params: {},
    notes: 'Replace {serial} with device serial number',
    category: 'Services'
  },
  {
    path: '/services/v1alpha1/location/devices/{serial}/coordinates',
    method: 'POST',
    description: 'Set device coordinates',
    params: {},
    body: { x: 0, y: 0, z: 0 },
    notes: 'Replace {serial} with device serial. Body: {x, y, z}',
    category: 'Services'
  },
  {
    path: '/services/v1alpha1/location/devices/{serial}/coordinates',
    method: 'DELETE',
    description: 'Delete device coordinates',
    params: {},
    notes: 'Replace {serial} with device serial',
    category: 'Services'
  },
  {
    path: '/services/v1alpha1/location/ranging-scans',
    method: 'POST',
    description: 'Start an AP ranging scan (USE WITH CAUTION)',
    params: {},
    body: { ap_serial: 'SERIAL123456' },
    notes: 'Body: {ap_serial}. Use with caution!',
    category: 'Services'
  },
  {
    path: '/services/v1alpha1/location/ranging-scans',
    method: 'GET',
    description: 'List AP ranging scans',
    params: { limit: 20 },
    notes: 'Get list of ranging scans. Optional: limit',
    category: 'Services'
  },
  {
    path: '/services/v1alpha1/location/ranging-scans/{scan_id}',
    method: 'GET',
    description: 'Get scan resource',
    params: {},
    notes: 'Replace {scan_id} with actual scan ID',
    category: 'Services'
  },
  {
    path: '/services/v1alpha1/location/ranging-scans/{scan_id}',
    method: 'DELETE',
    description: 'Stop a scan',
    params: {},
    notes: 'Replace {scan_id} with actual scan ID',
    category: 'Services'
  },
  {
    path: '/services/v1alpha1/location/clients',
    method: 'GET',
    description: 'Get locations of Wi-Fi clients',
    params: { limit: 20 },
    notes: 'Get Wi-Fi client locations. Optional: limit',
    category: 'Services'
  },
  {
    path: '/services/v1alpha1/location/asset-tags',
    method: 'GET',
    description: 'Get a list of Asset Tags',
    params: { limit: 20 },
    notes: 'Get asset tags. Optional: limit',
    category: 'Services'
  },
  {
    path: '/services/v1alpha1/location/asset-tags/{tag_id}',
    method: 'GET',
    description: 'Get an Asset Tag\'s details',
    params: {},
    notes: 'Replace {tag_id} with actual tag ID',
    category: 'Services'
  },
  {
    path: '/services/v1alpha1/location/asset-tags/{tag_id}',
    method: 'PUT',
    description: 'Update Asset Tag metadata',
    params: {},
    body: { name: 'Tag Name' },
    notes: 'Replace {tag_id} with actual tag ID. Body: {name, ...}',
    category: 'Services'
  },
  {
    path: '/services/v1alpha1/location/asset-tags',
    method: 'POST',
    description: 'Create Asset Tag metadata',
    params: {},
    body: { name: 'Tag Name' },
    notes: 'Body: {name, ...}',
    category: 'Services'
  },
  {
    path: '/services/v1alpha1/location/asset-tags/{tag_id}',
    method: 'DELETE',
    description: 'Remove Asset Tag metadata',
    params: {},
    notes: 'Replace {tag_id} with actual tag ID',
    category: 'Services'
  },
  {
    path: '/services/v1alpha1/firmware/devices',
    method: 'GET',
    description: 'Get device list with firmware details',
    params: { limit: 20 },
    notes: 'Get devices with firmware information. Optional: limit',
    category: 'Services'
  },
  
  // ========== Reporting ==========
  {
    path: '/reporting/v1alpha1/health',
    method: 'GET',
    description: 'Health of Reporting service',
    params: {},
    notes: 'Check reporting service health',
    category: 'Reporting'
  },
  {
    path: '/reporting/v1alpha1/reports',
    method: 'GET',
    description: 'List Reports',
    params: { limit: 20 },
    notes: 'Get list of reports. Optional: limit',
    category: 'Reporting'
  },
  {
    path: '/reporting/v1alpha1/reports',
    method: 'POST',
    description: 'Create Report',
    params: {},
    body: { name: 'Report Name', type: 'custom' },
    notes: 'Body: {name, type, ...}',
    category: 'Reporting'
  },
  {
    path: '/reporting/v1alpha1/reports/{report_id}',
    method: 'PUT',
    description: 'Update Report',
    params: {},
    body: { name: 'Updated Name' },
    notes: 'Replace {report_id} with actual report ID. Body: {name, ...}',
    category: 'Reporting'
  },
  {
    path: '/reporting/v1alpha1/reports/{report_id}',
    method: 'DELETE',
    description: 'Delete Report',
    params: {},
    notes: 'Replace {report_id} with actual report ID',
    category: 'Reporting'
  },
  {
    path: '/reporting/v1alpha1/reports/{report_id}/runs',
    method: 'GET',
    description: 'List Report Runs',
    params: { limit: 20 },
    notes: 'Replace {report_id} with actual report ID. Optional: limit',
    category: 'Reporting'
  },
  {
    path: '/reporting/v1alpha1/reports/{report_id}/runs/{run_id}',
    method: 'DELETE',
    description: 'Delete Report Run',
    params: {},
    notes: 'Replace {report_id} and {run_id} with actual values',
    category: 'Reporting'
  },
  {
    path: '/reporting/v1alpha1/reports/{report_id}/runs/{run_id}/download',
    method: 'GET',
    description: 'Get Report Download Link',
    params: {},
    notes: 'Replace {report_id} and {run_id} with actual values',
    category: 'Reporting'
  },
  {
    path: '/reporting/v1alpha1/reports/metadata',
    method: 'GET',
    description: 'Get Reports Metadata',
    params: {},
    notes: 'Get reporting metadata',
    category: 'Reporting'
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
  const [sites, setSites] = useState([]);
  const [selectedSite, setSelectedSite] = useState('');
  const [loadingSites, setLoadingSites] = useState(false);
  const [sitesError, setSitesError] = useState('');
  const [selectedDevice, setSelectedDevice] = useState('');
  const [devices, setDevices] = useState([]);
  const [loadingDevices, setLoadingDevices] = useState(false);

  // Fetch devices on component mount
  useEffect(() => {
    const loadDevices = async () => {
      try {
        setLoadingDevices(true);
        console.log('🔍 Loading devices for API Explorer...');
        
        // Try multiple endpoints to get devices (similar to DevicesPage)
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
          console.log('✅ Devices API response:', data);
          let devicesList = [];
          if (Array.isArray(data)) {
            devicesList = data;
          } else if (data && typeof data === 'object') {
            devicesList = data.items || data.data || data.devices || [];
          }
          allDevices = [...allDevices, ...devicesList];
        } else {
          console.warn('⚠️ Devices API failed:', devicesData.reason);
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
          console.warn('⚠️ Switches API failed:', switchesData.reason);
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
          console.warn('⚠️ APs API failed:', apsData.reason);
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
          console.warn('⚠️ Gateways API failed:', gatewaysData.reason);
        }
        
        // Remove duplicates by serial number
        const deviceMap = new Map();
        allDevices.forEach(device => {
          const serial = device.serial || device.serialNumber || device.device_id || device.id;
          if (serial && !deviceMap.has(serial)) {
            deviceMap.set(serial, device);
          }
        });
        
        // Normalize device data
        const devicesList = Array.from(deviceMap.values()).map(device => {
          const serial = device.serial || device.serialNumber || device.device_id || device.id;
          return {
            serial: serial,
            serialNumber: device.serialNumber || device.serial || serial,
            name: device.name || device.deviceName || device.device_name || device.display_name || device.hostname || `Device ${serial}`,
            deviceName: device.deviceName || device.name || device.device_name || device.display_name,
            type: device.device_type || device.type || device.deviceType || 'UNKNOWN',
            deviceType: device.deviceType || device.device_type || device.type,
            model: device.model || device.platform || device.platformModel || '',
            ...device
          };
        }).filter(device => device.serial); // Only include devices with serial
        
        console.log(`✅ Loaded ${devicesList.length} devices for API Explorer`);
        setDevices(devicesList);
      } catch (err) {
        console.error('❌ Error loading devices:', err);
        console.error('❌ Error details:', {
          message: err.message,
          response: err.response?.data,
          status: err.response?.status
        });
        setDevices([]);
      } finally {
        setLoadingDevices(false);
      }
    };
    
    loadDevices();
  }, []);

  // Sync selectedDevice when endpoint changes and contains a serial
  useEffect(() => {
    if (devices.length > 0 && endpoint && requiresSerial(endpoint)) {
      const serialFromPath = extractSerialFromPath(endpoint);
      if (serialFromPath) {
        const matchingDevice = devices.find(d => d.serial === serialFromPath);
        if (matchingDevice && selectedDevice !== serialFromPath) {
          setSelectedDevice(serialFromPath);
        } else if (!matchingDevice && selectedDevice) {
          setSelectedDevice('');
        }
      } else {
        // Check query params for serial
        const { params } = parseEndpoint(endpoint);
        const serialFromQuery = params.get('serial');
        if (serialFromQuery) {
          const matchingDevice = devices.find(d => d.serial === serialFromQuery);
          if (matchingDevice && selectedDevice !== serialFromQuery) {
            setSelectedDevice(serialFromQuery);
          }
        } else if (selectedDevice) {
          setSelectedDevice('');
        }
      }
    }
  }, [endpoint, devices, selectedDevice]);

  // Fetch sites on component mount
  useEffect(() => {
    const loadSites = async () => {
      try {
        setLoadingSites(true);
        let sitesList = [];
        let lastError = null;
        
        // Try Configuration API first (best choice - faster, returns site names/IDs)
        try {
          console.log('🔍 [1/3] Trying Configuration API (/network-config/v1alpha1/sites)...');
          const sitesData = await sitesConfigAPI.getSites({ limit: 100, offset: 0 });
          console.log('✅ Configuration API response:', sitesData);
          console.log('✅ Response type:', typeof sitesData, Array.isArray(sitesData) ? 'Array' : 'Object');
          
          // Handle different response formats
          if (Array.isArray(sitesData)) {
            sitesList = sitesData;
          } else if (sitesData && typeof sitesData === 'object') {
            sitesList = sitesData.items || sitesData.data || sitesData.sites || sitesData.results || [];
          }
          
          if (sitesList.length > 0) {
            // Map Configuration API format to expected format with proper name extraction
            sitesList = sitesList.map(site => ({
              scopeId: site.scopeId || site.id || site.siteId || site.site_id,
              name: site.scopeName || site.name || site.siteName || site.displayName || site.display_name,
              siteName: site.scopeName || site.name || site.siteName || site.displayName || site.display_name,
              ...site
            })).filter(site => site.scopeId);
            
            console.log(`✅ Loaded ${sitesList.length} sites from Configuration API`);
            setSites(sitesList);
            return;
          } else {
            console.warn('⚠️ Configuration API returned empty result');
            lastError = new Error('Configuration API returned empty result');
          }
        } catch (configErr) {
          console.warn('⚠️ Configuration API failed:', configErr);
          console.warn('⚠️ Error details:', {
            message: configErr.message,
            response: configErr.response?.data,
            status: configErr.response?.status
          });
          lastError = configErr;
        }
        
        // Fallback 1: Try Central v2 Sites API
        try {
          console.log('🔍 [2/3] Trying Central v2 Sites API (/central/v2/sites)...');
          const v2SitesData = await configAPI.getSites();
          console.log('✅ Central v2 API response:', v2SitesData);
          
          if (Array.isArray(v2SitesData)) {
            sitesList = v2SitesData;
          } else if (v2SitesData && typeof v2SitesData === 'object') {
            sitesList = v2SitesData.sites || v2SitesData.items || v2SitesData.data || [];
          }
          
          if (sitesList.length > 0) {
            // Map v2 format to expected format
            sitesList = sitesList.map(site => ({
              scopeId: site.site_id || site.id || site.scopeId,
              name: site.site_name || site.name || site.display_name,
              siteName: site.site_name || site.name || site.display_name,
              ...site
            })).filter(site => site.scopeId);
            
            console.log(`✅ Loaded ${sitesList.length} sites from Central v2 API`);
            setSites(sitesList);
            return;
          } else {
            console.warn('⚠️ Central v2 API returned empty result');
          }
        } catch (v2Err) {
          console.warn('⚠️ Central v2 API failed:', v2Err);
          lastError = v2Err;
        }
        
        // Fallback 2: Try Monitoring API (sites-health endpoint)
        try {
          console.log('🔍 [3/3] Trying Monitoring API (/network-monitoring/v1alpha1/sites-health)...');
          const healthData = await monitoringAPIv2.getSitesHealth({ limit: 100, offset: 0 });
          console.log('✅ Monitoring API response:', healthData);
          
          // Extract sites from health data
          if (Array.isArray(healthData)) {
            sitesList = healthData;
          } else if (healthData && typeof healthData === 'object') {
            const items = healthData.items || healthData.data || healthData.sites || [];
            // Extract site info from health items
            sitesList = items.map(item => ({
              scopeId: item.scopeId || item.siteId || item.id,
              name: item.scopeName || item.siteName || item.name || item.displayName,
              siteName: item.scopeName || item.siteName || item.name || item.displayName,
              ...item
            })).filter(site => site.scopeId); // Filter out items without IDs
          }
          
          if (sitesList.length > 0) {
            console.log(`✅ Loaded ${sitesList.length} sites from Monitoring API fallback`);
            setSites(sitesList);
            return;
          } else {
            console.warn('⚠️ Monitoring API returned empty result');
          }
        } catch (monitoringErr) {
          console.error('❌ Monitoring API also failed:', monitoringErr);
          lastError = monitoringErr;
        }
        
        // All APIs failed
        console.error('❌ All site APIs failed. Last error:', lastError);
        console.error('❌ Setting empty sites list');
        setSites([]);
        if (lastError) {
          const errorMsg = lastError.response?.data?.error || lastError.message || 'Failed to load sites from all available APIs';
          setSitesError(errorMsg);
        } else {
          setSitesError('No sites available. Please check your API configuration.');
        }
      } catch (err) {
        console.error('❌ Unexpected error loading sites:', err);
        setSites([]);
      } finally {
        setLoadingSites(false);
      }
    };
    
    loadSites();
  }, []);

  // Helper function to extract base endpoint and query params
  const parseEndpoint = (endpointStr) => {
    const [basePath, queryString] = endpointStr.split('?');
    const params = new URLSearchParams(queryString || '');
    return { basePath, params };
  };

  // Helper function to build endpoint with query params
  const buildEndpoint = (basePath, queryParams) => {
    const params = new URLSearchParams();
    Object.keys(queryParams).forEach(key => {
      if (queryParams[key] !== null && queryParams[key] !== undefined && queryParams[key] !== '') {
        params.append(key, String(queryParams[key]));
      }
    });
    const queryString = params.toString();
    return queryString ? `${basePath}?${queryString}` : basePath;
  };

  // Sync selectedSite when endpoint changes and contains a site-id query parameter
  useEffect(() => {
    if (sites.length > 0 && endpoint && supportsSiteId(endpoint)) {
      const { basePath, params } = parseEndpoint(endpoint);
      const siteIdFromQuery = params.get('site-id');
      
      if (siteIdFromQuery) {
        const matchingSite = sites.find(s => {
          const siteId = String(s.scopeId || s.id || s.siteId || s.site_id);
          return siteId === siteIdFromQuery;
        });
        if (matchingSite && selectedSite !== siteIdFromQuery) {
          setSelectedSite(siteIdFromQuery);
        } else if (!matchingSite && selectedSite) {
          // Site-id in endpoint doesn't match any known site
          setSelectedSite('');
        }
      } else if (selectedSite) {
        // No site-id in endpoint but site is selected, clear selection
        setSelectedSite('');
      }
    }
  }, [endpoint, sites, selectedSite]);

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

      // Extract query parameters from endpoint and merge with parsedParams
      let { basePath, params: endpointParams } = parseEndpoint(endpoint);
      
      // Replace {serial} placeholder in path with selected device serial
      if (selectedDevice && basePath.includes('{serial}')) {
        basePath = basePath.replace(/{serial}/g, selectedDevice);
      } else if (requiresSerial(endpoint) && selectedDevice) {
        // If endpoint requires serial but doesn't have {serial} placeholder,
        // try to extract and replace the serial segment
        const serialFromPath = extractSerialFromPath(endpoint);
        if (serialFromPath) {
          basePath = basePath.replace(serialFromPath, selectedDevice);
        } else {
          // If serial is not in path, it might be in query params - ensure it's there
          endpointParams.set('serial', selectedDevice);
        }
      }
      
      const cleanEndpoint = basePath;
      
      // Merge endpoint query params with parsedParams (endpoint params take precedence)
      // URLSearchParams automatically decodes URL-encoded values
      endpointParams.forEach((value, key) => {
        // URLSearchParams already decodes values automatically
        // Values like %27 become ', + becomes space, etc.
        parsedParams[key] = value;
      });
      
      // Log params for debugging
      console.log('🔍 Request params being sent:', JSON.stringify(parsedParams, null, 2));
      if (parsedParams.filter) {
        console.log('🔍 Filter parameter:', parsedParams.filter);
      }
      
      // Ensure site-id is included if selected (in case it wasn't in endpoint string)
      if (selectedSite && supportsSiteId(endpoint) && !parsedParams['site-id']) {
        const site = sites.find(s => 
          (s.scopeId || s.id || s.siteId || s.site_id) === selectedSite
        );
        if (site) {
          const siteId = site.scopeId || site.id || site.siteId || site.site_id;
          parsedParams['site-id'] = siteId;
        }
      }
      
      // Ensure serial is included if selected and required (for query params)
      if (selectedDevice && requiresSerial(endpoint) && !parsedParams['serial']) {
        parsedParams['serial'] = selectedDevice;
      }

      if (body.trim() && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
        try {
          // If body contains {serial} placeholder, replace it
          if (selectedDevice && body.includes('{serial}')) {
            parsedBody = JSON.parse(body.replace(/{serial}/g, selectedDevice));
          } else if (selectedDevice && requiresSerial(endpoint)) {
            // If serial is required but not in body, try to add it
            parsedBody = JSON.parse(body);
            if (!parsedBody.device_serial && !parsedBody.serial) {
              parsedBody.device_serial = selectedDevice;
            }
          } else {
            parsedBody = JSON.parse(body);
          }
        } catch (e) {
          throw new Error('Invalid JSON in request body');
        }
      }

      // Execute request with clean endpoint (site-id removed from path, added as query param)
      const result = await explorerAPI.executeRequest(
        cleanEndpoint,
        method,
        parsedParams,
        parsedBody
      );

      setResponse(result);
    } catch (err) {
      setError(getErrorMessage(err, 'Request failed'));
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
    <Box sx={{ p: { xs: 2, sm: 3, md: 4 } }}>
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
      <Card sx={{ mb: 3, boxShadow: 2 }}>
        <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
          <Typography variant="h6" gutterBottom sx={{ mb: 1 }}>
            Common Endpoints ({COMMON_ENDPOINTS.length} available)
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            Click to quickly load an endpoint. Organized by category.
          </Typography>
          
          {/* Group endpoints by category with collapsible accordions in grid layout */}
          <Box 
            sx={{ 
              display: 'grid',
              gridTemplateColumns: {
                xs: '1fr',
                sm: 'repeat(2, 1fr)',
                md: 'repeat(3, 1fr)',
                lg: 'repeat(4, 1fr)',
              },
              gap: 2,
            }}
          >
            {Object.entries(
              COMMON_ENDPOINTS.reduce((acc, ep) => {
                const category = ep.category || 'Other';
                if (!acc[category]) acc[category] = [];
                acc[category].push(ep);
                return acc;
              }, {})
            ).map(([category, endpoints]) => (
              <Accordion 
                key={category} 
                defaultExpanded={false}
                sx={{ 
                  '&:before': { display: 'none' },
                  boxShadow: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  '&.Mui-expanded': {
                    margin: 0,
                  },
                }}
              >
                <AccordionSummary 
                  expandIcon={<ExpandMoreIcon />}
                  sx={{
                    backgroundColor: 'action.hover',
                    borderRadius: 1,
                    minHeight: 48,
                    py: 0.5,
                    px: 1.5,
                    '&.Mui-expanded': {
                      borderBottomLeftRadius: 0,
                      borderBottomRightRadius: 0,
                      minHeight: 48,
                    },
                    '&:hover': {
                      backgroundColor: 'action.selected',
                    },
                    '& .MuiAccordionSummary-content': {
                      margin: '8px 0',
                      minWidth: 0,
                    },
                  }}
                >
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%', minWidth: 0 }}>
                    <Typography 
                      variant="subtitle2" 
                      sx={{ 
                        fontWeight: 600, 
                        color: 'primary.main',
                        fontSize: '0.875rem',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {category}
                    </Typography>
                    <Chip 
                      label={endpoints.length} 
                      size="small" 
                      sx={{ 
                        height: 20,
                        fontSize: '0.7rem',
                        backgroundColor: 'primary.main',
                        color: 'white',
                        flexShrink: 0,
                      }} 
                    />
                  </Box>
                </AccordionSummary>
                <AccordionDetails sx={{ pt: 2, pb: 2, px: 1.5 }}>
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
                          transition: 'all 0.2s ease',
                          fontSize: '0.75rem',
                          '&:hover': {
                            backgroundColor: 'primary.main',
                            color: 'white',
                            transform: 'translateY(-2px)',
                            boxShadow: 2,
                          },
                        }}
                      />
                    ))}
                  </Box>
                </AccordionDetails>
              </Accordion>
            ))}
          </Box>
        </CardContent>
      </Card>

      {/* Request Configuration */}
      <Card sx={{ mb: 3, boxShadow: 2 }}>
        <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
          <Typography variant="h6" gutterBottom sx={{ mb: 3 }}>
            Request Configuration
          </Typography>

          {/* Method and Endpoint */}
          <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
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
              onChange={(e) => {
                const newEndpoint = e.target.value;
                setEndpoint(newEndpoint);
                
                // Extract query parameters from endpoint and sync to params field
                const { basePath, params: endpointParams } = parseEndpoint(newEndpoint);
                if (endpointParams.toString()) {
                  // Convert URLSearchParams to object and sync to params field
                  const paramsObj = {};
                  endpointParams.forEach((value, key) => {
                    paramsObj[key] = value; // URLSearchParams already decodes URL-encoded values
                  });
                  setParams(JSON.stringify(paramsObj, null, 2));
                } else if (!params.trim()) {
                  // Clear params if endpoint has no query params and params field is empty
                  setParams('');
                }
                
                // Extract serial from path or query parameters if present
                if (requiresSerial(newEndpoint)) {
                  const serialFromPath = extractSerialFromPath(newEndpoint);
                  const serialFromQuery = endpointParams.get('serial');
                  const foundSerial = serialFromPath || serialFromQuery;
                  
                  if (foundSerial) {
                    const matchingDevice = devices.find(d => d.serial === foundSerial);
                    if (matchingDevice && selectedDevice !== foundSerial) {
                      setSelectedDevice(foundSerial);
                    } else if (!matchingDevice && selectedDevice) {
                      setSelectedDevice('');
                    }
                  } else if (selectedDevice) {
                    setSelectedDevice('');
                  }
                } else if (selectedDevice) {
                  // Endpoint doesn't require serial, clear selection
                  setSelectedDevice('');
                }
                
                // Extract site-id from query parameters if present
                if (supportsSiteId(newEndpoint)) {
                  const siteIdFromQuery = endpointParams.get('site-id');
                  
                  if (siteIdFromQuery) {
                    const matchingSite = sites.find(s => {
                      const siteId = String(s.scopeId || s.id || s.siteId || s.site_id);
                      return siteId === siteIdFromQuery;
                    });
                    if (matchingSite) {
                      setSelectedSite(siteIdFromQuery);
                    } else {
                      // Site-id in endpoint doesn't match any known site, clear selection
                      setSelectedSite('');
                    }
                  } else if (selectedSite) {
                    // No site-id in endpoint but site is selected, clear selection
                    setSelectedSite('');
                  }
                } else if (selectedSite) {
                  // Endpoint doesn't support site-id, clear selection
                  setSelectedSite('');
                }
              }}
              helperText={
                supportsSiteId(endpoint)
                  ? selectedSite 
                    ? "Site ID is added as a query parameter. Remove ?site-id=XXX to unselect."
                    : "Enter the API endpoint path. Select a site to add ?site-id=XXX parameter."
                  : "Enter the API endpoint path (e.g., /monitoring/v1/devices)"
              }
              sx={{ flex: 1, minWidth: 200 }}
            />
          </Box>

          {/* Device Selector */}
          {requiresSerial(endpoint) && (
            <Box sx={{ mb: 3 }}>
              <DeviceSelector
                value={selectedDevice}
                onChange={(serial) => {
                  setSelectedDevice(serial);
                  
                  // Update endpoint to replace {serial} placeholder or update path
                  if (serial && endpoint) {
                    let updatedEndpoint = endpoint;
                    
                    // Replace {serial} placeholder
                    if (endpoint.includes('{serial}')) {
                      updatedEndpoint = endpoint.replace(/{serial}/g, serial);
                    } else {
                      // Try to replace serial in path
                      const serialFromPath = extractSerialFromPath(endpoint);
                      if (serialFromPath) {
                        updatedEndpoint = endpoint.replace(serialFromPath, serial);
                      } else {
                        // Add serial as query parameter if not in path
                        const { basePath, params } = parseEndpoint(endpoint);
                        params.set('serial', serial);
                        updatedEndpoint = buildEndpoint(basePath, Object.fromEntries(params));
                      }
                    }
                    
                    setEndpoint(updatedEndpoint);
                  } else if (!serial && endpoint) {
                    // Remove serial from endpoint and restore {serial} placeholder if needed
                    const { basePath, params } = parseEndpoint(endpoint);
                    params.delete('serial');
                    
                    // Try to restore {serial} placeholder in path
                    const deviceType = getDeviceTypeFromEndpoint(endpoint);
                    if (deviceType) {
                      const typeLower = deviceType.toLowerCase();
                      // Check if path has a serial segment that should be replaced with {serial}
                      const pathSegments = basePath.split('/');
                      const serialIndicators = ['aps', 'ap', 'switches', 'switch', 'devices', 'device', 'gateways', 'gateway'];
                      
                      for (let i = 0; i < pathSegments.length - 1; i++) {
                        if (serialIndicators.includes(pathSegments[i].toLowerCase())) {
                          const nextSegment = pathSegments[i + 1];
                          if (nextSegment && !['cpu', 'memory', 'power', 'interfaces', 'ports', 'radios', 'trends', 'usage'].includes(nextSegment.toLowerCase())) {
                            pathSegments[i + 1] = '{serial}';
                            updatedEndpoint = buildEndpoint(pathSegments.join('/'), Object.fromEntries(params));
                            break;
                          }
                        }
                      }
                    } else {
                      updatedEndpoint = buildEndpoint(basePath, Object.fromEntries(params));
                    }
                    setEndpoint(updatedEndpoint);
                  }
                }}
                required={requiresSerial(endpoint)}
                label="Device"
                helperText="Select a device. The device name is shown but the serial number will be used in the API call."
                deviceType={getDeviceTypeFromEndpoint(endpoint)}
              />
            </Box>
          )}

          {/* Site Selector */}
          {supportsSiteId(endpoint) && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="body2" sx={{ mb: 1, color: 'text.secondary' }}>
                Site {requiresSiteId(endpoint) ? '(Required)' : '(Optional)'}
              </Typography>
              {sitesError && (
                <Alert severity="warning" sx={{ mb: 1 }}>
                  {sitesError}
                </Alert>
              )}
              <FormControl fullWidth required={requiresSiteId(endpoint)} error={requiresSiteId(endpoint) && !selectedSite}>
                <InputLabel>Site {requiresSiteId(endpoint) ? '(Required)' : '(Optional)'}</InputLabel>
                <Select
                  value={selectedSite || ''}
                  onChange={(e) => {
                    const newSelectedSite = e.target.value;
                    setSelectedSite(newSelectedSite);
                    
                    // Update endpoint to add/remove site-id query parameter
                    if (newSelectedSite && supportsSiteId(endpoint)) {
                      const { basePath, params } = parseEndpoint(endpoint);
                      // Get the site ID (scope-id and site-id should be the same)
                      const site = sites.find(s => 
                        (s.scopeId || s.id || s.siteId || s.site_id) === newSelectedSite
                      );
                      if (site) {
                        // Use scopeId as site-id (they should be the same value)
                        const siteId = String(site.scopeId || site.id || site.siteId || site.site_id);
                        params.set('site-id', siteId);
                        const queryParams = Object.fromEntries(params);
                        setEndpoint(buildEndpoint(basePath, queryParams));
                      }
                    } else {
                      // Remove site-id from query parameters
                      const { basePath, params } = parseEndpoint(endpoint);
                      params.delete('site-id');
                      const queryParams = Object.fromEntries(params);
                      setEndpoint(buildEndpoint(basePath, queryParams));
                    }
                  }}
                  disabled={loadingSites || sites.length === 0}
                  displayEmpty
                  label={`Site ${requiresSiteId(endpoint) ? '(Required)' : '(Optional)'}`}
                  sx={{
                    '& .MuiSelect-select': {
                      color: selectedSite ? 'inherit' : 'rgba(255, 255, 255, 0.5)',
                    },
                  }}
                  renderValue={(value) => {
                    if (!value || value === '') {
                      return requiresSiteId(endpoint) ? 'Select a site (required)' : 'Select a site (optional)';
                    }
                    const site = sites.find(s => 
                      (s.scopeId || s.id || s.siteId || s.site_id) === value
                    );
                    return site ? (site.name || site.siteName || site.displayName || `Site ${value}`) : value;
                  }}
                >
                  {!requiresSiteId(endpoint) && (
                    <MenuItem value="">
                      <em>None (no site filter)</em>
                    </MenuItem>
                  )}
                  {loadingSites ? (
                    <MenuItem value="" disabled>
                      <CircularProgress size={16} sx={{ mr: 1 }} />
                      Loading sites...
                    </MenuItem>
                  ) : sites.length === 0 ? (
                    <MenuItem value="" disabled>
                      No sites available
                    </MenuItem>
                  ) : (
                    // Deduplicate sites by ID
                    Array.from(
                      new Map(
                        sites.map(site => {
                          const siteId = site.scopeId || site.id || site.siteId || site.site_id;
                          return [siteId, site];
                        })
                      ).values()
                    ).map((site) => {
                      const siteId = site.scopeId || site.id || site.siteId || site.site_id;
                      const siteName = site.name || site.siteName || site.displayName || `Site ${siteId}`;
                      return (
                        <MenuItem key={siteId} value={siteId}>
                          {siteName}
                          <Typography variant="caption" sx={{ ml: 1, color: 'text.secondary' }}>
                            ({siteId})
                          </Typography>
                        </MenuItem>
                      );
                    })
                  )}
                </Select>
                {requiresSiteId(endpoint) && !selectedSite ? (
                  <Typography variant="caption" color="error" sx={{ mt: 0.5, ml: 1.75 }}>
                    Site selection is required for this endpoint
                  </Typography>
                ) : (
                  <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, ml: 1.75 }}>
                    {selectedSite 
                      ? `Site ID is added as a query parameter (?site-id=${selectedSite}). scope-id and site-id use the same value.`
                      : requiresSiteId(endpoint)
                      ? 'Required: Select a site to add ?site-id=XXX as a query parameter.'
                      : 'Optional: Select a site to add ?site-id=XXX as a query parameter.'}
                  </Typography>
                )}
              </FormControl>
            </Box>
          )}

          {/* Parameters Accordion */}
          <Accordion sx={{ mb: 2, boxShadow: 1 }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="subtitle2">Query Parameters (Optional)</Typography>
            </AccordionSummary>
            <AccordionDetails sx={{ pt: 2 }}>
              <TextField
                fullWidth
                multiline
                rows={4}
                placeholder='{"limit": 100, "offset": 0}'
                value={params}
                onChange={(e) => {
                  setParams(e.target.value);
                  
                  // Update endpoint to include query parameters from params field
                  if (endpoint) {
                    try {
                      const parsedParamsFromField = e.target.value.trim() ? JSON.parse(e.target.value) : {};
                      const { basePath } = parseEndpoint(endpoint);
                      
                      // Merge params: always include site-id if selected, plus params from field
                      const mergedParams = { ...parsedParamsFromField };
                      if (selectedSite && supportsSiteId(endpoint)) {
                        const site = sites.find(s => 
                          (s.scopeId || s.id || s.siteId || s.site_id) === selectedSite
                        );
                        if (site) {
                          mergedParams['site-id'] = site.scopeId || site.id || site.siteId || site.site_id;
                        }
                      }
                      
                      setEndpoint(buildEndpoint(basePath, mergedParams));
                    } catch (err) {
                      // Invalid JSON, don't update endpoint
                    }
                  }
                }}
                helperText="Enter query parameters as JSON, or type them directly in the endpoint field as ?param=value&param2=value2"
                sx={{ fontFamily: 'monospace' }}
              />
            </AccordionDetails>
          </Accordion>

          {/* Request Body Accordion */}
          {(method === 'POST' || method === 'PUT') && (
            <Accordion sx={{ mb: 3, boxShadow: 1 }}>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography variant="subtitle2">Request Body</Typography>
              </AccordionSummary>
              <AccordionDetails sx={{ pt: 2 }}>
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
            sx={{ 
              mt: 1,
              py: 1.5,
              px: 4,
            }}
          >
            {loading ? 'Executing...' : 'Execute Request'}
          </Button>
        </CardContent>
      </Card>

      {/* Query Parameters Reference */}
      {(
        <Card sx={{ mb: 3, boxShadow: 2 }}>
          <Accordion defaultExpanded={false} sx={{ boxShadow: 'none', '&:before': { display: 'none' } }}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
                Available Query Parameters
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              {(() => {
                const currentEndpoint = endpoint || '/network-monitoring/v1alpha1/clients'; // Default endpoint for reference
                const { basePath } = parseEndpoint(currentEndpoint);
                const endpointLower = basePath.toLowerCase();
                
                // Extract path parameters (like {serial}, {mac}, {alert_id}, etc.)
                const getPathParameters = () => {
                  const pathParams = [];
                  const pathParamMatches = basePath.matchAll(/\{([^}]+)\}/g);
                  
                  for (const match of pathParamMatches) {
                    const paramName = match[1];
                    const paramValue = match[0]; // {serial}, {mac}, etc.
                    
                    // Determine description based on parameter name
                    let description = '';
                    let example = '';
                    
                    if (paramName.toLowerCase().includes('serial')) {
                      description = 'Device serial number (required in path)';
                      example = 'SERIAL123456';
                    } else if (paramName.toLowerCase().includes('mac')) {
                      description = 'Client MAC address (required in path, format: XX:XX:XX:XX:XX:XX)';
                      example = '00:11:22:33:44:55';
                    } else if (paramName.toLowerCase().includes('alert')) {
                      description = 'Alert ID (required in path)';
                      example = 'alert-12345';
                    } else if (paramName.toLowerCase().includes('site')) {
                      description = 'Site ID (required in path)';
                      example = '12345678901';
                    } else if (paramName.toLowerCase().includes('wlan') || paramName.toLowerCase().includes('ssid')) {
                      description = 'WLAN/SSID name (required in path)';
                      example = 'MyNetwork';
                    } else if (paramName.toLowerCase().includes('swarm')) {
                      description = 'Swarm ID (required in path)';
                      example = 'swarm-123';
                    } else if (paramName.toLowerCase().includes('threat')) {
                      description = 'Threat ID (required in path)';
                      example = 'threat-123';
                    } else if (paramName.toLowerCase().includes('tunnel')) {
                      description = 'Tunnel ID (required in path)';
                      example = 'tunnel-123';
                    } else if (paramName.toLowerCase().includes('radio')) {
                      description = 'Radio ID (required in path)';
                      example = 'radio-0';
                    } else if (paramName.toLowerCase().includes('port')) {
                      description = 'Port ID (required in path)';
                      example = 'port-1';
                    } else if (paramName.toLowerCase().includes('interface')) {
                      description = 'Interface ID (required in path)';
                      example = 'interface-1';
                    } else if (paramName.toLowerCase().includes('vlan')) {
                      description = 'VLAN ID (required in path)';
                      example = '100';
                    } else if (paramName.toLowerCase().includes('uplink')) {
                      description = 'Uplink ID (required in path)';
                      example = 'uplink-1';
                    } else if (paramName.toLowerCase().includes('probe')) {
                      description = 'Probe ID (required in path)';
                      example = 'probe-1';
                    } else if (paramName.toLowerCase().includes('member')) {
                      description = 'Member ID (required in path)';
                      example = 'member-1';
                    } else if (paramName.toLowerCase().includes('stack')) {
                      description = 'Stack ID (required in path)';
                      example = 'stack-1';
                    } else if (paramName.toLowerCase().includes('test')) {
                      description = 'Test ID (required in path)';
                      example = 'test-12345';
                    } else if (paramName.toLowerCase().includes('report')) {
                      description = 'Report ID (required in path)';
                      example = 'report-123';
                    } else if (paramName.toLowerCase().includes('run')) {
                      description = 'Run ID (required in path)';
                      example = 'run-123';
                    } else if (paramName.toLowerCase().includes('scan')) {
                      description = 'Scan ID (required in path)';
                      example = 'scan-123';
                    } else if (paramName.toLowerCase().includes('tag')) {
                      description = 'Tag ID (required in path)';
                      example = 'tag-123';
                    } else if (paramName.toLowerCase().includes('location')) {
                      description = 'Location ID (required in path)';
                      example = 'location-123';
                    } else {
                      description = `${paramName} (required in path)`;
                      example = `${paramName}-123`;
                    }
                    
                    pathParams.push({
                      name: paramValue,
                      paramName: paramName,
                      description: description,
                      example: example,
                      required: true,
                      type: 'path parameter'
                    });
                  }
                  
                  return pathParams;
                };
                
                const pathParameters = getPathParameters();
                
                // Determine available parameters based on endpoint pattern
                const getAvailableParams = () => {
                  // Common parameters for most endpoints
                  const commonParams = {
                    'limit': { type: 'integer', description: 'Maximum number of results to return (0-100, default: 20)', example: { limit: 20 }, required: false },
                    'offset': { type: 'integer', description: 'Pagination offset', example: { offset: 0 }, required: false },
                  };
                  
                  // Site-id for supported endpoints
                  if (supportsSiteId(currentEndpoint)) {
                    commonParams['site-id'] = { type: 'string', description: 'Filter results by site ID', example: { 'site-id': '12345678901' }, required: false };
                  }
                  
                  // Detail endpoints (no query parameters) - check these first
                  const detailEndpointPatterns = [
                    /\/aps\/[^\/]+$/,  // /aps/{serial} - no params
                    /\/switches\/[^\/]+$/,  // /switches/{serial} - no params
                    /\/gateways\/[^\/]+$/,  // /gateways/{serial} - no params
                    /\/switch\/[^\/]+\/(interfaces|vlans|hardware|stack|lag)$/,  // Switch detail endpoints
                    /\/alerts\/[^\/]+$/,  // /alerts/{alert_id} - no params
                    /\/clients\/[^\/]+\/session$/,  // /clients/{mac}/session - no params
                    /\/swarms\/[^\/]+$/,  // /swarms/{swarm_id} - no params
                    /\/idps\/threats\/[^\/]+$/,  // /idps/threats/{threat_id} - no params
                    /\/site-health\/[^\/]+$/,  // /site-health/{site_id} - no params
                    /\/device-inventory\/[^\/]+$/,  // /device-inventory/{serial} - no params
                    /\/wlans\/[^\/]+$/,  // /wlans/{wlan_name} - no params (detail endpoint, not throughput)
                    /\/aps\/[^\/]+\/tunnels\/[^\/]+$/,  // AP tunnel detail - no params (not trends)
                    /\/aps\/[^\/]+\/radios\/[^\/]+$/,  // AP radio detail - no params (not trends)
                    /\/aps\/[^\/]+\/ports\/[^\/]+$/,  // AP port detail - no params (not trends)
                    /\/gateways\/[^\/]+\/(cluster|tunnels|interfaces|vlans|uplinks)\/[^\/]+$/,  // Gateway detail endpoints
                    /\/gateways\/[^\/]+\/tunnels\/(lan|wan)\/[^\/]+$/,  // Gateway tunnel detail
                    /\/troubleshooting\/v1alpha1\/.*\/[^\/]+\/(ping|traceroute|speedtest|http-test|https-test|tcp-test|arp-table|nslookup|aaa-test|show-commands|poe-bounce|port-bounce|cable-test|iperf|ping-mtu-sweep)\/[^\/]+$/,  // Troubleshooting test results
                    /\/services\/v1alpha1\/location\/(ranging-scans|asset-tags)\/[^\/]+$/,  // Location detail endpoints
                    /\/reporting\/v1alpha1\/reports\/[^\/]+$/,  // Report detail (without /runs)
                    /\/reporting\/v1alpha1\/reports\/[^\/]+\/runs\/[^\/]+\/download$/,  // Report download
                  ];
                  
                  if (detailEndpointPatterns.some(pattern => pattern.test(basePath))) {
                    return {}; // Detail endpoints have no query parameters
                  }
                  
                  // Endpoint-specific parameters for list endpoints
                  if (endpointLower === '/network-monitoring/v1alpha1/aps' || endpointLower.startsWith('/network-monitoring/v1alpha1/aps?')) {
                    return {
                      ...commonParams,
                      'filter': { type: 'string', description: 'OData filter expression (max 256 chars). Can filter by any field in the response (e.g., status, siteId, model, deviceName, serialNumber, partNumber, etc.). Operators: eq, in. Only "and" conjunction supported.', example: { filter: "status eq 'Up' and siteId eq '12345678901'" }, required: false },
                      'sort': { type: 'string', description: 'Comma-separated sort expressions. Format: field [asc|desc]. Supported: siteId, model, status, deployment, serialNumber, deviceName', example: { sort: 'deviceName asc' }, required: false },
                      'next': { type: 'string', description: 'Pagination cursor for next page', example: { next: 'cursor_string' }, required: false },
                    };
                  }
                  
                  // Devices endpoint
                  if (endpointLower.includes('/devices') && !endpointLower.includes('/device-')) {
                    return {
                      ...commonParams,
                      'filter': { type: 'string', description: 'OData filter expression (max 256 chars). Operators: eq, in. Only "and" conjunction supported. Known filterable fields: deviceType, serialNumber, deviceName, status, siteId, model. Note: Not all fields are filterable - if a filter returns an error, that field may not be supported.', example: { filter: "deviceType eq 'SWITCH'" }, required: false },
                      'sort': { type: 'string', description: 'Comma-separated sort expressions. Format: field [asc|desc]. Supported fields vary by endpoint.', example: { sort: 'deviceName asc' }, required: false },
                    };
                  }
                  
                  // Switches endpoint
                  if (endpointLower === '/network-monitoring/v1alpha1/switches' || endpointLower.startsWith('/network-monitoring/v1alpha1/switches?')) {
                    return {
                      ...commonParams,
                      'filter': { type: 'string', description: 'OData filter expression (max 256 chars). Can filter by status, siteId, model, deviceName, serialNumber, etc. Operators: eq, in. Only "and" conjunction supported.', example: { filter: "status eq 'Up' and siteId eq '12345678901'" }, required: false },
                      'sort': { type: 'string', description: 'Comma-separated sort expressions. Format: field [asc|desc]. Supported: siteId, model, status, serialNumber, deviceName', example: { sort: 'deviceName asc' }, required: false },
                      'next': { type: 'string', description: 'Pagination cursor for next page', example: { next: 'cursor_string' }, required: false },
                    };
                  }
                  
                  // Gateways endpoint
                  if (endpointLower === '/network-monitoring/v1alpha1/gateways' || endpointLower.startsWith('/network-monitoring/v1alpha1/gateways?')) {
                    return {
                      ...commonParams,
                      'filter': { type: 'string', description: 'OData filter expression (max 256 chars). Can filter by status, siteId, model, deviceName, serialNumber, etc. Operators: eq, in. Only "and" conjunction supported.', example: { filter: "status eq 'Up' and siteId eq '12345678901'" }, required: false },
                      'sort': { type: 'string', description: 'Comma-separated sort expressions. Format: field [asc|desc]. Supported: siteId, model, status, serialNumber, deviceName', example: { sort: 'deviceName asc' }, required: false },
                      'next': { type: 'string', description: 'Pagination cursor for next page', example: { next: 'cursor_string' }, required: false },
                    };
                  }
                  
                  // Clients endpoints
                  if (endpointLower.includes('/clients')) {
                    if (endpointLower.includes('/clients/trends')) {
                      return {
                        ...commonParams,
                        'interval': { type: 'string', description: 'Time interval for trend data. Options: 5m, 1h, 1d', example: { interval: '5m' }, required: false },
                        'duration': { type: 'string', description: 'Duration for trend data. Options: 1h, 24h, 7d', example: { duration: '1h' }, required: false },
                      };
                    }
                    if (endpointLower.includes('/clients/usage/topn')) {
                      return {
                        ...commonParams,
                        'count': { type: 'integer', description: 'Number of top clients to return', example: { count: 10 }, required: false },
                      };
                    }
                    return {
                      ...commonParams,
                      'filter': { type: 'string', description: 'OData filter expression. Can filter by MAC address, SSID, siteId, etc. Operators: eq, in. Only "and" conjunction supported.', example: { filter: "siteId eq '12345678901'" }, required: false },
                    };
                  }
                  
                  // Alerts endpoints
                  if (endpointLower.includes('/alerts')) {
                    if (!endpointLower.includes('/alerts/')) {
                      return {
                        ...commonParams,
                        'severity': { type: 'string', description: 'Filter alerts by severity. Options: critical, major, minor, warning, info', example: { severity: 'critical' }, required: false },
                        'status': { type: 'string', description: 'Filter alerts by status. Options: active, acknowledged, resolved', example: { status: 'active' }, required: false },
                        'filter': { type: 'string', description: 'OData filter expression. Can filter by severity, status, siteId, deviceSerial, etc. Operators: eq, in. Only "and" conjunction supported.', example: { filter: "severity eq 'critical' and status eq 'active'" }, required: false },
                      };
                    }
                    return {};
                  }
                  
                  // Applications endpoints
                  if (endpointLower.includes('/applications')) {
                    if (endpointLower.includes('/applications/top')) {
                      return {
                        ...commonParams,
                        'count': { type: 'integer', description: 'Number of top applications to return', example: { count: 10 }, required: false },
                      };
                    }
                    return {
                      ...commonParams,
                    };
                  }
                  
                  // WLANs endpoints
                  if (endpointLower.includes('/wlans')) {
                    if (endpointLower.includes('/wlans/') && endpointLower.includes('/throughput')) {
                      return {
                        'interval': { type: 'string', description: 'Time interval for trend data. Options: 5m, 1h, 1d', example: { interval: '5m' }, required: true },
                        'duration': { type: 'string', description: 'Duration for trend data. Options: 1h, 24h, 7d', example: { duration: '1h' }, required: true },
                      };
                    }
                    return {
                      ...commonParams,
                    };
                  }
                  
                  // Swarms endpoints
                  if (endpointLower.includes('/swarms')) {
                    if (!endpointLower.includes('/swarms/')) {
                      return {
                        ...commonParams,
                        'filter': { type: 'string', description: 'OData filter expression. Can filter by name, siteId, etc. Operators: eq, in. Only "and" conjunction supported.', example: { filter: "siteId eq '12345678901'" }, required: false },
                      };
                    }
                    return {};
                  }
                  
                  // Radios endpoint
                  if (endpointLower === '/network-monitoring/v1alpha1/radios' || endpointLower.startsWith('/network-monitoring/v1alpha1/radios?')) {
                    return {
                      ...commonParams,
                      'filter': { type: 'string', description: 'OData filter expression. Can filter by AP serial, radio band, etc. Operators: eq, in. Only "and" conjunction supported.', example: { filter: "apSerial eq 'SERIAL123456'" }, required: false },
                    };
                  }
                  
                  if (endpointLower.includes('/trends') || endpointLower.includes('/utilization-trends') || endpointLower.includes('/throughput')) {
                    return {
                      'interval': { type: 'string', description: 'Time interval for trend data. Options: 5m, 1h, 1d', example: { interval: '5m' }, required: true },
                      'duration': { type: 'string', description: 'Duration for trend data. Options: 1h, 24h, 7d', example: { duration: '1h' }, required: true },
                    };
                  }
                  
                  // Top endpoints
                  if (endpointLower.includes('/top-aps-by-wireless-usage')) {
                    return {
                      ...commonParams,
                      'count': { type: 'integer', description: 'Number of top APs to return (default: 10)', example: { count: 10 }, required: false },
                      'from_timestamp': { type: 'string', description: 'Start timestamp (ISO 8601 format). Example: 2024-01-01T00:00:00Z', example: { from_timestamp: '2024-01-01T00:00:00Z' }, required: false },
                      'to_timestamp': { type: 'string', description: 'End timestamp (ISO 8601 format). Example: 2024-01-02T00:00:00Z', example: { to_timestamp: '2024-01-02T00:00:00Z' }, required: false },
                    };
                  }
                  
                  if (endpointLower.includes('/top-aps-by-client-count')) {
                    return {
                      ...commonParams,
                      'count': { type: 'integer', description: 'Number of top APs to return (default: 10)', example: { count: 10 }, required: false },
                    };
                  }
                  
                  if (endpointLower.includes('/top-ssids-by-usage')) {
                    return {
                      ...commonParams,
                      'count': { type: 'integer', description: 'Number of top SSIDs to return (default: 10)', example: { count: 10 }, required: false },
                    };
                  }
                  
                  if (endpointLower.includes('/aps/bandwidth/top')) {
                    return {
                      ...commonParams,
                      'count': { type: 'integer', description: 'Number of top APs to return (default: 10)', example: { count: 10 }, required: false },
                      'from_timestamp': { type: 'string', description: 'Start timestamp (ISO 8601 format)', example: { from_timestamp: '2024-01-01T00:00:00Z' }, required: false },
                      'to_timestamp': { type: 'string', description: 'End timestamp (ISO 8601 format)', example: { to_timestamp: '2024-01-02T00:00:00Z' }, required: false },
                    };
                  }
                  
                  // Network usage endpoint
                  if (endpointLower.includes('/network-usage')) {
                    return {
                      ...commonParams,
                      'timeframe': { type: 'string', description: 'Time frame for usage data. Options: 1h, 24h, 7d, 30d', example: { timeframe: '24h' }, required: false },
                      'from_timestamp': { type: 'string', description: 'Start timestamp (ISO 8601 format)', example: { from_timestamp: '2024-01-01T00:00:00Z' }, required: false },
                      'to_timestamp': { type: 'string', description: 'End timestamp (ISO 8601 format)', example: { to_timestamp: '2024-01-02T00:00:00Z' }, required: false },
                    };
                  }
                  
                  // Wireless health endpoint
                  if (endpointLower.includes('/wireless-health')) {
                    return {
                      ...commonParams,
                    };
                  }
                  
                  // Switch detail endpoints that might have query params
                  if (endpointLower.includes('/switch/') && endpointLower.match(/\/switch\/[^\/]+\/(interfaces|vlans|ports)$/)) {
                    return {
                      'filter': { type: 'string', description: 'OData filter expression. Can filter by interface name, VLAN ID, port status, etc. Operators: eq, in. Only "and" conjunction supported.', example: { filter: "status eq 'Up'" }, required: false },
                      'limit': { type: 'integer', description: 'Maximum number of results to return (0-100, default: 20)', example: { limit: 20 }, required: false },
                      'offset': { type: 'integer', description: 'Pagination offset', example: { offset: 0 }, required: false },
                    };
                  }
                  
                  // Firewall endpoints
                  if (endpointLower.includes('/firewall/')) {
                    if (endpointLower.includes('/firewall/sessions')) {
                      return {
                        ...commonParams,
                        'gateway_serial': { type: 'string', description: 'Filter by gateway serial number', example: { gateway_serial: 'SERIAL123456' }, required: false },
                        'client_mac': { type: 'string', description: 'Filter by client MAC address', example: { client_mac: '00:11:22:33:44:55' }, required: false },
                      };
                    }
                    if (endpointLower.includes('/firewall/clients')) {
                      return {
                        ...commonParams,
                        'gateway_serial': { type: 'string', description: 'Filter by gateway serial number', example: { gateway_serial: 'SERIAL123456' }, required: false },
                      };
                    }
                    return {
                      ...commonParams,
                    };
                  }
                  
                  // IDPS endpoints
                  if (endpointLower.includes('/idps/')) {
                    if (endpointLower.includes('/idps/events')) {
                      return {
                        ...commonParams,
                        'severity': { type: 'string', description: 'Filter by threat severity', example: { severity: 'high' }, required: false },
                        'threat_type': { type: 'string', description: 'Filter by threat type', example: { threat_type: 'malware' }, required: false },
                        'from_timestamp': { type: 'string', description: 'Start timestamp (ISO 8601 format)', example: { from_timestamp: '2024-01-01T00:00:00Z' }, required: false },
                        'to_timestamp': { type: 'string', description: 'End timestamp (ISO 8601 format)', example: { to_timestamp: '2024-01-02T00:00:00Z' }, required: false },
                      };
                    }
                    if (endpointLower.includes('/idps/threats') && !endpointLower.includes('/idps/threats/')) {
                      return {
                        ...commonParams,
                        'severity': { type: 'string', description: 'Filter by threat severity', example: { severity: 'high' }, required: false },
                        'threat_type': { type: 'string', description: 'Filter by threat type', example: { threat_type: 'malware' }, required: false },
                      };
                    }
                    return {};
                  }
                  
                  // Sites Health endpoints
                  if (endpointLower.includes('/sites-health') || endpointLower.includes('/site-health')) {
                    if (endpointLower.includes('/sites-health')) {
                      return {
                        ...commonParams,
                        'filter': { type: 'string', description: 'OData filter expression. Can filter by health status, siteId, etc. Operators: eq, in. Only "and" conjunction supported.', example: { filter: "healthStatus eq 'healthy'" }, required: false },
                      };
                    }
                    return {};
                  }
                  
                  if (endpointLower.includes('/sites-device-health') || endpointLower.includes('/tenant-device-health')) {
                    return {
                      ...commonParams,
                      'filter': { type: 'string', description: 'OData filter expression. Can filter by deviceType, status, siteId, etc. Operators: eq, in. Only "and" conjunction supported.', example: { filter: "deviceType eq 'AP' and status eq 'Up'" }, required: false },
                    };
                  }
                  
                  // Troubleshooting endpoints - no query params for POST, GET for status
                  if (endpointLower.includes('/troubleshooting/')) {
                    // POST endpoints (initiate tests) - no query params
                    if (method === 'POST') {
                      return {};
                    }
                    // GET endpoints for test results - no query params
                    if (endpointLower.match(/\/troubleshooting\/v1alpha1\/.*\/[^\/]+\/[^\/]+\/[^\/]+$/)) {
                      return {};
                    }
                    // GET endpoints for listing commands - no query params
                    if (endpointLower.includes('/show-commands') && method === 'GET') {
                      return {};
                    }
                    return {};
                  }
                  
                  // Services endpoints
                  if (endpointLower.includes('/services/v1alpha1/location/')) {
                    if (endpointLower.includes('/devices') && !endpointLower.includes('/devices/')) {
                      return {
                        ...commonParams,
                        'filter': { type: 'string', description: 'OData filter expression. Can filter by deviceType, serialNumber, siteId, etc. Operators: eq, in. Only "and" conjunction supported.', example: { filter: "deviceType eq 'AP'" }, required: false },
                      };
                    }
                    if (endpointLower.includes('/ranging-scans') && !endpointLower.includes('/ranging-scans/')) {
                      return {
                        ...commonParams,
                        'status': { type: 'string', description: 'Filter scans by status. Options: running, completed, failed', example: { status: 'running' }, required: false },
                        'from_timestamp': { type: 'string', description: 'Start timestamp (ISO 8601 format)', example: { from_timestamp: '2024-01-01T00:00:00Z' }, required: false },
                        'to_timestamp': { type: 'string', description: 'End timestamp (ISO 8601 format)', example: { to_timestamp: '2024-01-02T00:00:00Z' }, required: false },
                      };
                    }
                    if (endpointLower.includes('/asset-tags') && !endpointLower.includes('/asset-tags/')) {
                      return {
                        ...commonParams,
                        'filter': { type: 'string', description: 'OData filter expression. Can filter by name, siteId, etc. Operators: eq, in. Only "and" conjunction supported.', example: { filter: "name eq 'Tag1'" }, required: false },
                      };
                    }
                    if (endpointLower.includes('/clients') && !endpointLower.includes('/clients/')) {
                      return {
                        ...commonParams,
                        'filter': { type: 'string', description: 'OData filter expression. Can filter by MAC address, SSID, siteId, etc. Operators: eq, in. Only "and" conjunction supported.', example: { filter: "siteId eq '12345678901'" }, required: false },
                      };
                    }
                    // Detail endpoints have no params
                    return {};
                  }
                  
                  if (endpointLower.includes('/services/v1alpha1/firmware/')) {
                    return {
                      ...commonParams,
                      'filter': { type: 'string', description: 'OData filter expression. Can filter by deviceType, model, currentVersion, targetVersion, etc. Operators: eq, in. Only "and" conjunction supported.', example: { filter: "deviceType eq 'AP' and currentVersion eq '8.10.0.0'" }, required: false },
                      'sort': { type: 'string', description: 'Comma-separated sort expressions. Format: field [asc|desc]', example: { sort: 'deviceName asc' }, required: false },
                    };
                  }
                  
                  // Reporting endpoints
                  if (endpointLower.includes('/reporting/v1alpha1/')) {
                    if (endpointLower.includes('/reports') && !endpointLower.match(/\/reports\/[^\/]+$/)) {
                      return {
                        ...commonParams,
                        'filter': { type: 'string', description: 'OData filter expression. Can filter by name, type, status, etc. Operators: eq, in. Only "and" conjunction supported.', example: { filter: "type eq 'custom'" }, required: false },
                        'sort': { type: 'string', description: 'Comma-separated sort expressions. Format: field [asc|desc]', example: { sort: 'name asc' }, required: false },
                      };
                    }
                    if (endpointLower.includes('/runs') && !endpointLower.includes('/download')) {
                      return {
                        ...commonParams,
                        'status': { type: 'string', description: 'Filter runs by status. Options: pending, running, completed, failed', example: { status: 'completed' }, required: false },
                        'from_timestamp': { type: 'string', description: 'Start timestamp (ISO 8601 format)', example: { from_timestamp: '2024-01-01T00:00:00Z' }, required: false },
                        'to_timestamp': { type: 'string', description: 'End timestamp (ISO 8601 format)', example: { to_timestamp: '2024-01-02T00:00:00Z' }, required: false },
                        'sort': { type: 'string', description: 'Comma-separated sort expressions. Format: field [asc|desc]', example: { sort: 'createdAt desc' }, required: false },
                      };
                    }
                    // Detail endpoints have no params
                    return {};
                  }
                  
                  // Gateway detail endpoints
                  if (endpointLower.includes('/gateways/') && endpointLower.match(/\/gateways\/[^\/]+\//)) {
                    // Check if it's a trend endpoint
                    if (endpointLower.includes('/trends') || endpointLower.includes('/throughput') || 
                        endpointLower.includes('/status') || endpointLower.includes('/availability') ||
                        endpointLower.includes('/frames') || endpointLower.includes('/dropped-packets') ||
                        endpointLower.includes('/compression') || endpointLower.includes('/performance') ||
                        endpointLower.includes('/bandwidth') || endpointLower.includes('/temperature')) {
                      return {
                        'interval': { type: 'string', description: 'Time interval for trend data. Options: 5m, 1h, 1d', example: { interval: '5m' }, required: true },
                        'duration': { type: 'string', description: 'Duration for trend data. Options: 1h, 24h, 7d', example: { duration: '1h' }, required: true },
                      };
                    }
                    // Gateway list sub-resources (tunnels, interfaces, vlans, etc.)
                    if (endpointLower.match(/\/gateways\/[^\/]+\/(tunnels|interfaces|vlans|cluster\/members|cluster\/tunnels|tunnels\/lan|tunnels\/wan|interfaces\/wired|interfaces\/wan|uplinks)$/)) {
                      return {
                        'limit': { type: 'integer', description: 'Maximum number of results to return (0-100, default: 20)', example: { limit: 20 }, required: false },
                        'offset': { type: 'integer', description: 'Pagination offset', example: { offset: 0 }, required: false },
                        'filter': { type: 'string', description: 'OData filter expression. Can filter by name, status, etc. Operators: eq, in. Only "and" conjunction supported.', example: { filter: "status eq 'Up'" }, required: false },
                      };
                    }
                    // Gateway uplink probes
                    if (endpointLower.includes('/uplinks/') && endpointLower.includes('/probes')) {
                      return {
                        'limit': { type: 'integer', description: 'Maximum number of results to return (0-100, default: 20)', example: { limit: 20 }, required: false },
                      };
                    }
                    // Other gateway detail endpoints have no params
                    return {};
                  }
                  
                  // AP detail endpoints with trends
                  if (endpointLower.includes('/aps/') && endpointLower.match(/\/aps\/[^\/]+\//)) {
                    // Check if it's a trend endpoint
                    if (endpointLower.includes('/trends') || endpointLower.includes('/throughput') ||
                        endpointLower.includes('/channel-utilization') || endpointLower.includes('/channel-quality') ||
                        endpointLower.includes('/noise-floor') || endpointLower.includes('/transmission') ||
                        endpointLower.includes('/frames') || endpointLower.includes('/crc-errors') ||
                        endpointLower.includes('/collision-errors') || endpointLower.includes('/packet-loss') ||
                        endpointLower.includes('/jitter') || endpointLower.includes('/latency') ||
                        endpointLower.includes('/mos')) {
                      return {
                        'interval': { type: 'string', description: 'Time interval for trend data. Options: 5m, 1h, 1d', example: { interval: '5m' }, required: true },
                        'duration': { type: 'string', description: 'Duration for trend data. Options: 1h, 24h, 7d', example: { duration: '1h' }, required: true },
                      };
                    }
                    // AP list sub-resources (radios, ports, wlans, tunnels)
                    if (endpointLower.match(/\/aps\/[^\/]+\/(radios|ports|wlans|tunnels)$/)) {
                      return {
                        'limit': { type: 'integer', description: 'Maximum number of results to return (0-100, default: 20)', example: { limit: 20 }, required: false },
                        'offset': { type: 'integer', description: 'Pagination offset', example: { offset: 0 }, required: false },
                        'filter': { type: 'string', description: 'OData filter expression. Can filter by name, status, band, etc. Operators: eq, in. Only "and" conjunction supported.', example: { filter: "status eq 'Up'" }, required: false },
                      };
                    }
                    // Other AP detail endpoints have no params
                    return {};
                  }
                  
                  // Default: return common parameters
                  return commonParams;
                };
                
                const availableParams = getAvailableParams();
                const paramEntries = Object.entries(availableParams);
                
                if (paramEntries.length === 0) {
                  return (
                    <Typography variant="body2" color="text.secondary">
                      No query parameters available for this endpoint.
                    </Typography>
                  );
                }
                
                return (
                  <Box>
                    {/* Path Parameters Section */}
                    {pathParameters.length > 0 && (
                      <Box sx={{ mb: 4 }}>
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2, fontWeight: 600 }}>
                          Required Path Parameters:
                        </Typography>
                        <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block', fontStyle: 'italic' }}>
                          These parameters must be included in the endpoint path. Replace the placeholders (e.g., {'{serial}'}) with actual values.
                        </Typography>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          {pathParameters.map((pathParam, idx) => (
                            <Box 
                              key={idx}
                              sx={{ 
                                p: 2, 
                                bgcolor: 'rgba(25, 118, 210, 0.08)', 
                                borderRadius: 1,
                                border: '1px solid rgba(25, 118, 210, 0.2)'
                              }}
                            >
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, flexWrap: 'wrap' }}>
                                <Typography variant="subtitle2" sx={{ fontFamily: 'monospace', fontWeight: 'bold', color: 'primary.main' }}>
                                  {pathParam.name}
                                </Typography>
                                <Chip 
                                  label="Path Parameter" 
                                  size="small" 
                                  sx={{ height: 20, fontSize: '0.7rem', bgcolor: 'primary.main', color: 'white' }}
                                />
                                <Chip 
                                  label="Required" 
                                  size="small" 
                                  color="error"
                                  sx={{ height: 20, fontSize: '0.7rem', fontWeight: 'bold' }}
                                />
                              </Box>
                              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                                {pathParam.description}
                              </Typography>
                              <Box sx={{ mt: 1 }}>
                                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                                  Example value:
                                </Typography>
                                <Box sx={{ 
                                  p: 1, 
                                  bgcolor: 'rgba(0, 0, 0, 0.05)', 
                                  borderRadius: 0.5,
                                  fontFamily: 'monospace',
                                  fontSize: '0.875rem',
                                }}>
                                  {pathParam.example}
                                </Box>
                                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1, fontStyle: 'italic' }}>
                                  Replace <code>{pathParam.name}</code> in the endpoint path with: <code>{pathParam.example}</code>
                                </Typography>
                              </Box>
                            </Box>
                          ))}
                        </Box>
                      </Box>
                    )}
                    
                    {/* Query Parameters Section */}
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2, fontWeight: pathParameters.length > 0 ? 600 : 'normal' }}>
                      {pathParameters.length > 0 ? 'Query Parameters (Optional):' : 'Available query parameters for'} <code>{basePath}</code>:
                    </Typography>
                    {paramEntries.length === 0 ? (
                      <Typography variant="body2" color="text.secondary">
                        No query parameters available for this endpoint.
                      </Typography>
                    ) : (
                      <>
                        <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block', fontStyle: 'italic' }}>
                          You can combine multiple parameters. Example with multiple params shown below.
                        </Typography>
                        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      {paramEntries.map(([paramName, paramInfo]) => (
                        <Box 
                          key={paramName}
                          sx={{ 
                            p: 2, 
                            bgcolor: 'rgba(0, 0, 0, 0.02)', 
                            borderRadius: 1,
                            border: '1px solid rgba(0, 0, 0, 0.1)'
                          }}
                        >
                          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, flexWrap: 'wrap' }}>
                            <Typography variant="subtitle2" sx={{ fontFamily: 'monospace', fontWeight: 'bold', color: 'primary.main' }}>
                              {paramName}
                            </Typography>
                            <Chip 
                              label={paramInfo.type} 
                              size="small" 
                              sx={{ height: 20, fontSize: '0.7rem' }}
                            />
                            {paramInfo.required && (
                              <Chip 
                                label="Required" 
                                size="small" 
                                color="error"
                                sx={{ height: 20, fontSize: '0.7rem', fontWeight: 'bold' }}
                              />
                            )}
                          </Box>
                          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                            {paramInfo.description}
                          </Typography>
                          {paramInfo.example && (
                            <Box sx={{ mt: 1 }}>
                              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
                                Example (copy/paste into Query Parameters):
                              </Typography>
                              <Box sx={{ 
                                p: 1, 
                                bgcolor: 'rgba(0, 0, 0, 0.05)', 
                                borderRadius: 0.5,
                                fontFamily: 'monospace',
                                fontSize: '0.875rem',
                                cursor: 'pointer',
                                '&:hover': {
                                  bgcolor: 'rgba(0, 0, 0, 0.08)',
                                }
                              }}
                              onClick={() => {
                                const exampleJson = typeof paramInfo.example === 'object' 
                                  ? paramInfo.example
                                  : { [paramName]: paramInfo.example };
                                const currentParams = params.trim() ? JSON.parse(params) : {};
                                const mergedParams = { ...currentParams, ...exampleJson };
                                setParams(JSON.stringify(mergedParams, null, 2));
                              }}
                              title="Click to add this parameter to Query Parameters field"
                              >
                                {typeof paramInfo.example === 'object' 
                                  ? JSON.stringify(paramInfo.example, null, 2)
                                  : JSON.stringify({ [paramName]: paramInfo.example }, null, 2)}
                              </Box>
                              {/* Additional filter examples for filter parameter */}
                              {paramName === 'filter' && (() => {
                                // Determine endpoint-specific filter examples
                                const getFilterExamples = () => {
                                  // APs endpoint
                                  if (endpointLower === '/network-monitoring/v1alpha1/aps' || endpointLower.startsWith('/network-monitoring/v1alpha1/aps?')) {
                                    return [
                                      { label: 'Filter by site', example: { filter: "siteId eq 'YOUR_SITE_ID'" } },
                                      { label: 'Filter by status (Up, Down)', example: { filter: "status eq 'Up'" } },
                                      { label: 'Filter by model (e.g., 505, 515)', example: { filter: "model eq '505'" } },
                                      { label: 'Filter by device name', example: { filter: "deviceName eq 'AP-505-01'" } },
                                      { label: 'Filter by serial number', example: { filter: "serialNumber eq 'SERIAL123456'" } },
                                      { label: 'Filter by cluster ID', example: { filter: "clusterId eq 'cluster-123'" } },
                                      { label: 'Filter by cluster name', example: { filter: "clusterName eq 'Main Cluster'" } },
                                      { label: 'Filter by deployment type', example: { filter: "deployment eq 'branch'" } },
                                      { label: 'Filter multiple serials using \'in\' operator', example: { filter: "serialNumber in ('SERIAL123456', 'ABC123', 'DEF456')" } },
                                      { label: 'Filter by status and site together', example: { filter: "status eq 'Up' and siteId eq 'YOUR_SITE_ID'" } },
                                      { label: 'Filter by model and status', example: { filter: "model eq '505' and status eq 'Up'" } },
                                    ];
                                  }
                                  
                                  // Devices endpoint
                                  if (endpointLower.includes('/devices') && !endpointLower.includes('/device-')) {
                                    // Check if params contain a filter for switches or gateways
                                    let currentFilter = '';
                                    try {
                                      const currentParams = params.trim() ? JSON.parse(params) : {};
                                      currentFilter = currentParams.filter || '';
                                    } catch (e) {
                                      // Invalid JSON, ignore
                                    }
                                    
                                    // If filter contains deviceType eq 'SWITCH', show switch-specific examples
                                    if (currentFilter.includes("deviceType eq 'SWITCH'")) {
                                      return [
                                        { label: 'Filter by site', example: { filter: "deviceType eq 'SWITCH' and siteId eq 'YOUR_SITE_ID'" } },
                                        { label: 'Filter by status (Up, Down)', example: { filter: "deviceType eq 'SWITCH' and status eq 'Up'" } },
                                        { label: 'Filter by model', example: { filter: "deviceType eq 'SWITCH' and model eq '2930F'" } },
                                        { label: 'Filter by device name', example: { filter: "deviceType eq 'SWITCH' and deviceName eq 'switch-01'" } },
                                        { label: 'Filter by serial number', example: { filter: "deviceType eq 'SWITCH' and serialNumber eq 'SERIAL123456'" } },
                                        { label: 'Filter multiple serials using \'in\' operator', example: { filter: "deviceType eq 'SWITCH' and serialNumber in ('SERIAL123456', 'ABC123', 'DEF456')" } },
                                        { label: 'Filter by status and site together', example: { filter: "deviceType eq 'SWITCH' and status eq 'Up' and siteId eq 'YOUR_SITE_ID'" } },
                                        { label: 'Filter by model and status', example: { filter: "deviceType eq 'SWITCH' and model eq '2930F' and status eq 'Up'" } },
                                      ];
                                    }
                                    
                                    // If filter contains deviceType eq 'GATEWAY', show gateway-specific examples
                                    if (currentFilter.includes("deviceType eq 'GATEWAY'")) {
                                      return [
                                        { label: 'Filter by site', example: { filter: "deviceType eq 'GATEWAY' and siteId eq 'YOUR_SITE_ID'" } },
                                        { label: 'Filter by status (Up, Down)', example: { filter: "deviceType eq 'GATEWAY' and status eq 'Up'" } },
                                        { label: 'Filter by model', example: { filter: "deviceType eq 'GATEWAY' and model eq '7005'" } },
                                        { label: 'Filter by device name', example: { filter: "deviceType eq 'GATEWAY' and deviceName eq 'gateway-01'" } },
                                        { label: 'Filter by serial number', example: { filter: "deviceType eq 'GATEWAY' and serialNumber eq 'SERIAL123456'" } },
                                        { label: 'Filter multiple serials using \'in\' operator', example: { filter: "deviceType eq 'GATEWAY' and serialNumber in ('SERIAL123456', 'ABC123', 'DEF456')" } },
                                        { label: 'Filter by status and site together', example: { filter: "deviceType eq 'GATEWAY' and status eq 'Up' and siteId eq 'YOUR_SITE_ID'" } },
                                      ];
                                    }
                                    
                                    // Default: general device filter examples
                                    return [
                                      { label: 'Filter by device type (SWITCH, AP, GATEWAY)', example: { filter: "deviceType eq 'SWITCH'" } },
                                      { label: 'Filter by status (Up, Down)', example: { filter: "status eq 'Up'" } },
                                      { label: 'Filter by site', example: { filter: "siteId eq 'YOUR_SITE_ID'" } },
                                      { label: 'Filter by model', example: { filter: "model eq '505'" } },
                                      { label: 'Filter by serial number', example: { filter: "serialNumber eq 'SERIAL123456'" } },
                                      { label: 'Filter by device name', example: { filter: "deviceName eq 'switch-01'" } },
                                      { label: 'Filter multiple device types', example: { filter: "deviceType in ('SWITCH', 'AP')" } },
                                      { label: 'Filter multiple serials using \'in\' operator', example: { filter: "serialNumber in ('SERIAL123456', 'ABC123', 'DEF456')" } },
                                      { label: 'Filter by deviceType and status', example: { filter: "deviceType eq 'SWITCH' and status eq 'Up'" } },
                                      { label: 'Filter by deviceType, serialNumber, and deviceName together', example: { filter: "deviceType eq 'SWITCH' and serialNumber eq 'SERIAL123456' and deviceName eq 'switch-01'" } },
                                    ];
                                  }
                                  
                                  // Switches endpoint
                                  if (endpointLower === '/network-monitoring/v1alpha1/switches' || endpointLower.startsWith('/network-monitoring/v1alpha1/switches?')) {
                                    return [
                                      { label: 'Filter by site', example: { filter: "siteId eq 'YOUR_SITE_ID'" } },
                                      { label: 'Filter by status (Up, Down)', example: { filter: "status eq 'Up'" } },
                                      { label: 'Filter by model', example: { filter: "model eq '2930F'" } },
                                      { label: 'Filter by device name', example: { filter: "deviceName eq 'switch-01'" } },
                                      { label: 'Filter by serial number', example: { filter: "serialNumber eq 'SERIAL123456'" } },
                                      { label: 'Filter multiple serials using \'in\' operator', example: { filter: "serialNumber in ('SERIAL123456', 'ABC123', 'DEF456')" } },
                                      { label: 'Filter by status and site together', example: { filter: "status eq 'Up' and siteId eq 'YOUR_SITE_ID'" } },
                                      { label: 'Filter by model and status', example: { filter: "model eq '2930F' and status eq 'Up'" } },
                                    ];
                                  }
                                  
                                  // Gateways endpoint
                                  if (endpointLower === '/network-monitoring/v1alpha1/gateways' || endpointLower.startsWith('/network-monitoring/v1alpha1/gateways?')) {
                                    return [
                                      { label: 'Filter by site', example: { filter: "siteId eq 'YOUR_SITE_ID'" } },
                                      { label: 'Filter by status (Up, Down)', example: { filter: "status eq 'Up'" } },
                                      { label: 'Filter by model', example: { filter: "model eq '7005'" } },
                                      { label: 'Filter by device name', example: { filter: "deviceName eq 'gateway-01'" } },
                                      { label: 'Filter by serial number', example: { filter: "serialNumber eq 'SERIAL123456'" } },
                                      { label: 'Filter multiple serials using \'in\' operator', example: { filter: "serialNumber in ('SERIAL123456', 'ABC123', 'DEF456')" } },
                                      { label: 'Filter by status and site together', example: { filter: "status eq 'Up' and siteId eq 'YOUR_SITE_ID'" } },
                                    ];
                                  }
                                  
                                  // Clients endpoint
                                  if (endpointLower.includes('/clients') && !endpointLower.includes('/clients/')) {
                                    return [
                                      { label: 'Filter by site', example: { filter: "siteId eq 'YOUR_SITE_ID'" } },
                                      { label: 'Filter by MAC address', example: { filter: "macAddress eq '00:11:22:33:44:55'" } },
                                      { label: 'Filter by SSID/WLAN name', example: { filter: "ssid eq 'MyNetwork'" } },
                                      { label: 'Filter by AP serial', example: { filter: "apSerial eq 'SERIAL123456'" } },
                                      { label: 'Filter by connection status', example: { filter: "status eq 'Connected'" } },
                                      { label: 'Filter multiple MACs using \'in\' operator', example: { filter: "macAddress in ('00:11:22:33:44:55', 'AA:BB:CC:DD:EE:FF')" } },
                                      { label: 'Filter by site and SSID together', example: { filter: "siteId eq 'YOUR_SITE_ID' and ssid eq 'MyNetwork'" } },
                                    ];
                                  }
                                  
                                  // Alerts endpoint
                                  if (endpointLower.includes('/alerts') && !endpointLower.includes('/alerts/')) {
                                    return [
                                      { label: 'Filter by site', example: { filter: "siteId eq 'YOUR_SITE_ID'" } },
                                      { label: 'Filter by severity (critical, major, minor, warning, info)', example: { filter: "severity eq 'critical'" } },
                                      { label: 'Filter by status (active, acknowledged, resolved)', example: { filter: "status eq 'active'" } },
                                      { label: 'Filter by device serial', example: { filter: "deviceSerial eq 'SERIAL123456'" } },
                                      { label: 'Filter by alert type', example: { filter: "alertType eq 'device_down'" } },
                                      { label: 'Filter by severity and status', example: { filter: "severity eq 'critical' and status eq 'active'" } },
                                      { label: 'Filter by site and severity', example: { filter: "siteId eq 'YOUR_SITE_ID' and severity eq 'critical'" } },
                                    ];
                                  }
                                  
                                  // Swarms endpoint
                                  if (endpointLower.includes('/swarms') && !endpointLower.includes('/swarms/')) {
                                    return [
                                      { label: 'Filter by site', example: { filter: "siteId eq 'YOUR_SITE_ID'" } },
                                      { label: 'Filter by swarm name', example: { filter: "name eq 'Main Swarm'" } },
                                      { label: 'Filter by swarm ID', example: { filter: "swarmId eq 'swarm-123'" } },
                                    ];
                                  }
                                  
                                  // Radios endpoint
                                  if (endpointLower === '/network-monitoring/v1alpha1/radios' || endpointLower.startsWith('/network-monitoring/v1alpha1/radios?')) {
                                    return [
                                      { label: 'Filter by AP serial', example: { filter: "apSerial eq 'SERIAL123456'" } },
                                      { label: 'Filter by radio band (2.4GHz, 5GHz, 6GHz)', example: { filter: "band eq '5GHz'" } },
                                      { label: 'Filter by radio status', example: { filter: "status eq 'Up'" } },
                                    ];
                                  }
                                  
                                  // Sites Health endpoint
                                  if (endpointLower.includes('/sites-health')) {
                                    return [
                                      { label: 'Filter by health status', example: { filter: "healthStatus eq 'healthy'" } },
                                      { label: 'Filter by site ID', example: { filter: "siteId eq 'YOUR_SITE_ID'" } },
                                    ];
                                  }
                                  
                                  // Sites Device Health endpoint
                                  if (endpointLower.includes('/sites-device-health') || endpointLower.includes('/tenant-device-health')) {
                                    return [
                                      { label: 'Filter by device type (SWITCH, AP, GATEWAY)', example: { filter: "deviceType eq 'AP'" } },
                                      { label: 'Filter by status (Up, Down)', example: { filter: "status eq 'Up'" } },
                                      { label: 'Filter by site', example: { filter: "siteId eq 'YOUR_SITE_ID'" } },
                                      { label: 'Filter by deviceType and status', example: { filter: "deviceType eq 'AP' and status eq 'Up'" } },
                                    ];
                                  }
                                  
                                  // Location devices endpoint
                                  if (endpointLower.includes('/services/v1alpha1/location/devices') && !endpointLower.includes('/devices/')) {
                                    return [
                                      { label: 'Filter by device type', example: { filter: "deviceType eq 'AP'" } },
                                      { label: 'Filter by serial number', example: { filter: "serialNumber eq 'SERIAL123456'" } },
                                      { label: 'Filter by site', example: { filter: "siteId eq 'YOUR_SITE_ID'" } },
                                    ];
                                  }
                                  
                                  // Location clients endpoint
                                  if (endpointLower.includes('/services/v1alpha1/location/clients') && !endpointLower.includes('/clients/')) {
                                    return [
                                      { label: 'Filter by site', example: { filter: "siteId eq 'YOUR_SITE_ID'" } },
                                      { label: 'Filter by MAC address', example: { filter: "macAddress eq '00:11:22:33:44:55'" } },
                                      { label: 'Filter by SSID', example: { filter: "ssid eq 'MyNetwork'" } },
                                      { label: 'Filter by site and SSID', example: { filter: "siteId eq 'YOUR_SITE_ID' and ssid eq 'MyNetwork'" } },
                                    ];
                                  }
                                  
                                  // Asset tags endpoint
                                  if (endpointLower.includes('/services/v1alpha1/location/asset-tags') && !endpointLower.includes('/asset-tags/')) {
                                    return [
                                      { label: 'Filter by tag name', example: { filter: "name eq 'Tag1'" } },
                                      { label: 'Filter by site', example: { filter: "siteId eq 'YOUR_SITE_ID'" } },
                                    ];
                                  }
                                  
                                  // Switch interfaces/VLANs/ports
                                  if (endpointLower.includes('/switch/') && (endpointLower.includes('/interfaces') || endpointLower.includes('/vlans') || endpointLower.includes('/ports'))) {
                                    return [
                                      { label: 'Filter by status (Up, Down)', example: { filter: "status eq 'Up'" } },
                                      { label: 'Filter by interface name', example: { filter: "name eq 'GigabitEthernet0/1'" } },
                                      { label: 'Filter by VLAN ID', example: { filter: "vlanId eq '100'" } },
                                      { label: 'Filter by status and name', example: { filter: "status eq 'Up' and name eq 'GigabitEthernet0/1'" } },
                                    ];
                                  }
                                  
                                  // Gateway sub-resources (tunnels, interfaces, vlans)
                                  if (endpointLower.includes('/gateways/') && (endpointLower.includes('/tunnels') || endpointLower.includes('/interfaces') || endpointLower.includes('/vlans'))) {
                                    return [
                                      { label: 'Filter by status (Up, Down)', example: { filter: "status eq 'Up'" } },
                                      { label: 'Filter by name', example: { filter: "name eq 'tunnel-01'" } },
                                      { label: 'Filter by type', example: { filter: "type eq 'lan'" } },
                                      { label: 'Filter by status and name', example: { filter: "status eq 'Up' and name eq 'tunnel-01'" } },
                                    ];
                                  }
                                  
                                  // Firmware endpoint
                                  if (endpointLower.includes('/services/v1alpha1/firmware/')) {
                                    return [
                                      { label: 'Filter by device type (SWITCH, AP, GATEWAY)', example: { filter: "deviceType eq 'AP'" } },
                                      { label: 'Filter by model', example: { filter: "model eq '505'" } },
                                      { label: 'Filter by current version', example: { filter: "currentVersion eq '8.10.0.0'" } },
                                      { label: 'Filter by target version', example: { filter: "targetVersion eq '8.11.0.0'" } },
                                      { label: 'Filter by deviceType and currentVersion', example: { filter: "deviceType eq 'AP' and currentVersion eq '8.10.0.0'" } },
                                    ];
                                  }
                                  
                                  // Reporting endpoint
                                  if (endpointLower.includes('/reporting/v1alpha1/reports') && !endpointLower.match(/\/reports\/[^\/]+$/)) {
                                    return [
                                      { label: 'Filter by report name', example: { filter: "name eq 'Monthly Report'" } },
                                      { label: 'Filter by report type', example: { filter: "type eq 'custom'" } },
                                      { label: 'Filter by status', example: { filter: "status eq 'active'" } },
                                    ];
                                  }
                                  
                                  // Default generic examples
                                  return [
                                    { label: 'Filter by site', example: { filter: "siteId eq 'YOUR_SITE_ID'" } },
                                    { label: 'Filter by status', example: { filter: "status eq 'Up'" } },
                                    { label: 'Filter by model', example: { filter: "model eq '505'" } },
                                    { label: 'Filter by serial number', example: { filter: "serialNumber eq 'SERIAL123456'" } },
                                    { label: 'Filter by device name', example: { filter: "deviceName eq 'device-01'" } },
                                    { label: 'Filter multiple values using \'in\' operator', example: { filter: "serialNumber in ('SERIAL123456', 'ABC123', 'DEF456')" } },
                                    { label: 'Filter by multiple conditions', example: { filter: "status eq 'Up' and siteId eq 'YOUR_SITE_ID'" } },
                                  ];
                                };
                                
                                const filterExamples = getFilterExamples();
                                
                                return (
                                  <Box sx={{ mt: 2 }}>
                                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1, fontWeight: 'bold' }}>
                                      More filter examples for this endpoint:
                                    </Typography>
                                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                                      {filterExamples.map((filterExample, idx) => (
                                      <Box key={idx} sx={{ 
                                        p: 1, 
                                        bgcolor: 'rgba(0, 0, 0, 0.05)', 
                                        borderRadius: 0.5,
                                        fontFamily: 'monospace',
                                        fontSize: '0.875rem',
                                        cursor: 'pointer',
                                        '&:hover': {
                                          bgcolor: 'rgba(0, 0, 0, 0.08)',
                                        }
                                      }}
                                      onClick={() => {
                                        const currentParams = params.trim() ? JSON.parse(params) : {};
                                        const mergedParams = { ...currentParams, ...filterExample.example };
                                        setParams(JSON.stringify(mergedParams, null, 2));
                                      }}
                                      title="Click to add this filter example to Query Parameters field"
                                      >
                                        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5, fontSize: '0.7rem' }}>
                                          {filterExample.label}:
                                        </Typography>
                                        {JSON.stringify(filterExample.example, null, 2)}
                                      </Box>
                                    ))}
                                  </Box>
                                </Box>
                              );
                            })()}
                            </Box>
                          )}
                        </Box>
                      ))}
                    </Box>
                    {paramEntries.length > 1 && (
                      <Box sx={{ mt: 1 }}>
                        <Box sx={{ 
                          p: 1, 
                          bgcolor: 'rgba(0, 0, 0, 0.05)', 
                          borderRadius: 0.5,
                          fontFamily: 'monospace',
                          fontSize: '0.875rem',
                          cursor: 'pointer',
                          '&:hover': {
                            bgcolor: 'rgba(0, 0, 0, 0.08)',
                          }
                        }}
                        onClick={() => {
                          const multiParamExample = {};
                          paramEntries.slice(0, 3).forEach(([name, info]) => {
                            if (info.example) {
                              if (typeof info.example === 'object') {
                                Object.assign(multiParamExample, info.example);
                              } else {
                                multiParamExample[name] = info.example;
                              }
                            }
                          });
                          setParams(JSON.stringify(multiParamExample, null, 2));
                        }}
                        title="Click to add multiple parameters to Query Parameters field"
                        >
                          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5, fontSize: '0.7rem' }}>
                            Example with multiple parameters:
                          </Typography>
                          {JSON.stringify(
                            paramEntries.slice(0, 3).reduce((acc, [name, info]) => {
                              if (info.example) {
                                if (typeof info.example === 'object') {
                                  Object.assign(acc, info.example);
                                } else {
                                  acc[name] = info.example;
                                }
                              }
                              return acc;
                            }, {}),
                            null,
                            2
                          )}
                        </Box>
                      </Box>
                    )}
                      </>
                    )}
                  </Box>
                );
              })()}
            </AccordionDetails>
          </Accordion>
        </Card>
      )}

      {/* Error Display */}
      {error && (
        <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}

      {/* Response Display */}
      {response && (
        <Card sx={{ mb: 3, boxShadow: 2 }}>
          <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
              <Typography variant="h6">Response</Typography>
              <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                {response.success && response.data && (
                  <>
                    <Button
                      variant="outlined"
                      size="small"
                      onClick={() => {
                        // Extract common query parameters from response
                        try {
                          const data = response.data;
                          const extractedParams = {};
                          
                          // Extract site-id from response items if available
                          if (data.items && Array.isArray(data.items) && data.items.length > 0) {
                            const firstItem = data.items[0];
                            if (firstItem.siteId) {
                              extractedParams['site-id'] = firstItem.siteId;
                            } else if (firstItem.site) {
                              extractedParams['site-id'] = firstItem.site;
                            } else if (firstItem.scopeId) {
                              extractedParams['site-id'] = firstItem.scopeId;
                            }
                          }
                          
                          // Extract other useful parameters
                          if (data.count !== undefined) {
                            extractedParams['limit'] = Math.min(data.count, 100);
                          }
                          
                          // Merge with existing params
                          const currentParams = params.trim() ? JSON.parse(params) : {};
                          const mergedParams = { ...currentParams, ...extractedParams };
                          setParams(JSON.stringify(mergedParams, null, 2));
                          
                          // Update endpoint if we have one
                          if (endpoint && Object.keys(extractedParams).length > 0) {
                            const { basePath } = parseEndpoint(endpoint);
                            setEndpoint(buildEndpoint(basePath, mergedParams));
                          }
                        } catch (err) {
                          console.error('Failed to extract parameters:', err);
                        }
                      }}
                      title="Extract query parameters (like site-id) from the response data"
                    >
                      Extract Params
                    </Button>
                    <Button
                      variant="outlined"
                      size="small"
                      startIcon={<DownloadIcon />}
                      onClick={handleExportCSV}
                    >
                      Export CSV
                    </Button>
                  </>
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
                border: '1px solid',
                borderColor: 'divider',
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
      <Card sx={{ boxShadow: 2 }}>
        <CardContent sx={{ p: { xs: 2, sm: 3 } }}>
          <Accordion defaultExpanded={false} sx={{ boxShadow: 'none', '&:before': { display: 'none' } }}>
            <AccordionSummary 
              expandIcon={<ExpandMoreIcon />}
              sx={{
                px: 0,
                '& .MuiAccordionSummary-content': {
                  my: 0,
                },
              }}
            >
              <Typography variant="h6">Documentation</Typography>
            </AccordionSummary>
            <AccordionDetails sx={{ px: 0, pt: 2 }}>
              <Typography variant="body2" color="text.secondary" paragraph>
                Use this API Explorer to test Aruba Central API endpoints. All requests are proxied
                through the backend server to maintain security.
              </Typography>
              
              <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600, mb: 1, mt: 2 }}>
                Tips:
              </Typography>
              <Box component="ul" sx={{ pl: 2, mb: 2 }}>
                <li>
                  <Typography variant="body2" color="text.secondary" component="span">
                    Start with GET requests to retrieve data
                  </Typography>
                </li>
                <li>
                  <Typography variant="body2" color="text.secondary" component="span">
                    Use the common endpoints above for quick testing
                  </Typography>
                </li>
                <li>
                  <Typography variant="body2" color="text.secondary" component="span">
                    Query parameters and request body must be valid JSON
                  </Typography>
                </li>
                <li>
                  <Typography variant="body2" color="text.secondary" component="span">
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
              </Box>

              <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600, mb: 1, mt: 3 }}>
                Important Notes:
              </Typography>
              <Box component="ul" sx={{ pl: 2, mb: 2 }}>
                <li>
                  <Typography variant="body2" color="text.secondary" component="span">
                    All endpoints use the <strong>New Central API (v1alpha1)</strong> format
                  </Typography>
                </li>
                <li>
                  <Typography variant="body2" color="text.secondary" component="span">
                    Base URL: <code>https://internal.api.central.arubanetworks.com</code>
                  </Typography>
                </li>
                <li>
                  <Typography variant="body2" color="text.secondary" component="span">
                    Legacy endpoints like <code>/monitoring/v1/*</code>, <code>/central/v2/*</code>, <code>/configuration/v1/*</code>, and <code>/platform/*</code> are <strong>not available</strong> in v1alpha1
                  </Typography>
                </li>
                <li>
                  <Typography variant="body2" color="text.secondary" component="span">
                    For switches, use <code>/network-monitoring/v1alpha1/devices</code> with filter: <code>deviceType eq 'SWITCH'</code>
                  </Typography>
                </li>
              </Box>

            </AccordionDetails>
          </Accordion>
        </CardContent>
      </Card>
    </Box>
  );
}

export default APIExplorerPage;
