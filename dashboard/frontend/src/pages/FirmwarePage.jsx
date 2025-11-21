/**
 * Firmware Management Page
 * View firmware compliance and schedule upgrades
 */

import { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Button,
  Chip,
  CircularProgress,
  Alert,
} from '@mui/material';
import {
  SystemUpdate as SystemUpdateIcon,
  CheckCircle as CheckCircleIcon,
  Warning as WarningIcon,
} from '@mui/icons-material';
import { firmwareAPI } from '../services/api';

function FirmwarePage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [compliance, setCompliance] = useState(null);

  useEffect(() => {
    fetchCompliance();
  }, []);

  const fetchCompliance = async () => {
    try {
      setLoading(true);
      setError('');
      const data = await firmwareAPI.getCompliance();
      setCompliance(data);
    } catch (err) {
      setError(err.message || 'Failed to load firmware compliance data');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
          Firmware Management
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Monitor device firmware compliance and schedule upgrades
        </Typography>
      </Box>

      {error && (
        <Alert severity="info" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Grid container spacing={3}>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center">
                <Box>
                  <Typography color="textSecondary" gutterBottom>
                    Compliant Devices
                  </Typography>
                  <Typography variant="h4">
                    {compliance?.compliant || 'N/A'}
                  </Typography>
                </Box>
                <CheckCircleIcon sx={{ fontSize: 40, color: '#4caf50' }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center">
                <Box>
                  <Typography color="textSecondary" gutterBottom>
                    Non-Compliant
                  </Typography>
                  <Typography variant="h4">
                    {compliance?.non_compliant || 'N/A'}
                  </Typography>
                </Box>
                <WarningIcon sx={{ fontSize: 40, color: '#ff9800' }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Box display="flex" justifyContent="space-between" alignItems="center">
                <Box>
                  <Typography color="textSecondary" gutterBottom>
                    Upgrades Scheduled
                  </Typography>
                  <Typography variant="h4">
                    {compliance?.scheduled || 0}
                  </Typography>
                </Box>
                <SystemUpdateIcon sx={{ fontSize: 40, color: '#FF6600' }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Card sx={{ mt: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Firmware Management Tools
          </Typography>
          <Typography variant="body2" color="text.secondary" paragraph>
            Use this page to:
          </Typography>
          <Box component="ul" sx={{ pl: 2 }}>
            <Typography component="li" variant="body2" paragraph>
              Monitor firmware compliance across all devices
            </Typography>
            <Typography component="li" variant="body2" paragraph>
              View available firmware versions for each device type
            </Typography>
            <Typography component="li" variant="body2" paragraph>
              Schedule firmware upgrades for devices or groups
            </Typography>
            <Typography component="li" variant="body2">
              Track upgrade progress and rollback if needed
            </Typography>
          </Box>
          <Button
            variant="contained"
            startIcon={<SystemUpdateIcon />}
            sx={{ mt: 2 }}
            onClick={fetchCompliance}
          >
            Refresh Compliance
          </Button>
        </CardContent>
      </Card>
    </Box>
  );
}

export default FirmwarePage;
