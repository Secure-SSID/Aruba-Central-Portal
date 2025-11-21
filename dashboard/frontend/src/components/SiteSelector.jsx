/**
 * Site Selector Component
 * Reusable dropdown for selecting sites when scope-id or site-id is required
 */

import { useState, useEffect } from 'react';
import {
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  Alert,
  Typography,
} from '@mui/material';
import { configAPI, sitesConfigAPI, monitoringAPIv2 } from '../services/api';

function SiteSelector({ 
  value, 
  onChange, 
  required = false, 
  label = 'Site',
  helperText,
  disabled = false,
  error = false,
  fullWidth = true,
}) {
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    loadSites();
  }, []);

  const loadSites = async () => {
    try {
      setLoading(true);
      setErrorMsg('');
      let sitesList = [];
      
      // Try Configuration API first (best choice - faster, returns site names/IDs)
      try {
        let sitesData;
        try {
          sitesData = await sitesConfigAPI.getSites({ limit: 100, offset: 0 });
        } catch (firstErr) {
          sitesData = await sitesConfigAPI.getSites({});
        }
        
        // Handle different response formats
        if (Array.isArray(sitesData)) {
          sitesList = sitesData;
        } else if (sitesData && typeof sitesData === 'object') {
          sitesList = sitesData.items || sitesData.data || sitesData.sites || sitesData.results || [];
        }
        
        if (sitesList.length > 0) {
          // Normalize site data
          sitesList = sitesList.map(site => ({
            scopeId: site.scopeId || site.id || site.siteId || site.site_id,
            name: site.scopeName || site.name || site.siteName || site.displayName || site.display_name,
            ...site
          })).filter(site => site.scopeId);
          
          setSites(sitesList);
          setLoading(false);
          return;
        }
      } catch (err) {
        console.warn('Configuration API failed, trying fallback:', err);
      }
      
      // Fallback to configAPI.getSites()
      try {
        const sitesData = await configAPI.getSites();
        if (Array.isArray(sitesData)) {
          sitesList = sitesData;
        } else if (sitesData && typeof sitesData === 'object') {
          sitesList = sitesData.items || sitesData.data || sitesData.sites || [];
        }
        
        if (sitesList.length > 0) {
          sitesList = sitesList.map(site => ({
            scopeId: site.scopeId || site.id || site.siteId || site.site_id,
            name: site.scopeName || site.name || site.siteName || site.displayName || site.display_name,
            ...site
          })).filter(site => site.scopeId);
          
          setSites(sitesList);
          setLoading(false);
          return;
        }
      } catch (err) {
        console.warn('Config API failed, trying monitoring API:', err);
      }
      
      // Final fallback to monitoring API
      try {
        const healthData = await monitoringAPIv2.getSitesHealth({});
        const items = healthData.items || healthData.data || healthData.sites || [];
        sitesList = items.map(item => ({
          scopeId: item.scopeId || item.siteId || item.id,
          name: item.scopeName || item.siteName || item.name || item.displayName,
          ...item
        })).filter(site => site.scopeId);
        
        if (sitesList.length > 0) {
          setSites(sitesList);
          setLoading(false);
          return;
        }
      } catch (err) {
        console.warn('All site loading methods failed:', err);
      }
      
      setSites([]);
      setErrorMsg('Failed to load sites. Please ensure sites are configured.');
    } catch (err) {
      console.error('Error loading sites:', err);
      setErrorMsg('Failed to load sites');
      setSites([]);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (event) => {
    const selectedValue = event.target.value;
    // Find the site to get the scopeId (which should be same as site-id)
    const site = sites.find(s => 
      String(s.scopeId || s.id || s.siteId || s.site_id) === String(selectedValue)
    );
    
    if (site) {
      // Use scopeId as the value (same as site-id)
      const siteId = site.scopeId || site.id || site.siteId || site.site_id;
      onChange(siteId);
    } else {
      onChange('');
    }
  };

  if (loading) {
    return (
      <FormControl fullWidth={fullWidth} required={required} error={error} disabled={disabled}>
        <InputLabel>{label}</InputLabel>
        <Select value="" label={label} disabled>
          <MenuItem value="">
            <CircularProgress size={20} sx={{ mr: 1 }} />
            Loading sites...
          </MenuItem>
        </Select>
      </FormControl>
    );
  }

  if (errorMsg) {
    return (
      <Alert severity="warning" sx={{ mb: 1 }}>
        {errorMsg}
      </Alert>
    );
  }

  return (
    <FormControl fullWidth={fullWidth} required={required} error={error} disabled={disabled}>
      <InputLabel>{label}</InputLabel>
      <Select
        value={value || ''}
        onChange={handleChange}
        label={label}
        displayEmpty
        renderValue={(selected) => {
          if (!selected || selected === '') {
            return required ? 'Select a site (required)' : 'Select a site (optional)';
          }
          const site = sites.find(s => 
            String(s.scopeId || s.id || s.siteId || s.site_id) === String(selected)
          );
          return site ? (site.name || `Site ${selected}`) : selected;
        }}
      >
        {sites.map((site) => {
          const siteId = site.scopeId || site.id || site.siteId || site.site_id;
          return (
            <MenuItem key={siteId} value={siteId}>
              {site.name || `Site ${siteId}`}
              <Typography variant="caption" sx={{ ml: 1, color: 'text.secondary' }}>
                ({siteId})
              </Typography>
            </MenuItem>
          );
        })}
      </Select>
      {helperText && (
        <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
          {helperText}
        </Typography>
      )}
    </FormControl>
  );
}

export default SiteSelector;

