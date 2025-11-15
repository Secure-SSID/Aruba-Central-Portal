/**
 * Analytics Page
 * Network analytics and reports
 */

import { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Button,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
} from '@mui/material';
import {
  Assessment as AssessmentIcon,
  TrendingUp as TrendingUpIcon,
  Speed as SpeedIcon,
} from '@mui/icons-material';

function AnalyticsPage() {
  const [timeframe, setTimeframe] = useState('1d');

  return (
    <Box>
      <Box sx={{ mb: 4, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 700, mb: 1 }}>
            Analytics & Reports
          </Typography>
          <Typography variant="body1" color="text.secondary">
            Network usage analytics and performance metrics
          </Typography>
        </Box>
        <FormControl sx={{ minWidth: 150 }}>
          <InputLabel>Timeframe</InputLabel>
          <Select value={timeframe} onChange={(e) => setTimeframe(e.target.value)} label="Timeframe">
            <MenuItem value="1h">Last Hour</MenuItem>
            <MenuItem value="1d">Last Day</MenuItem>
            <MenuItem value="7d">Last 7 Days</MenuItem>
            <MenuItem value="30d">Last 30 Days</MenuItem>
          </Select>
        </FormControl>
      </Box>

      <Grid container spacing={3}>
        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <TrendingUpIcon sx={{ mr: 1, color: '#FF6600' }} />
                <Typography variant="h6">Bandwidth Usage</Typography>
              </Box>
              <Typography variant="body2" color="text.secondary">
                Aggregate bandwidth metrics for selected timeframe
              </Typography>
              <Box sx={{ mt: 2, p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  Data will be available when monitoring APIs are accessible
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <AssessmentIcon sx={{ mr: 1, color: '#FF6600' }} />
                <Typography variant="h6">Client Trends</Typography>
              </Box>
              <Typography variant="body2" color="text.secondary">
                Connected client count over time
              </Typography>
              <Box sx={{ mt: 2, p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  Client trends data from monitoring API
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={4}>
          <Card>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                <SpeedIcon sx={{ mr: 1, color: '#FF6600' }} />
                <Typography variant="h6">AP Performance</Typography>
              </Box>
              <Typography variant="body2" color="text.secondary">
                Access Point performance metrics
              </Typography>
              <Box sx={{ mt: 2, p: 2, bgcolor: 'background.default', borderRadius: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  Performance data for all APs
                </Typography>
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Card sx={{ mt: 3 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            About Analytics
          </Typography>
          <Typography variant="body2" color="text.secondary">
            This page displays network analytics data from Aruba Central monitoring APIs.
            Real-time charts and visualizations will populate when connected to Central monitoring endpoints.
            Use the timeframe selector above to adjust the data range.
          </Typography>
        </CardContent>
      </Card>
    </Box>
  );
}

export default AnalyticsPage;
