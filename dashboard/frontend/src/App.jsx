/**
 * Main App Component
 * Handles routing, authentication, and layout
 */

import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import Box from '@mui/material/Box';

// Pages
import SetupWizard from './pages/SetupWizard';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import DevicesPage from './pages/DevicesPage';
import DeviceDetailPage from './pages/DeviceDetailPage';
import ClientsPage from './pages/ClientsPage';
import ConfigurationPage from './pages/ConfigurationPage';
import APIExplorerPage from './pages/APIExplorerPage';
import UsersPage from './pages/UsersPage';
import TroubleshootPage from './pages/TroubleshootPage';
import NACPage from './pages/NACPage';
import SettingsPage from './pages/SettingsPage';
import SitesPage from './pages/SitesPage';
import WLANsPage from './pages/WLANsPage';
import AlertsPage from './pages/AlertsPage';
import AnalyticsPage from './pages/AnalyticsPage';
import FirmwarePage from './pages/FirmwarePage';
import NetworkMonitorPage from './pages/NetworkMonitorPage';
import GLDevicesPage from './pages/GLDevicesPage';
import GLLocationsPage from './pages/GLLocationsPage';
import GLTagsPage from './pages/GLTagsPage';
import GLSubscriptionsPage from './pages/GLSubscriptionsPage';
import GLWorkspacesPage from './pages/GLWorkspacesPage';
import GLUsersPage from './pages/GLUsersPage';

// Components
import Sidebar from './components/Sidebar';
import TopBar from './components/TopBar';
import Breadcrumb from './components/Breadcrumb';
import GlobalSearch from './components/GlobalSearch';

// Services
import { authAPI } from './services/api';

// Theme configuration - Aruba Orange color scheme
const darkTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#FF6600',
      light: '#FF9933',
      dark: '#CC5200',
    },
    secondary: {
      main: '#FF6600',
      light: '#FF9933',
      dark: '#CC5200',
    },
    background: {
      default: '#000000',
      paper: '#171717',
    },
    error: {
      main: '#f44336',
    },
    warning: {
      main: '#FF6600',
    },
    info: {
      main: '#2196f3',
    },
    success: {
      main: '#4caf50',
    },
  },
  typography: {
    fontFamily: '"Inter", "Roboto", "Helvetica", "Arial", sans-serif',
    h1: {
      fontWeight: 700,
    },
    h2: {
      fontWeight: 600,
    },
    h3: {
      fontWeight: 600,
    },
  },
  shape: {
    borderRadius: 8,
  },
  components: {
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        root: {
          textTransform: 'none',
          fontWeight: 600,
        },
      },
    },
  },
});

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => {
    checkSetup();
  }, []);

  const checkSetup = async () => {
    try {
      // First check if credentials are configured
      const setupResponse = await fetch(`${import.meta.env.VITE_API_URL || '/api'}/setup/check`);
      const setupData = await setupResponse.json();

      if (setupData.needs_setup) {
        setNeedsSetup(true);
        setIsLoading(false);
        return;
      }

      // If configured, check auth
      checkAuth();
    } catch (error) {
      console.error('Setup check failed:', error);
      setIsLoading(false);
    }
  };
  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Cmd/Ctrl + K to open search
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
      // Cmd/Ctrl + B to toggle sidebar
      if ((e.metaKey || e.ctrlKey) && e.key === 'b') {
        e.preventDefault();
        setSidebarOpen((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const checkAuth = async () => {
    try {
      if (authAPI.isAuthenticated()) {
        await authAPI.getStatus();
        setIsAuthenticated(true);
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSetupComplete = () => {
    setNeedsSetup(false);
    // Navigate to root and reload to pick up new credentials
    window.location.href = '/';
  };

  const handleLogin = () => {
    console.log('handleLogin called, setting isAuthenticated to true');
    setIsAuthenticated(true);
  };

  const handleLogout = async () => {
    try {
      await authAPI.logout();
    } finally {
      setIsAuthenticated(false);
    }
  };

  if (isLoading) {
    return (
      <ThemeProvider theme={darkTheme}>
        <CssBaseline />
        <Box
          display="flex"
          justifyContent="center"
          alignItems="center"
          minHeight="100vh"
        >
          <div>Loading...</div>
        </Box>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider theme={darkTheme}>
      <CssBaseline />
      <Router>
        {needsSetup ? (
          <Routes>
            <Route path="*" element={<SetupWizard onComplete={handleSetupComplete} />} />
          </Routes>
        ) : !isAuthenticated ? (
          <Routes>
            <Route path="/login" element={<LoginPage onLogin={handleLogin} />} />
            <Route path="/setup-wizard" element={<SetupWizard onComplete={handleSetupComplete} />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        ) : (
          <Box sx={{ display: 'flex' }}>
            <Sidebar
              open={sidebarOpen}
              onToggle={() => setSidebarOpen(!sidebarOpen)}
              onSearchOpen={() => setSearchOpen(true)}
            />
            <Box
              component="main"
              sx={{
                flexGrow: 1,
                minHeight: '100vh',
                backgroundColor: 'background.default',
                transition: 'margin-left 0.3s',
                marginLeft: sidebarOpen ? 0 : '-240px',
              }}
            >
              <TopBar
                onLogout={handleLogout}
                onMenuClick={() => setSidebarOpen(!sidebarOpen)}
                onSearchClick={() => setSearchOpen(true)}
              />
              <Box sx={{ p: 3 }}>
                <Breadcrumb />
                <Routes>
                  <Route path="/" element={<DashboardPage />} />
                  <Route path="/devices" element={<DevicesPage />} />
                  <Route path="/devices/:serial" element={<DeviceDetailPage />} />
                  <Route path="/clients" element={<ClientsPage />} />
                  <Route path="/sites" element={<SitesPage />} />
                  <Route path="/wlans" element={<WLANsPage />} />
                  <Route path="/configuration" element={<ConfigurationPage />} />
                  {/* GreenLake Users (MSP) */}
                  <Route path="/gl/users" element={<GLUsersPage />} />
                  {/* Legacy path (optional) */}
                  <Route path="/users" element={<UsersPage />} />
                  <Route path="/nac" element={<NACPage />} />
                  <Route path="/alerts" element={<AlertsPage />} />
                  <Route path="/analytics" element={<AnalyticsPage />} />
                  <Route path="/firmware" element={<FirmwarePage />} />
                  <Route path="/troubleshoot" element={<TroubleshootPage />} />
                  <Route path="/network-monitor" element={<NetworkMonitorPage />} />
                  <Route path="/api-explorer" element={<APIExplorerPage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                  {/* GreenLake Admin routes */}
                  <Route path="/gl/devices" element={<GLDevicesPage />} />
                  <Route path="/gl/locations" element={<GLLocationsPage />} />
                  <Route path="/gl/tags" element={<GLTagsPage />} />
                  <Route path="/gl/subscriptions" element={<GLSubscriptionsPage />} />
                  <Route path="/gl/workspaces" element={<GLWorkspacesPage />} />
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </Box>
            </Box>
            <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
          </Box>
        )}
      </Router>
    </ThemeProvider>
  );
}

export default App;
