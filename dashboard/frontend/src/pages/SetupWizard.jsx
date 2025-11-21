/**
 * Setup Wizard - First-time Configuration
 * Allows users to enter Aruba Central credentials via UI
 */

import { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Button,
  Typography,
  TextField,
  Alert,
  CircularProgress,
  Stepper,
  Step,
  StepLabel,
  InputAdornment,
  IconButton,
  Link,
  Divider,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from '@mui/material';
import {
  Visibility,
  VisibilityOff,
  Cloud as CloudIcon,
  CheckCircle as CheckCircleIcon,
  ArrowForward as ArrowForwardIcon,
  Settings as SettingsIcon,
} from '@mui/icons-material';
import axios from 'axios';
import { DEFAULT_API_BASE_URL, API_REGIONS, GREENLAKE_API_BASE_URL } from '../config/apiEndpoints';

// Use relative URL so it works with any host/port (e.g., http://your-nas-ip:1344/api)
const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

function SetupWizard({ onComplete }) {
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showSecret, setShowSecret] = useState(false);

  // Form state
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [baseUrl, setBaseUrl] = useState(DEFAULT_API_BASE_URL);
  // Optional: GreenLake RBAC (HPE GreenLake Platform) configuration
  const [enableRbac, setEnableRbac] = useState(false);
  const [rbacClientId, setRbacClientId] = useState('');
  const [rbacClientSecret, setRbacClientSecret] = useState('');

  const steps = ['Welcome', 'Enter Credentials', 'Verify & Save'];

  // Use regional endpoints from config (can be overridden via env vars)
  const regions = API_REGIONS;

  const handleNext = () => {
    setActiveStep((prevStep) => prevStep + 1);
  };

  const handleBack = () => {
    setActiveStep((prevStep) => prevStep - 1);
  };

  const handleSave = async () => {
    if (!clientId || !clientSecret || !customerId) {
      setError('All Aruba Central fields are required');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await axios.post(`${API_BASE_URL}/setup/configure`, {
        client_id: clientId,
        client_secret: clientSecret,
        customer_id: customerId,
        base_url: baseUrl,
        // Optional RBAC block is included only when enabled
        rbac: enableRbac
          ? {
              client_id: rbacClientId,
              client_secret: rbacClientSecret,
              api_base: GREENLAKE_API_BASE_URL,
            }
          : null,
      });

      if (response.data.success) {
        // Store session ID if provided (use localStorage to align with api client)
        if (response.data.session_id) {
          try {
            localStorage.setItem('aruba_session_id', response.data.session_id);
          } catch (_) {
            // ignore storage errors and continue
          }
        }

        // Wait a moment then complete
        setTimeout(() => {
          onComplete();
        }, 1500);
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save credentials. Please check your inputs.');
    } finally {
      setLoading(false);
    }
  };

  const renderStepContent = () => {
    switch (activeStep) {
      case 0:
        return (
          <Box>
            <Box sx={{ textAlign: 'center', mb: 4 }}>
              <CloudIcon sx={{ fontSize: 80, color: 'primary.main', mb: 2 }} />
              <Typography variant="h4" gutterBottom fontWeight={700}>
                Welcome to Aruba Central Portal
              </Typography>
              <Typography variant="body1" color="text.secondary">
                Let's get you connected to your Aruba Central workspace
              </Typography>
            </Box>

            <Alert severity="info" sx={{ mb: 3 }}>
              <Typography variant="subtitle2" gutterBottom>
                You'll need API credentials from Aruba Central
              </Typography>
              <Typography variant="body2">
                This is a one-time setup. Your credentials will be securely stored on the server.
              </Typography>
            </Alert>

            <Typography variant="h6" gutterBottom>
              What you'll need:
            </Typography>
            <List>
              <ListItem>
                <ListItemIcon>
                  <CheckCircleIcon color="success" />
                </ListItemIcon>
                <ListItemText
                  primary="Client ID"
                  secondary="From Aruba Central API Gateway"
                />
              </ListItem>
              <ListItem>
                <ListItemIcon>
                  <CheckCircleIcon color="success" />
                </ListItemIcon>
                <ListItemText
                  primary="Client Secret"
                  secondary="Generated when creating API credentials"
                />
              </ListItem>
              <ListItem>
                <ListItemIcon>
                  <CheckCircleIcon color="success" />
                </ListItemIcon>
                <ListItemText
                  primary="Customer ID"
                  secondary="Your workspace/tenant ID"
                />
              </ListItem>
            </List>

            <Divider sx={{ my: 3 }} />

            <Typography variant="body2" color="text.secondary" gutterBottom>
              <strong>Don't have API credentials yet?</strong>
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              1. Log into{' '}
              <Link href="https://common.cloud.hpe.com" target="_blank" rel="noopener">
                HPE GreenLake / Aruba Central
              </Link>
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              2. Go to <strong>Account Home → API Gateway → System Apps & Tokens</strong>
            </Typography>
            <Typography variant="body2" color="text.secondary" paragraph>
              3. Click <strong>Create</strong> and select <strong>Service Account</strong>
            </Typography>
            <Typography variant="body2" color="text.secondary">
              4. Copy the <strong>Client ID</strong>, <strong>Client Secret</strong>, and{' '}
              <strong>Customer ID</strong>
            </Typography>

            <Box sx={{ mt: 4, textAlign: 'center' }}>
              <Button
                variant="contained"
                size="large"
                onClick={handleNext}
                endIcon={<ArrowForwardIcon />}
              >
                Get Started
              </Button>
            </Box>
          </Box>
        );

      case 1:
        return (
          <Box>
            <Typography variant="h5" gutterBottom fontWeight={600}>
              Enter Your Credentials
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Paste the credentials you copied from Aruba Central
            </Typography>

            {error && (
              <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
                {error}
              </Alert>
            )}

            {/* Optional GreenLake RBAC section toggle */}
            <Alert severity="info" sx={{ mb: 2 }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                <Typography variant="body2">
                  Optionally add <strong>HPE GreenLake RBAC</strong> credentials to enable
                  tenant management (MSP), workspace creation and user access provisioning.
                </Typography>
                <Button size="small" onClick={() => setEnableRbac(!enableRbac)}>
                  {enableRbac ? 'Remove RBAC' : 'Add RBAC'}
                </Button>
              </Box>
            </Alert>

            <FormControl fullWidth sx={{ mb: 2 }}>
              <InputLabel>Region / Cluster</InputLabel>
              <Select
                value={baseUrl}
                label="Region / Cluster"
                onChange={(e) => setBaseUrl(e.target.value)}
              >
                {regions.map((region, idx) => (
                  <MenuItem key={idx} value={region.url}>
                    <Box>
                      <Typography variant="body2">{region.name}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {region.description}
                      </Typography>
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>

            <TextField
              fullWidth
              label="Client ID"
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              sx={{ mb: 2 }}
              placeholder="abc123def456ghi789..."
              helperText="Your API Client ID from Aruba Central"
            />

            <TextField
              fullWidth
              label="Client Secret"
              type={showSecret ? 'text' : 'password'}
              value={clientSecret}
              onChange={(e) => setClientSecret(e.target.value)}
              sx={{ mb: 2 }}
              placeholder="xyz789uvw456rst123..."
              helperText="Your API Client Secret (shown only once during creation)"
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton onClick={() => setShowSecret(!showSecret)} edge="end">
                      {showSecret ? <VisibilityOff /> : <Visibility />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />

            <TextField
              fullWidth
              label="Customer ID"
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              sx={{ mb: 3 }}
              placeholder="a1b2c3d4e5f6g7h8..."
              helperText="Your Customer ID / Workspace ID / Tenant ID"
            />

            {enableRbac && (
              <Box sx={{ p: 2, borderRadius: 1, border: '1px solid', borderColor: 'divider', mb: 3 }}>
                <Typography variant="subtitle1" gutterBottom fontWeight={600}>
                  HPE GreenLake RBAC (Optional)
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                  Provide GreenLake Platform credentials used for RBAC, MSP tenant creation and user management.
                  Requests will be sent to <code>{GREENLAKE_API_BASE_URL}</code>.
                </Typography>
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 2 }}>
                  <TextField
                    fullWidth
                    label="RBAC Client ID"
                    value={rbacClientId}
                    onChange={(e) => setRbacClientId(e.target.value)}
                    placeholder="rbac-abc123..."
                  />
                  <TextField
                    fullWidth
                    label="RBAC Client Secret"
                    type="password"
                    value={rbacClientSecret}
                    onChange={(e) => setRbacClientSecret(e.target.value)}
                    placeholder="rbac-secret..."
                  />
                </Box>
              </Box>
            )}

            <Alert severity="warning" sx={{ mb: 3 }}>
              <Typography variant="body2">
                <strong>Important:</strong> Make sure you're using credentials from{' '}
                <strong>New Central (HPE GreenLake)</strong>, not Classic Central.
              </Typography>
            </Alert>

            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Button onClick={handleBack}>Back</Button>
              <Button
                variant="contained"
                onClick={handleNext}
                disabled={!clientId || !clientSecret || !customerId}
              >
                Next
              </Button>
            </Box>
          </Box>
        );

      case 2:
        return (
          <Box>
            <Typography variant="h5" gutterBottom fontWeight={600}>
              Verify Your Settings
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Please review your configuration before saving
            </Typography>

            <Card sx={{ mb: 3, bgcolor: 'rgba(255, 102, 0, 0.05)' }}>
              <CardContent>
                <Typography variant="subtitle2" gutterBottom color="text.secondary">
                  Region / Base URL:
                </Typography>
                <Typography variant="body1" sx={{ mb: 2, fontFamily: 'monospace', fontSize: '0.9rem' }}>
                  {baseUrl}
                </Typography>

                <Typography variant="subtitle2" gutterBottom color="text.secondary">
                  Client ID:
                </Typography>
                <Typography variant="body1" sx={{ mb: 2, fontFamily: 'monospace', fontSize: '0.9rem' }}>
                  {clientId.substring(0, 20)}...
                </Typography>

                <Typography variant="subtitle2" gutterBottom color="text.secondary">
                  Client Secret:
                </Typography>
                <Typography variant="body1" sx={{ mb: 2, fontFamily: 'monospace', fontSize: '0.9rem' }}>
                  {'•'.repeat(20)}...
                </Typography>

                <Typography variant="subtitle2" gutterBottom color="text.secondary">
                  Customer ID:
                </Typography>
                <Typography variant="body1" sx={{ fontFamily: 'monospace', fontSize: '0.9rem' }}>
                  {customerId.substring(0, 20)}...
                </Typography>
              </CardContent>
            </Card>

            <Alert severity="info" sx={{ mb: 3 }}>
              <Typography variant="body2">
                Your credentials will be saved to a <strong>.env</strong> file on the server.
                They are never sent to any third party.
              </Typography>
            </Alert>

            {error && (
              <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError('')}>
                {error}
              </Alert>
            )}

            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Button onClick={handleBack} disabled={loading}>
                Back
              </Button>
              <Button
                variant="contained"
                color="success"
                onClick={handleSave}
                disabled={loading}
                startIcon={loading ? <CircularProgress size={20} /> : <SettingsIcon />}
              >
                {loading ? 'Saving...' : 'Save & Continue'}
              </Button>
            </Box>
          </Box>
        );

      default:
        return null;
    }
  };

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #000000 0%, #171717 100%)',
        p: 2,
      }}
    >
      <Card sx={{ maxWidth: 700, width: '100%' }}>
        <CardContent sx={{ p: 4 }}>
          <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
            {steps.map((label) => (
              <Step key={label}>
                <StepLabel>{label}</StepLabel>
              </Step>
            ))}
          </Stepper>

          {renderStepContent()}
        </CardContent>
      </Card>
    </Box>
  );
}

export default SetupWizard;
