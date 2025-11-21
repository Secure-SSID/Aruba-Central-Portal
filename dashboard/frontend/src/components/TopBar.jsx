/**
 * Top Navigation Bar Component
 */

import { useState, useEffect } from 'react';
import {
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Box,
  Menu,
  MenuItem,
  Avatar,
  Chip,
  Tooltip,
  CircularProgress,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import AccountCircleIcon from '@mui/icons-material/AccountCircle';
import LogoutIcon from '@mui/icons-material/Logout';
import NotificationsIcon from '@mui/icons-material/Notifications';
import RefreshIcon from '@mui/icons-material/Refresh';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import { tokenAPI } from '../services/api';
import SearchIcon from '@mui/icons-material/Search';
import NotificationCenter from './NotificationCenter';

function TopBar({ onLogout, onMenuClick, onSearchClick }) {
  const [anchorEl, setAnchorEl] = useState(null);
  const [tokenInfo, setTokenInfo] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchTokenInfo();
    // Refresh token info every 60 seconds
    const interval = setInterval(fetchTokenInfo, 60000);
    return () => clearInterval(interval);
  }, []);

  const fetchTokenInfo = async () => {
    try {
      const info = await tokenAPI.getInfo();
      setTokenInfo(info);
    } catch (error) {
      console.error('Failed to fetch token info:', error);
    }
  };

  const handleRefreshToken = async () => {
    setRefreshing(true);
    try {
      await tokenAPI.refresh();
      await fetchTokenInfo();
    } catch (error) {
      console.error('Failed to refresh token:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const handleMenu = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    handleClose();
    onLogout();
  };

  const getTokenStatusColor = () => {
    if (!tokenInfo || !tokenInfo.has_token) return 'error';
    if (!tokenInfo.is_valid) return 'error';
    if (tokenInfo.expires_in_minutes < 10) return 'warning';
    return 'success';
  };

  const getTokenStatusText = () => {
    if (!tokenInfo || !tokenInfo.has_token) return 'No Token';
    if (!tokenInfo.is_valid) return 'Expired';
    const mins = tokenInfo.expires_in_minutes;
    if (mins < 1) return '< 1 min';
    if (mins < 60) return `${mins} min`;
    const hours = Math.floor(mins / 60);
    return `${hours}h ${mins % 60}m`;
  };

  return (
    <AppBar
      position="sticky"
      elevation={0}
      sx={{
        backgroundColor: 'background.paper',
        borderBottom: '1px solid rgba(255, 255, 255, 0.12)',
      }}
    >
      <Toolbar>
        <IconButton
          edge="start"
          color="inherit"
          aria-label="menu"
          onClick={onMenuClick}
          sx={{ mr: 2 }}
        >
          <MenuIcon />
        </IconButton>

        <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
          {/* Page title can be set dynamically */}
        </Typography>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {/* Token Status Indicator */}
          <Tooltip title={tokenInfo ? `Token expires at ${tokenInfo.expires_at || 'N/A'}` : 'Loading token info'}>
            <Chip
              icon={<AccessTimeIcon sx={{ fontSize: 16 }} />}
              label={getTokenStatusText()}
              size="small"
              color={getTokenStatusColor()}
              sx={{ fontWeight: 600 }}
            />
          </Tooltip>

          {/* Token Refresh Button */}
          <Tooltip title="Refresh access token">
            <IconButton
              color="inherit"
              onClick={handleRefreshToken}
              disabled={refreshing}
              size="small"
            >
              {refreshing ? (
                <CircularProgress size={20} color="inherit" />
              ) : (
                <RefreshIcon />
              )}
            </IconButton>
          </Tooltip>

          <Tooltip title="Search (⌘K)">
            <IconButton color="inherit" onClick={onSearchClick}>
              <SearchIcon />
            </IconButton>
          </Tooltip>

          <NotificationCenter />

          <IconButton
            onClick={handleMenu}
            color="inherit"
            aria-label="account"
          >
            <Avatar sx={{ width: 32, height: 32, bgcolor: 'primary.main' }}>
              <AccountCircleIcon />
            </Avatar>
          </IconButton>

          <Menu
            anchorEl={anchorEl}
            open={Boolean(anchorEl)}
            onClose={handleClose}
            anchorOrigin={{
              vertical: 'bottom',
              horizontal: 'right',
            }}
            transformOrigin={{
              vertical: 'top',
              horizontal: 'right',
            }}
          >
            <MenuItem onClick={handleLogout}>
              <LogoutIcon sx={{ mr: 1 }} fontSize="small" />
              Logout
            </MenuItem>
          </Menu>
        </Box>
      </Toolbar>
    </AppBar>
  );
}

export default TopBar;
