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
import { explorerAPI } from '../services/api';

SyntaxHighlighter.registerLanguage('json', json);

// Common API endpoints for quick access
const COMMON_ENDPOINTS = [
  { path: '/monitoring/v1/devices', method: 'GET', description: 'Get all devices' },
  { path: '/monitoring/v1/switches', method: 'GET', description: 'Get all switches' },
  {
    path: '/network-monitoring/v1alpha1/aps',
    method: 'GET',
    description: 'Get all access points (APs)',
    params: { limit: 20 },
    notes: 'Supports filter, sort, limit, and next query parameters'
  },
  { path: '/central/v2/sites', method: 'GET', description: 'Get all sites' },
  { path: '/configuration/v1/groups', method: 'GET', description: 'Get configuration groups' },
  { path: '/configuration/v1/templates', method: 'GET', description: 'Get configuration templates' },
  { path: '/platform/rbac/v1/users', method: 'GET', description: 'Get all users' },
  { path: '/platform/device_inventory/v1/devices', method: 'GET', description: 'Get device inventory' },
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

  const loadEndpoint = (path, httpMethod, exampleParams = null) => {
    setEndpoint(path);
    setMethod(httpMethod);
    setParams(exampleParams ? JSON.stringify(exampleParams, null, 2) : '');
    setBody('');
    setResponse(null);
    setError('');
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
            Common Endpoints
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Click to quickly load an endpoint
          </Typography>
          <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
            {COMMON_ENDPOINTS.map((ep, index) => (
              <Chip
                key={index}
                label={ep.description}
                onClick={() => loadEndpoint(ep.path, ep.method, ep.params)}
                clickable
                variant="outlined"
                sx={{
                  '&:hover': {
                    backgroundColor: 'primary.main',
                    color: 'white',
                  },
                }}
              />
            ))}
          </Box>
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
              <Chip
                label={response.success ? 'Success' : 'Error'}
                color={response.success ? 'success' : 'error'}
                size="small"
              />
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
                  href="https://developer.arubanetworks.com/aruba-central/docs"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: '#01a982' }}
                >
                  official API documentation
                </a>{' '}
                for available endpoints
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
{"filter": "siteId eq '12345'"}

// Filter by status
{"filter": "status eq 'Up'"}

// Filter by model
{"filter": "model eq '505'"}

// Multiple filters (only 'and' supported)
{"filter": "status eq 'Up' and siteId eq '12345'"}

// Filter using 'in' operator
{"filter": "serialNumber in ('ABC123', 'DEF456')"}

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
