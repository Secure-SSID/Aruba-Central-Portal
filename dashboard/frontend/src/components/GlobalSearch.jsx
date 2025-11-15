/**
 * Global Search Component
 * Provides quick search across devices, sites, and pages
 */

import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  TextField,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Typography,
  Box,
  Chip,
  InputAdornment,
  CircularProgress,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import DevicesIcon from '@mui/icons-material/Devices';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import PageviewIcon from '@mui/icons-material/Pageview';
import { deviceAPI, configAPI } from '../services/api';

function GlobalSearch({ open, onClose }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState({ devices: [], sites: [], pages: [] });
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // Available pages for search
  const availablePages = [
    { name: 'Dashboard', path: '/', keywords: ['home', 'overview', 'stats'] },
    { name: 'Devices', path: '/devices', keywords: ['device', 'inventory', 'hardware'] },
    { name: 'Clients', path: '/clients', keywords: ['client', 'user', 'connected'] },
    { name: 'Sites', path: '/sites', keywords: ['site', 'location', 'office'] },
    { name: 'WLANs', path: '/wlans', keywords: ['wireless', 'wifi', 'ssid', 'network'] },
    { name: 'Configuration', path: '/configuration', keywords: ['config', 'settings', 'template'] },
    { name: 'NAC', path: '/nac', keywords: ['nac', 'access control', 'security'] },
    { name: 'Network Monitor', path: '/network-monitor', keywords: ['monitor', 'monitoring', 'health', 'status', 'performance'] },
    { name: 'Alerts', path: '/alerts', keywords: ['alert', 'notification', 'warning'] },
    { name: 'Analytics', path: '/analytics', keywords: ['analytics', 'reports', 'metrics'] },
    { name: 'Firmware', path: '/firmware', keywords: ['firmware', 'update', 'upgrade'] },
    { name: 'Troubleshoot', path: '/troubleshoot', keywords: ['troubleshoot', 'debug', 'diagnostic'] },
    { name: 'Users', path: '/users', keywords: ['user', 'admin', 'account'] },
    { name: 'API Explorer', path: '/api-explorer', keywords: ['api', 'explorer', 'test'] },
    { name: 'Settings', path: '/settings', keywords: ['settings', 'preferences', 'config'] },
  ];

  useEffect(() => {
    if (!searchQuery.trim()) {
      setResults({ devices: [], sites: [], pages: [] });
      return;
    }

    const searchTimeout = setTimeout(async () => {
      setLoading(true);
      try {
        const query = searchQuery.toLowerCase();

        // Search pages
        const matchingPages = availablePages.filter(
          (page) =>
            page.name.toLowerCase().includes(query) ||
            page.keywords.some((keyword) => keyword.includes(query))
        );

        // Search devices
        let devices = [];
        try {
          const deviceResponse = await deviceAPI.getDevices();
          devices = (deviceResponse.devices || [])
            .filter(
              (device) =>
                device.serial?.toLowerCase().includes(query) ||
                device.name?.toLowerCase().includes(query) ||
                device.model?.toLowerCase().includes(query) ||
                device.macaddr?.toLowerCase().includes(query)
            )
            .slice(0, 5); // Limit to 5 results
        } catch (err) {
          console.error('Error searching devices:', err);
        }

        // Search sites
        let sites = [];
        try {
          const siteResponse = await configAPI.getSites();
          sites = (siteResponse.sites || [])
            .filter(
              (site) =>
                site.site_name?.toLowerCase().includes(query) ||
                site.address?.toLowerCase().includes(query)
            )
            .slice(0, 5); // Limit to 5 results
        } catch (err) {
          console.error('Error searching sites:', err);
        }

        setResults({
          devices,
          sites,
          pages: matchingPages.slice(0, 5),
        });
      } catch (err) {
        console.error('Search error:', err);
      } finally {
        setLoading(false);
      }
    }, 300); // Debounce search

    return () => clearTimeout(searchTimeout);
  }, [searchQuery]);

  const handleNavigate = (path) => {
    navigate(path);
    setSearchQuery('');
    onClose();
  };

  const handleKeyDown = (event) => {
    if (event.key === 'Escape') {
      onClose();
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          backgroundColor: 'background.paper',
          backgroundImage: 'none',
        },
      }}
    >
      <DialogContent sx={{ p: 0 }}>
        <Box sx={{ p: 2, borderBottom: '1px solid rgba(255, 255, 255, 0.12)' }}>
          <TextField
            autoFocus
            fullWidth
            placeholder="Search devices, sites, or pages..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon />
                </InputAdornment>
              ),
              endAdornment: loading && (
                <InputAdornment position="end">
                  <CircularProgress size={20} />
                </InputAdornment>
              ),
            }}
            sx={{
              '& .MuiOutlinedInput-root': {
                '& fieldset': {
                  border: 'none',
                },
              },
            }}
          />
        </Box>

        <Box sx={{ maxHeight: '60vh', overflow: 'auto' }}>
          {/* Pages Results */}
          {results.pages.length > 0 && (
            <Box>
              <Typography
                variant="caption"
                sx={{
                  px: 2,
                  py: 1,
                  display: 'block',
                  color: 'text.secondary',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                }}
              >
                Pages
              </Typography>
              <List disablePadding>
                {results.pages.map((page) => (
                  <ListItem key={page.path} disablePadding>
                    <ListItemButton onClick={() => handleNavigate(page.path)}>
                      <ListItemIcon>
                        <PageviewIcon color="primary" />
                      </ListItemIcon>
                      <ListItemText
                        primary={page.name}
                        secondary={page.path}
                      />
                      <Chip label="Page" size="small" variant="outlined" />
                    </ListItemButton>
                  </ListItem>
                ))}
              </List>
            </Box>
          )}

          {/* Devices Results */}
          {results.devices.length > 0 && (
            <Box>
              <Typography
                variant="caption"
                sx={{
                  px: 2,
                  py: 1,
                  display: 'block',
                  color: 'text.secondary',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                }}
              >
                Devices
              </Typography>
              <List disablePadding>
                {results.devices.map((device) => (
                  <ListItem key={device.serial} disablePadding>
                    <ListItemButton
                      onClick={() => handleNavigate(`/devices/${device.serial}`)}
                    >
                      <ListItemIcon>
                        <DevicesIcon color="primary" />
                      </ListItemIcon>
                      <ListItemText
                        primary={device.name || device.serial}
                        secondary={`${device.model} - ${device.serial}`}
                      />
                      <Chip
                        label={device.status}
                        size="small"
                        color={device.status === 'Up' ? 'success' : 'default'}
                      />
                    </ListItemButton>
                  </ListItem>
                ))}
              </List>
            </Box>
          )}

          {/* Sites Results */}
          {results.sites.length > 0 && (
            <Box>
              <Typography
                variant="caption"
                sx={{
                  px: 2,
                  py: 1,
                  display: 'block',
                  color: 'text.secondary',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                }}
              >
                Sites
              </Typography>
              <List disablePadding>
                {results.sites.map((site) => (
                  <ListItem key={site.site_id} disablePadding>
                    <ListItemButton onClick={() => handleNavigate('/sites')}>
                      <ListItemIcon>
                        <LocationOnIcon color="primary" />
                      </ListItemIcon>
                      <ListItemText
                        primary={site.site_name}
                        secondary={site.address || 'No address'}
                      />
                      <Chip label="Site" size="small" variant="outlined" />
                    </ListItemButton>
                  </ListItem>
                ))}
              </List>
            </Box>
          )}

          {/* No Results */}
          {searchQuery &&
            !loading &&
            results.devices.length === 0 &&
            results.sites.length === 0 &&
            results.pages.length === 0 && (
              <Box sx={{ p: 4, textAlign: 'center' }}>
                <SearchIcon
                  sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }}
                />
                <Typography variant="body1" color="text.secondary">
                  No results found for "{searchQuery}"
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                  Try searching for devices, sites, or page names
                </Typography>
              </Box>
            )}

          {/* Empty State */}
          {!searchQuery && (
            <Box sx={{ p: 4, textAlign: 'center' }}>
              <SearchIcon
                sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }}
              />
              <Typography variant="body1" color="text.secondary">
                Start typing to search...
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Search for devices, sites, or pages
              </Typography>
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ mt: 2, display: 'block' }}
              >
                Press <kbd>ESC</kbd> to close
              </Typography>
            </Box>
          )}
        </Box>
      </DialogContent>
    </Dialog>
  );
}

export default GlobalSearch;
