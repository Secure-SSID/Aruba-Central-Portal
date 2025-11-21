import { useEffect, useState } from 'react';
import { Box, Card, CardContent, Typography, Alert, Table, TableHead, TableRow, TableCell, TableBody, TableContainer, Paper, Pagination, Button, TextField, Dialog, DialogTitle, DialogContent, DialogActions, InputAdornment, Checkbox, FormGroup, FormControlLabel } from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import apiClient from '../services/api';

function GLDevicesPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [devices, setDevices] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [sortBy, setSortBy] = useState('model');
  const [sortDir, setSortDir] = useState('asc');
  const [search, setSearch] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState({ serialNumber: '', model: '', deviceId: '' });
  const [visibleCols, setVisibleCols] = useState({ model: true, serial: true, id: true, status: true, apps: true });
  const [showCols, setShowCols] = useState(false);
  const [selected, setSelected] = useState(new Set());

  const fetchDevices = async () => {
    setLoading(true);
    setError('');
    try {
      const params = { offset: (page - 1) * limit, limit };
      const resp = await apiClient.get('/greenlake/devices', { params });
      let items = resp.data?.items || resp.data?.devices || [];
      // client-side filter
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        items = items.filter((d) =>
          (d.model || '').toLowerCase().includes(q) ||
          (d.serialNumber || d.serial || '').toLowerCase().includes(q) ||
          (d.id || d.deviceId || '').toLowerCase().includes(q)
        );
      }
      // client-side sort
      items = [...items].sort((a, b) => {
        const av = ((sortBy === 'model' ? a.model :
                    sortBy === 'serial' ? (a.serialNumber || a.serial) :
                    sortBy === 'id' ? (a.id || a.deviceId) :
                    sortBy === 'status' ? a.status : '') || '').toString().toLowerCase();
        const bv = ((sortBy === 'model' ? b.model :
                    sortBy === 'serial' ? (b.serialNumber || b.serial) :
                    sortBy === 'id' ? (b.id || b.deviceId) :
                    sortBy === 'status' ? b.status : '') || '').toString().toLowerCase();
        if (av < bv) return sortDir === 'asc' ? -1 : 1;
        if (av > bv) return sortDir === 'asc' ? 1 : -1;
        return 0;
      });
      setDevices(items);
      setTotal(resp.data?.total || 0);
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to load devices');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDevices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, limit, sortBy, sortDir]);

  const handleSort = (col) => {
    if (sortBy === col) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortBy(col);
      setSortDir('asc');
    }
  };

  const exportCsv = () => {
    const headers = ['Model', 'Serial', 'Device ID', 'Status', 'Assigned Apps'];
    const data = selected.size ? devices.filter(d => selected.has(d.id || d.deviceId)) : devices;
    const rows = data.map((d) => [
      d.model || '',
      d.serialNumber || d.serial || '',
      d.id || d.deviceId || '',
      d.status || '',
      Array.isArray(d.assignedApps) ? d.assignedApps.join(';') : '',
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.map((x) => `"${String(x).replace(/"/g, '""')}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'greenlake_devices.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const submitAdd = async () => {
    try {
      await apiClient.post('/greenlake/devices', form);
      setAddOpen(false);
      setForm({ serialNumber: '', model: '', deviceId: '' });
      fetchDevices();
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to add device');
    }
  };

  const submitUpdate = async () => {
    try {
      // For update: send minimal payload; backend currently routes to devices v1
      await apiClient.patch('/greenlake/devices', form);
      setEditOpen(false);
      setForm({ serialNumber: '', model: '', deviceId: '' });
      fetchDevices();
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to update device');
    }
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, gap: 1, flexWrap: 'wrap' }}>
        <Typography variant="h4" sx={{ fontWeight: 700 }}>Devices (GreenLake)</Typography>
        <Box sx={{ display: 'flex', gap: 1 }}>
          <TextField
            size="small"
            placeholder="Search model, serial, id"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && fetchDevices()}
            InputProps={{ startAdornment: <InputAdornment position="start">🔎</InputAdornment> }}
          />
          <Button startIcon={<DownloadIcon />} onClick={exportCsv} variant="outlined">Export CSV</Button>
          <Button startIcon={<AddIcon />} onClick={() => setAddOpen(true)} variant="contained">Add</Button>
          <Button startIcon={<EditIcon />} onClick={() => setEditOpen(true)} variant="outlined">Update</Button>
          <Button onClick={() => setShowCols(v => !v)} variant="outlined">Columns</Button>
        </Box>
      </Box>
      {showCols && (
        <Box sx={{ mb: 1 }}>
          <FormGroup row>
            <FormControlLabel control={<Checkbox checked={visibleCols.model} onChange={(e)=>setVisibleCols({...visibleCols, model:e.target.checked})} />} label="Model" />
            <FormControlLabel control={<Checkbox checked={visibleCols.serial} onChange={(e)=>setVisibleCols({...visibleCols, serial:e.target.checked})} />} label="Serial" />
            <FormControlLabel control={<Checkbox checked={visibleCols.id} onChange={(e)=>setVisibleCols({...visibleCols, id:e.target.checked})} />} label="Device ID" />
            <FormControlLabel control={<Checkbox checked={visibleCols.status} onChange={(e)=>setVisibleCols({...visibleCols, status:e.target.checked})} />} label="Status" />
            <FormControlLabel control={<Checkbox checked={visibleCols.apps} onChange={(e)=>setVisibleCols({...visibleCols, apps:e.target.checked})} />} label="Assigned Apps" />
          </FormGroup>
        </Box>
      )}
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <Card>
        <CardContent>
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox">
                    <Checkbox
                      indeterminate={selected.size > 0 && selected.size < devices.length}
                      checked={devices.length > 0 && selected.size === devices.length}
                      onChange={(e) => {
                        if (e.target.checked) setSelected(new Set(devices.map(d => d.id || d.deviceId)));
                        else setSelected(new Set());
                      }}
                    />
                  </TableCell>
                  {visibleCols.model && <TableCell onClick={() => handleSort('model')} sx={{ cursor: 'pointer' }}>Model {sortBy==='model' ? (sortDir==='asc'?'▲':'▼') : ''}</TableCell>}
                  {visibleCols.serial && <TableCell onClick={() => handleSort('serial')} sx={{ cursor: 'pointer' }}>Serial {sortBy==='serial' ? (sortDir==='asc'?'▲':'▼') : ''}</TableCell>}
                  {visibleCols.id && <TableCell onClick={() => handleSort('id')} sx={{ cursor: 'pointer' }}>Device ID {sortBy==='id' ? (sortDir==='asc'?'▲':'▼') : ''}</TableCell>}
                  {visibleCols.status && <TableCell onClick={() => handleSort('status')} sx={{ cursor: 'pointer' }}>Status {sortBy==='status' ? (sortDir==='asc'?'▲':'▼') : ''}</TableCell>}
                  {visibleCols.apps && <TableCell>Assigned Apps</TableCell>}
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {devices.map((d) => (
                  <TableRow key={d.id || d.deviceId}>
                    <TableCell padding="checkbox">
                      <Checkbox
                        checked={selected.has(d.id || d.deviceId)}
                        onChange={(e) => {
                          const s = new Set(selected);
                          const key = d.id || d.deviceId;
                          if (e.target.checked) s.add(key); else s.delete(key);
                          setSelected(s);
                        }}
                      />
                    </TableCell>
                    {visibleCols.model && <TableCell>{d.model || '-'}</TableCell>}
                    {visibleCols.serial && <TableCell>{d.serialNumber || d.serial || '-'}</TableCell>}
                    {visibleCols.id && <TableCell>{d.id || d.deviceId}</TableCell>}
                    {visibleCols.status && <TableCell>{d.status || '-'}</TableCell>}
                    {visibleCols.apps && <TableCell>{Array.isArray(d.assignedApps) ? d.assignedApps.join(', ') : '-'}</TableCell>}
                    <TableCell>
                      <Button size="small" onClick={() => { setForm({ serialNumber: d.serialNumber || d.serial || '', model: d.model || '', deviceId: d.id || d.deviceId || '' }); setEditOpen(true); }}>Edit</Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 2 }}>
            <Pagination count={Math.max(1, Math.ceil(total / limit))} page={page} onChange={(_, p) => setPage(p)} size="small" color="primary" />
          </Box>
        </CardContent>
      </Card>

      {/* Add Device Dialog */}
      <Dialog open={addOpen} onClose={() => setAddOpen(false)}>
        <DialogTitle>Add Device</DialogTitle>
        <DialogContent sx={{ display: 'grid', gap: 2, mt: 1 }}>
          <TextField label="Serial Number" value={form.serialNumber} onChange={(e)=>setForm({...form, serialNumber: e.target.value})} />
          <TextField label="Model" value={form.model} onChange={(e)=>setForm({...form, model: e.target.value})} />
          <TextField label="Device ID" value={form.deviceId} onChange={(e)=>setForm({...form, deviceId: e.target.value})} helperText="Optional client-supplied id" />
        </DialogContent>
        <DialogActions>
          <Button onClick={()=>setAddOpen(false)}>Cancel</Button>
          <Button onClick={submitAdd} variant="contained">Add</Button>
        </DialogActions>
      </Dialog>

      {/* Update Device Dialog */}
      <Dialog open={editOpen} onClose={() => setEditOpen(false)}>
        <DialogTitle>Update Device</DialogTitle>
        <DialogContent sx={{ display: 'grid', gap: 2, mt: 1 }}>
          <TextField label="Serial Number" value={form.serialNumber} onChange={(e)=>setForm({...form, serialNumber: e.target.value})} />
          <TextField label="Model" value={form.model} onChange={(e)=>setForm({...form, model: e.target.value})} />
          <TextField label="Device ID" value={form.deviceId} onChange={(e)=>setForm({...form, deviceId: e.target.value})} />
        </DialogContent>
        <DialogActions>
          <Button onClick={()=>setEditOpen(false)}>Cancel</Button>
          <Button onClick={submitUpdate} variant="contained">Update</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default GLDevicesPage;


