import { useEffect, useMemo, useRef, useState } from 'react';
import { TextField, Autocomplete, CircularProgress } from '@mui/material';
import apiClient from '../services/api';

const STATES_US = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY',
];

const COUNTRIES_COMMON = [
  'United States','Canada','United Kingdom','Australia','Germany','France','Netherlands','India','Japan','Singapore','Brazil','Mexico',
];

const US_STATE_NAME_TO_ABBR = {
  'alabama':'AL','alaska':'AK','arizona':'AZ','arkansas':'AR','california':'CA','colorado':'CO','connecticut':'CT','delaware':'DE','florida':'FL','georgia':'GA','hawaii':'HI','idaho':'ID','illinois':'IL','indiana':'IN','iowa':'IA','kansas':'KS','kentucky':'KY','louisiana':'LA','maine':'ME','maryland':'MD','massachusetts':'MA','michigan':'MI','minnesota':'MN','mississippi':'MS','missouri':'MO','montana':'MT','nebraska':'NE','nevada':'NV','new hampshire':'NH','new jersey':'NJ','new mexico':'NM','new york':'NY','north carolina':'NC','north dakota':'ND','ohio':'OH','oklahoma':'OK','oregon':'OR','pennsylvania':'PA','rhode island':'RI','south carolina':'SC','south dakota':'SD','tennessee':'TN','texas':'TX','utah':'UT','vermont':'VT','virginia':'VA','washington':'WA','west virginia':'WV','wisconsin':'WI','wyoming':'WY','district of columbia':'DC','washington, d.c.':'DC'
};

const US_STATE_TO_TZ = {
  'AL':'America/Chicago','AK':'America/Anchorage','AZ':'America/Phoenix','AR':'America/Chicago',
  'CA':'America/Los_Angeles','CO':'America/Denver','CT':'America/New_York','DE':'America/New_York',
  'FL':'America/New_York','GA':'America/New_York','HI':'Pacific/Honolulu','ID':'America/Boise',
  'IL':'America/Chicago','IN':'America/Indiana/Indianapolis','IA':'America/Chicago','KS':'America/Chicago',
  'KY':'America/New_York','LA':'America/Chicago','ME':'America/New_York','MD':'America/New_York',
  'MA':'America/New_York','MI':'America/Detroit','MN':'America/Chicago','MS':'America/Chicago',
  'MO':'America/Chicago','MT':'America/Denver','NE':'America/Chicago','NV':'America/Los_Angeles',
  'NH':'America/New_York','NJ':'America/New_York','NM':'America/Denver','NY':'America/New_York',
  'NC':'America/New_York','ND':'America/Chicago','OH':'America/New_York','OK':'America/Chicago',
  'OR':'America/Los_Angeles','PA':'America/New_York','RI':'America/New_York','SC':'America/New_York',
  'SD':'America/Chicago','TN':'America/Chicago','TX':'America/Chicago','UT':'America/Denver',
  'VT':'America/New_York','VA':'America/New_York','WA':'America/Los_Angeles','WV':'America/New_York',
  'WI':'America/Chicago','WY':'America/Denver','DC':'America/New_York'
};

export default function AddressAutocomplete({
  value,
  onChange,
  onResolved, // callback with resolved fields (we'll send lat, lon, timezone only)
  label = 'Address',
  placeholder = 'Start typing an address',
}) {
  const [open, setOpen] = useState(false);
  const [inputValue, setInputValue] = useState(value || '');
  const [options, setOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const activeRef = useRef(true);
  const debounceIdRef = useRef(null);

  useEffect(() => {
    return () => {
      activeRef.current = false;
    };
  }, []);

  useEffect(() => {
    setInputValue(value || '');
  }, [value]);

  const fetchSuggestions = async (q) => {
    if (!q || q.trim().length < 1) {
      setOptions([]);
      return;
    }
    setLoading(true);
    try {
      const resp = await apiClient.get('/geocode/search', { params: { q, limit: 6 } });
      const items = resp.data?.items || [];
      if (!activeRef.current) return;
      setOptions(items);
    } catch (e) {
      setOptions([]);
    } finally {
      if (activeRef.current) setLoading(false);
    }
  };

  const handleSelect = async (opt) => {
    if (!opt) {
      // Do not alter the address field on clear
      return;
    }
    // Do not auto-fill address/city/state/country/zip; only compute lat/lon/timezone
    let data = {
      lat: opt.lat || null,
      lon: opt.lon || null,
      timezone: '',
    };
    if (data.lat != null && data.lon != null) {
      try {
        const tzResp = await apiClient.get('/geocode/timezone', { params: { lat: data.lat, lon: data.lon } });
        data.timezone = tzResp.data?.timezone || '';
      } catch {
        // ignore
      }
    }
  // Fallback: derive TZ by US state if not resolved
    const stateName = (opt.state || '').toLowerCase().trim();
    if ((!data.timezone || data.timezone === '') && stateName) {
      const abbr = US_STATE_NAME_TO_ABBR[stateName];
      if (abbr && US_STATE_TO_TZ[abbr]) data.timezone = US_STATE_TO_TZ[abbr];
  }
    onResolved?.(data);
  };

  const resolveTopMatch = async () => {
    // Try to resolve with first suggestion if available; else call search once
    let top = options && options.length > 0 ? options[0] : null;
    if (!top && inputValue && inputValue.trim().length > 0) {
      try {
        const resp = await apiClient.get('/geocode/search', { params: { q: inputValue.trim(), limit: 1, country: 'us' } });
        const items = resp.data?.items || [];
        top = items[0];
      } catch {
        // ignore
      }
    }
    if (top) {
      await handleSelect(top);
    }
  };

  return (
    <Autocomplete
      open={open}
      onOpen={() => setOpen(true)}
      onClose={() => setOpen(false)}
      filterOptions={(x) => x} // server-side
      options={options}
      loading={loading}
      autoComplete
      autoHighlight
      freeSolo
      includeInputInList
      getOptionLabel={(opt) => (typeof opt === 'string' ? opt : opt.label || '')}
      isOptionEqualToValue={(o, v) => (o.label || '') === (v.label || '')}
      onInputChange={(_, newInput) => {
        setInputValue(newInput);
        if (debounceIdRef.current) clearTimeout(debounceIdRef.current);
        debounceIdRef.current = setTimeout(() => fetchSuggestions(newInput), 250);
      }}
      onChange={(_, opt) => handleSelect(opt)}
      onBlur={() => {
        // If user didn't pick from list, try to resolve best match
        resolveTopMatch();
      }}
      renderInput={(params) => (
        <TextField
          {...params}
          label={label}
          placeholder={placeholder}
          value={inputValue}
          InputProps={{
            ...params.InputProps,
            endAdornment: (
              <>
                {loading ? <CircularProgress color="inherit" size={20} /> : null}
                {params.InputProps.endAdornment}
              </>
            ),
          }}
        />
      )}
    />
  );
}


