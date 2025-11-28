/**
 * Main App Component
 * Handles routing, authentication, and layout
 */

import { useState, useEffect, Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';

// Lazy load pages for code splitting
const SetupWizard = lazy(() => import('./pages/SetupWizard'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const DevicesPage = lazy(() => import('./pages/DevicesPage'));
const DeviceDetailPage = lazy(() => import('./pages/DeviceDetailPage'));
const ClientsPage = lazy(() => import('./pages/ClientsPage'));
const ConfigurationPage = lazy(() => import('./pages/ConfigurationPage'));
// Configuration pages
const ConfigurationIndexPage = lazy(() => import('./pages/configuration/ConfigurationIndexPage'));
const ScopeManagementPage = lazy(() => import('./pages/configuration/ScopeManagementPage'));
const ApplicationExperiencePage = lazy(() => import('./pages/configuration/ApplicationExperiencePage'));
const CentralNACPage = lazy(() => import('./pages/configuration/CentralNACPage'));
const CentralNACServicePage = lazy(() => import('./pages/configuration/CentralNACServicePage'));
const ConfigManagementPage = lazy(() => import('./pages/configuration/ConfigManagementPage'));
const ConfigurationHealthPage = lazy(() => import('./pages/configuration/ConfigurationHealthPage'));
const ExtensionsPage = lazy(() => import('./pages/configuration/ExtensionsPage'));
const HighAvailabilityPage = lazy(() => import('./pages/configuration/HighAvailabilityPage'));
const InterfacesPage = lazy(() => import('./pages/configuration/InterfacesPage'));
const VLANsNetworksPage = lazy(() => import('./pages/configuration/VLANsNetworksPage'));
const WirelessPage = lazy(() => import('./pages/configuration/WirelessPage'));
const APIExplorerPage = lazy(() => import('./pages/APIExplorerPage'));
const UsersPage = lazy(() => import('./pages/UsersPage'));
const TroubleshootPage = lazy(() => import('./pages/TroubleshootPage'));
const NACPage = lazy(() => import('./pages/NACPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const SitesPage = lazy(() => import('./pages/SitesPage'));
const WLANsPage = lazy(() => import('./pages/WLANsPage'));
const AlertsPage = lazy(() => import('./pages/AlertsPage'));
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage'));
const FirmwarePage = lazy(() => import('./pages/FirmwarePage'));
const NetworkMonitorPage = lazy(() => import('./pages/NetworkMonitorPage'));
const GLDevicesPage = lazy(() => import('./pages/GLDevicesPage'));
const GLLocationsPage = lazy(() => import('./pages/GLLocationsPage'));
const GLTagsPage = lazy(() => import('./pages/GLTagsPage'));
const GLSubscriptionsPage = lazy(() => import('./pages/GLSubscriptionsPage'));
const GLWorkspacesPage = lazy(() => import('./pages/GLWorkspacesPage'));
const GLUsersPage = lazy(() => import('./pages/GLUsersPage'));
const GLRolesPage = lazy(() => import('./pages/GLRolesPage'));
const GLPermissionsPage = lazy(() => import('./pages/GLPermissionsPage'));
const ReportingPage = lazy(() => import('./pages/ReportingPage'));

// Components
import Sidebar from './components/Sidebar';
import TopBar from './components/TopBar';
import Breadcrumb from './components/Breadcrumb';
import GlobalSearch from './components/GlobalSearch';
import ErrorBoundary from './components/ErrorBoundary';

// Services
import { authAPI } from './services/api';

// Loading fallback component for lazy-loaded routes
const PageLoadingFallback = () => (
  <Box
    display="flex"
    justifyContent="center"
    alignItems="center"
    minHeight="400px"
  >
    <CircularProgress />
  </Box>
);

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
        <Suspense fallback={<PageLoadingFallback />}>
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
                  <Suspense fallback={<PageLoadingFallback />}>
                    <Routes>
                      <Route path="/" element={<DashboardPage />} />
                      <Route path="/devices" element={<DevicesPage />} />
                      <Route path="/devices/:serial" element={<DeviceDetailPage />} />
                      <Route path="/clients" element={<ClientsPage />} />
                      <Route path="/sites" element={<SitesPage />} />
                      <Route path="/wlans" element={<WLANsPage />} />
                      <Route path="/configuration" element={<ErrorBoundary><ConfigurationPage /></ErrorBoundary>} />
                      <Route path="/configuration/index" element={<ErrorBoundary><ConfigurationIndexPage /></ErrorBoundary>} />
                      <Route path="/configuration/scope-management" element={<ErrorBoundary><ScopeManagementPage /></ErrorBoundary>} />
                      <Route path="/configuration/application-experience" element={<ErrorBoundary><ApplicationExperiencePage /></ErrorBoundary>} />
                      <Route path="/configuration/central-nac" element={<ErrorBoundary><CentralNACPage /></ErrorBoundary>} />
                      <Route path="/configuration/central-nac-service" element={<ErrorBoundary><CentralNACServicePage /></ErrorBoundary>} />
                      <Route path="/configuration/config-management" element={<ErrorBoundary><ConfigManagementPage /></ErrorBoundary>} />
                      <Route path="/configuration/health" element={<ErrorBoundary><ConfigurationHealthPage /></ErrorBoundary>} />
                      <Route path="/configuration/extensions" element={<ErrorBoundary><ExtensionsPage /></ErrorBoundary>} />
                      <Route path="/configuration/high-availability" element={<ErrorBoundary><HighAvailabilityPage /></ErrorBoundary>} />
                      {/* Consolidated Interfaces page - redirects old routes */}
                      <Route path="/configuration/interface" element={<Navigate to="/configuration/interfaces" replace />} />
                      <Route path="/configuration/interface-security" element={<Navigate to="/configuration/interfaces" replace />} />
                      <Route path="/configuration/interfaces" element={<ErrorBoundary><InterfacesPage /></ErrorBoundary>} />
                      <Route path="/configuration/vlans-networks" element={<ErrorBoundary><VLANsNetworksPage /></ErrorBoundary>} />
                      <Route path="/configuration/wireless" element={<ErrorBoundary><WirelessPage /></ErrorBoundary>} />
                      {/* Legacy ConfigurationPage route - redirect to index */}
                      <Route path="/configuration/legacy" element={<ConfigurationPage />} />
                      {/* GreenLake Users (MSP) */}
                      <Route path="/gl/users" element={<GLUsersPage />} />
                      {/* Legacy path (optional) */}
                      <Route path="/users" element={<UsersPage />} />
                      <Route path="/nac" element={<NACPage />} />
                      <Route path="/alerts" element={<AlertsPage />} />
                      <Route path="/analytics" element={<AnalyticsPage />} />
                      <Route path="/reporting" element={<ReportingPage />} />
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
                      <Route path="/gl/users" element={<GLUsersPage />} />
                      <Route path="/gl/roles" element={<GLRolesPage />} />
                      <Route path="/gl/permissions" element={<GLPermissionsPage />} />
                      <Route path="/gl/workspaces" element={<GLWorkspacesPage />} />
                      <Route path="*" element={<Navigate to="/" replace />} />
                    </Routes>
                  </Suspense>
                </Box>
              </Box>
              <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />
            </Box>
          )}
        </Suspense>
      </Router>
    </ThemeProvider>
  );
}

export default App;
