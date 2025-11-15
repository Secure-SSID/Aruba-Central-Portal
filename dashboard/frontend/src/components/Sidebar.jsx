/**
 * Enhanced Sidebar Navigation Component
 * Features: Nested menus, search, recent pages, favorites
 */

import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Box,
  Typography,
  Divider,
  Collapse,
  IconButton,
  Tooltip,
  Badge,
} from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import DevicesIcon from '@mui/icons-material/Devices';
import SettingsIcon from '@mui/icons-material/Settings';
import PeopleIcon from '@mui/icons-material/People';
import GroupsIcon from '@mui/icons-material/Groups';
import ApiIcon from '@mui/icons-material/Api';
import NetworkCheckIcon from '@mui/icons-material/NetworkCheck';
import SecurityIcon from '@mui/icons-material/Security';
import BugReportIcon from '@mui/icons-material/BugReport';
import TuneIcon from '@mui/icons-material/Tune';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import WifiIcon from '@mui/icons-material/Wifi';
import NotificationsIcon from '@mui/icons-material/Notifications';
import AssessmentIcon from '@mui/icons-material/Assessment';
import SystemUpdateIcon from '@mui/icons-material/SystemUpdate';
import DescriptionIcon from '@mui/icons-material/Description';
import CloudIcon from '@mui/icons-material/Cloud';
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import SearchIcon from '@mui/icons-material/Search';
import HistoryIcon from '@mui/icons-material/History';

const DRAWER_WIDTH = 240;

const menuItems = [
  { text: 'Dashboard', icon: <DashboardIcon />, path: '/' },
  { text: 'Devices', icon: <DevicesIcon />, path: '/devices' },
  { text: 'Clients', icon: <GroupsIcon />, path: '/clients' },
  { text: 'Sites', icon: <LocationOnIcon />, path: '/sites' },
  { text: 'WLANs', icon: <WifiIcon />, path: '/wlans' },
  { text: 'Configuration', icon: <TuneIcon />, path: '/configuration' },
  { text: 'NAC', icon: <SecurityIcon />, path: '/nac' },
  { text: 'Alerts', icon: <NotificationsIcon />, path: '/alerts' },
  { text: 'Analytics', icon: <AssessmentIcon />, path: '/analytics' },
  { text: 'Reporting', icon: <DescriptionIcon />, path: '/reporting' },
  { text: 'Services', icon: <CloudIcon />, path: '/services' },
  { text: 'Firmware', icon: <SystemUpdateIcon />, path: '/firmware' },
  { text: 'Troubleshoot', icon: <BugReportIcon />, path: '/troubleshoot' },
  { text: 'Users', icon: <PeopleIcon />, path: '/users' },
  { text: 'API Explorer', icon: <ApiIcon />, path: '/api-explorer' },
  { text: 'Settings', icon: <SettingsIcon />, path: '/settings' },
];

const menuGroups = [
  {
    id: 'main',
    title: 'Main',
    icon: <DashboardIcon />,
    items: menuItems,
  },
];

function Sidebar({ open, onToggle, onSearchOpen }) {
  const location = useLocation();
  const [expandedGroups, setExpandedGroups] = useState(['main', 'inventory']);
  const [favorites, setFavorites] = useState([]);
  const [recentPages, setRecentPages] = useState([]);

  // Load favorites and recent pages from localStorage
  useEffect(() => {
    const savedFavorites = JSON.parse(localStorage.getItem('navFavorites') || '[]');
    const savedRecent = JSON.parse(localStorage.getItem('recentPages') || '[]');
    setFavorites(savedFavorites);
    setRecentPages(savedRecent);
  }, []);

  // Track visited pages
  useEffect(() => {
    if (location.pathname !== '/login') {
      const pageInfo = {
        path: location.pathname,
        timestamp: Date.now(),
      };

      setRecentPages((prev) => {
        const filtered = prev.filter((p) => p.path !== location.pathname);
        const updated = [pageInfo, ...filtered].slice(0, 5);
        localStorage.setItem('recentPages', JSON.stringify(updated));
        return updated;
      });
    }
  }, [location.pathname]);

  const toggleGroup = (groupId) => {
    setExpandedGroups((prev) =>
      prev.includes(groupId)
        ? prev.filter((id) => id !== groupId)
        : [...prev, groupId]
    );
  };

  const toggleFavorite = (path, e) => {
    e.preventDefault();
    e.stopPropagation();
    setFavorites((prev) => {
      const updated = prev.includes(path)
        ? prev.filter((p) => p !== path)
        : [...prev, path];
      localStorage.setItem('navFavorites', JSON.stringify(updated));
      return updated;
    });
  };

  const getPageLabel = (path) => {
    for (const group of menuGroups) {
      const item = group.items.find((i) => i.path === path);
      if (item) return item.text;
    }
    return path;
  };

  const getPageIcon = (path) => {
    for (const group of menuGroups) {
      const item = group.items.find((i) => i.path === path);
      if (item) return item.icon;
    }
    return <DashboardIcon />;
  };

  const renderMenuItem = (item, isNested = false) => {
    const isActive = location.pathname === item.path;
    const isFavorite = favorites.includes(item.path);

    return (
      <ListItem key={item.path} disablePadding>
        <ListItemButton
          component={Link}
          to={item.path}
          sx={{
            mx: 1,
            mb: 0.5,
            pl: isNested ? 4 : 2,
            borderRadius: 1,
            backgroundColor: isActive ? 'primary.main' : 'transparent',
            '&:hover': {
              backgroundColor: isActive
                ? 'primary.dark'
                : 'rgba(255, 102, 0, 0.08)',
            },
            transition: 'all 0.2s',
          }}
        >
          <ListItemIcon
            sx={{
              color: isActive ? 'white' : 'text.secondary',
              minWidth: 40,
            }}
          >
            {item.icon}
          </ListItemIcon>
          <ListItemText
            primary={item.text}
            sx={{
              '& .MuiTypography-root': {
                fontWeight: isActive ? 600 : 400,
                color: isActive ? 'white' : 'text.primary',
                fontSize: isNested ? '0.875rem' : '1rem',
              },
            }}
          />
          <IconButton
            size="small"
            onClick={(e) => toggleFavorite(item.path, e)}
            sx={{
              color: isFavorite
                ? 'warning.main'
                : isActive
                ? 'rgba(255, 255, 255, 0.5)'
                : 'rgba(255, 255, 255, 0.3)',
              '&:hover': {
                color: 'warning.main',
              },
            }}
          >
            {isFavorite ? (
              <StarIcon fontSize="small" />
            ) : (
              <StarBorderIcon fontSize="small" />
            )}
          </IconButton>
        </ListItemButton>
      </ListItem>
    );
  };

  return (
    <Drawer
      variant="persistent"
      anchor="left"
      open={open}
      sx={{
        width: DRAWER_WIDTH,
        flexShrink: 0,
        '& .MuiDrawer-paper': {
          width: DRAWER_WIDTH,
          boxSizing: 'border-box',
          backgroundColor: 'background.paper',
          borderRight: '1px solid rgba(255, 255, 255, 0.12)',
        },
      }}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        {/* Logo/Title */}
        <Box
          sx={{
            p: 3,
            display: 'flex',
            alignItems: 'center',
            gap: 1,
          }}
        >
          <NetworkCheckIcon sx={{ color: 'primary.main', fontSize: 32 }} />
          <Typography
            variant="h6"
            sx={{
              fontWeight: 700,
              background: 'linear-gradient(135deg, #FF6600 0%, #FF9933 100%)',
              backgroundClip: 'text',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
            }}
          >
            Aruba Central
          </Typography>
        </Box>

        {/* Search Button */}
        <Box sx={{ px: 2, mb: 2 }}>
          <ListItemButton
            onClick={onSearchOpen}
            sx={{
              borderRadius: 1,
              border: '1px solid rgba(255, 255, 255, 0.12)',
              '&:hover': {
                backgroundColor: 'rgba(255, 102, 0, 0.08)',
                borderColor: 'primary.main',
              },
            }}
          >
            <ListItemIcon sx={{ minWidth: 40 }}>
              <SearchIcon />
            </ListItemIcon>
            <ListItemText
              primary="Search..."
              sx={{
                '& .MuiTypography-root': {
                  color: 'text.secondary',
                  fontSize: '0.875rem',
                },
              }}
            />
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              ⌘K
            </Typography>
          </ListItemButton>
        </Box>

        <Divider sx={{ mx: 2, mb: 2 }} />

        {/* Favorites Section */}
        {favorites.length > 0 && (
          <>
            <Box sx={{ px: 2, mb: 1 }}>
              <Typography
                variant="caption"
                sx={{
                  color: 'text.secondary',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5,
                }}
              >
                <StarIcon fontSize="small" sx={{ color: 'warning.main' }} />
                Favorites
              </Typography>
            </Box>
            <List sx={{ py: 0 }}>
              {favorites.map((path) => {
                const item = {
                  text: getPageLabel(path),
                  icon: getPageIcon(path),
                  path,
                };
                return renderMenuItem(item);
              })}
            </List>
            <Divider sx={{ mx: 2, my: 2 }} />
          </>
        )}

        {/* Main Navigation with Nested Groups */}
        <Box sx={{ flexGrow: 1, overflow: 'auto' }}>
          <List>
            {menuGroups.map((group) => {
              if (group.id === 'main') {
                return group.items.map((item) => renderMenuItem(item));
              }

              const isExpanded = expandedGroups.includes(group.id);

              return (
                <Box key={group.id}>
                  <ListItemButton
                    onClick={() => toggleGroup(group.id)}
                    sx={{
                      mx: 1,
                      mb: 0.5,
                      borderRadius: 1,
                      '&:hover': {
                        backgroundColor: 'rgba(255, 102, 0, 0.08)',
                      },
                    }}
                  >
                    <ListItemIcon sx={{ color: 'text.secondary', minWidth: 40 }}>
                      {group.icon}
                    </ListItemIcon>
                    <ListItemText
                      primary={group.title}
                      sx={{
                        '& .MuiTypography-root': {
                          fontWeight: 600,
                          fontSize: '0.875rem',
                        },
                      }}
                    />
                    {isExpanded ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                  </ListItemButton>
                  <Collapse in={isExpanded} timeout="auto" unmountOnExit>
                    <List component="div" disablePadding>
                      {group.items.map((item) => renderMenuItem(item, true))}
                    </List>
                  </Collapse>
                </Box>
              );
            })}
          </List>
        </Box>

        {/* Recent Pages Section */}
        {recentPages.length > 0 && (
          <>
            <Divider sx={{ mx: 2, my: 2 }} />
            <Box sx={{ px: 2, mb: 1 }}>
              <Typography
                variant="caption"
                sx={{
                  color: 'text.secondary',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 0.5,
                }}
              >
                <HistoryIcon fontSize="small" />
                Recent
              </Typography>
            </Box>
            <List sx={{ py: 0 }}>
              {recentPages.slice(0, 3).map((page) => {
                const item = {
                  text: getPageLabel(page.path),
                  icon: getPageIcon(page.path),
                  path: page.path,
                };
                return renderMenuItem(item);
              })}
            </List>
          </>
        )}

        {/* Footer */}
        <Box sx={{ p: 2 }}>
          <Typography
            variant="caption"
            color="text.secondary"
            align="center"
            display="block"
          >
            Aruba Central Dashboard v2.0
          </Typography>
          <Typography
            variant="caption"
            color="text.secondary"
            align="center"
            display="block"
          >
            Powered by HPE Aruba Networking
          </Typography>
        </Box>
      </Box>
    </Drawer>
  );
}

export default Sidebar;
