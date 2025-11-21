/**
 * Login Page Component
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  Button,
  Typography,
  Alert,
  CircularProgress,
  Link,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Chip,
} from '@mui/material';
import NetworkCheckIcon from '@mui/icons-material/NetworkCheck';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import SecurityIcon from '@mui/icons-material/Security';
import CloudIcon from '@mui/icons-material/Cloud';
import TimerIcon from '@mui/icons-material/Timer';
import InfoIcon from '@mui/icons-material/Info';
import SettingsIcon from '@mui/icons-material/Settings';
import { authAPI } from '../services/api';

function LoginPage({ onLogin }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    setLoading(true);
    setError('');

    try {
      console.log('Starting login...');
      const result = await authAPI.login();
      console.log('Login successful:', result);
      onLogin();
      console.log('Navigating to dashboard...');
      // Navigate to dashboard after successful login
      navigate('/');
      console.log('Navigation complete');
    } catch (err) {
      console.error('Login error:', err);
      setError(err.message || 'Authentication failed. Please check server configuration.');
    } finally {
      setLoading(false);
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
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Animated background elements */}
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          opacity: 0.1,
          background: `
            radial-gradient(circle at 20% 50%, #FF6600 0%, transparent 50%),
            radial-gradient(circle at 80% 80%, #FF6600 0%, transparent 50%)
          `,
        }}
      />

      <Card
        sx={{
          maxWidth: 450,
          width: '100%',
          mx: 2,
          position: 'relative',
          zIndex: 1,
        }}
      >
        <CardContent sx={{ p: 4 }}>
          {/* Logo */}
          <Box
            sx={{
              display: 'flex',
              justifyContent: 'center',
              mb: 3,
            }}
          >
            <NetworkCheckIcon
              sx={{
                fontSize: 64,
                color: 'primary.main',
              }}
            />
          </Box>

          {/* Title */}
          <Typography
            variant="h4"
            align="center"
            gutterBottom
            sx={{
              fontWeight: 700,
              background: 'linear-gradient(135deg, #FF6600 0%, #FF9933 100%)',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            Aruba Central Dashboard
          </Typography>

          <Box sx={{ textAlign: 'center', mb: 3 }}>
            <Typography variant="body1" color="text.secondary" gutterBottom>
              Interactive Configuration & Monitoring Platform
            </Typography>
            <Chip
              icon={<CloudIcon sx={{ fontSize: 16 }} />}
              label="HPE GreenLake | New Central"
              size="small"
              sx={{
                mt: 1,
                backgroundColor: 'rgba(255, 102, 0, 0.2)',
                color: 'primary.main',
                fontWeight: 600,
              }}
            />
          </Box>

          {/* Error Alert */}
          {error && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
          )}

          {/* OAuth2 Client Credentials Flow Info */}
          <Box
            sx={{
              p: 2.5,
              mb: 3,
              borderRadius: 2,
              backgroundColor: 'rgba(255, 102, 0, 0.05)',
              border: '1px solid rgba(255, 102, 0, 0.2)',
            }}
          >
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 1.5 }}>
              <SecurityIcon sx={{ fontSize: 20, color: 'primary.main', mr: 1 }} />
              <Typography variant="subtitle2" fontWeight={600}>
                OAuth2 Client Credentials Authentication
              </Typography>
            </Box>

            <Typography variant="body2" color="text.secondary" paragraph>
              Authentication is handled securely by the backend server using your configured
              <strong> client_id</strong> and <strong>client_secret</strong>. No user credentials required.
            </Typography>

            <List dense disablePadding>
              <ListItem disableGutters sx={{ py: 0.5 }}>
                <ListItemIcon sx={{ minWidth: 32 }}>
                  <CheckCircleIcon sx={{ fontSize: 18, color: 'success.main' }} />
                </ListItemIcon>
                <ListItemText
                  primary={
                    <Typography variant="caption" color="text.secondary">
                      Secure token generation via HPE SSO
                    </Typography>
                  }
                />
              </ListItem>
              <ListItem disableGutters sx={{ py: 0.5 }}>
                <ListItemIcon sx={{ minWidth: 32 }}>
                  <TimerIcon sx={{ fontSize: 18, color: 'success.main' }} />
                </ListItemIcon>
                <ListItemText
                  primary={
                    <Typography variant="caption" color="text.secondary">
                      Automatic token refresh (2-hour expiry)
                    </Typography>
                  }
                />
              </ListItem>
              <ListItem disableGutters sx={{ py: 0.5 }}>
                <ListItemIcon sx={{ minWidth: 32 }}>
                  <CheckCircleIcon sx={{ fontSize: 18, color: 'success.main' }} />
                </ListItemIcon>
                <ListItemText
                  primary={
                    <Typography variant="caption" color="text.secondary">
                      Rate limit: 5000 calls/day, 7 calls/sec
                    </Typography>
                  }
                />
              </ListItem>
            </List>
          </Box>

          {/* Login Button */}
          <Button
            fullWidth
            variant="contained"
            size="large"
            onClick={handleLogin}
            disabled={loading}
            startIcon={loading ? <CircularProgress size={20} /> : <LockOpenIcon />}
            sx={{
              py: 1.5,
              fontSize: '1.1rem',
              fontWeight: 600,
              background: 'linear-gradient(135deg, #FF6600 0%, #FF9933 100%)',
              '&:hover': {
                background: 'linear-gradient(135deg, #CC5200 0%, #FF6600 100%)',
              },
            }}
          >
            {loading ? 'Connecting...' : 'Connect to Aruba Central'}
          </Button>

          {/* Setup Wizard Button */}
          <Button
            fullWidth
            variant="outlined"
            size="large"
            onClick={() => navigate('/setup-wizard')}
            startIcon={<SettingsIcon />}
            sx={{
              mt: 2,
              py: 1.5,
              fontSize: '1rem',
              fontWeight: 600,
              borderColor: 'primary.main',
              color: 'primary.main',
              '&:hover': {
                borderColor: 'primary.light',
                backgroundColor: 'rgba(255, 102, 0, 0.08)',
              },
            }}
          >
            Setup Wizard (Configure Credentials)
          </Button>

          {/* Footer */}
          <Box sx={{ mt: 4, pt: 3, borderTop: '1px solid rgba(255, 255, 255, 0.12)' }}>
            <Typography variant="caption" color="text.secondary" align="center" display="block" gutterBottom>
              Powered by HPE Aruba Networking Central APIs (New Central / GreenLake)
            </Typography>
            <Typography variant="caption" color="text.secondary" align="center" display="block" paragraph>
              Version 2.0.0 • API v1alpha1
            </Typography>

            <Divider sx={{ my: 2 }} />

            <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2, flexWrap: 'wrap' }}>
              <Link
                href="https://developer.arubanetworks.com/new-central/docs/getting-started-with-rest-apis"
                target="_blank"
                rel="noopener"
                variant="caption"
                sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
              >
                <InfoIcon sx={{ fontSize: 14 }} />
                API Documentation
              </Link>
              <Link
                href="https://developer.arubanetworks.com/new-central/docs/generating-and-managing-access-tokens"
                target="_blank"
                rel="noopener"
                variant="caption"
                sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}
              >
                <SecurityIcon sx={{ fontSize: 14 }} />
                Token Management
              </Link>
            </Box>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}

export default LoginPage;
