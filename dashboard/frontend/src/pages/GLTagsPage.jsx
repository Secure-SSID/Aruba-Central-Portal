import { useEffect, useState } from 'react';
import { Box, Card, CardContent, Typography, Alert, Table, TableHead, TableRow, TableCell, TableBody, TableContainer, Paper, Button, TextField, InputAdornment } from '@mui/material';
import DownloadIcon from '@mui/icons-material/Download';
import apiClient from '../services/api';

function GLTagsPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [tags, setTags] = useState([]);
  const [sortBy, setSortBy] = useState('key');
  const [sortDir, setSortDir] = useState('asc');
  const [search, setSearch] = useState('');

  const fetchTags = async () => {
    setLoading(true);
    setError('');
    try {
      const resp = await apiClient.get('/greenlake/tags');
      let items = resp.data?.items || resp.data?.tags || [];
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        items = items.filter((t)=> (t.key||t.tagKey||'').toLowerCase().includes(q) || (t.value||t.tagValue||'').toLowerCase().includes(q) || (t.resourceType||'').toLowerCase().includes(q) || (t.resourceId||'').toLowerCase().includes(q));
      }
      items = [...items].sort((a,b)=>{
        const av = ((sortBy==='key'?(a.key||a.tagKey): sortBy==='value'?(a.value||a.tagValue): sortBy==='type'?a.resourceType: sortBy==='rid'?a.resourceId:'')||'').toString().toLowerCase();
        const bv = ((sortBy==='key'?(b.key||b.tagKey): sortBy==='value'?(b.value||b.tagValue): sortBy==='type'?b.resourceType: sortBy==='rid'?b.resourceId:'')||'').toString().toLowerCase();
        if (av<bv) return sortDir==='asc'?-1:1; if (av>bv) return sortDir==='asc'?1:-1; return 0;
      });
      setTags(items);
    } catch (e) {
      setError(e.response?.data?.error || 'Failed to load tags');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTags();
  }, []);

  const handleSort=(c)=>{ if (sortBy===c) setSortDir(d=>d==='asc'?'desc':'asc'); else { setSortBy(c); setSortDir('asc'); } };
  const exportCsv=()=>{
    const headers=['Key','Value','Resource Type','Resource ID'];
    const rows=tags.map(t=>[t.key||t.tagKey||'', t.value||t.tagValue||'', t.resourceType||'', t.resourceId||'']);
    const csv=[headers.join(','), ...rows.map(r=>r.map(x=>`"${String(x).replace(/"/g,'""')}"`).join(','))].join('\n');
    const blob=new Blob([csv],{type:'text/csv;charset=utf-8;'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.setAttribute('download','greenlake_tags.csv'); document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  };

  return (
    <Box>
      <Box sx={{ display:'flex', alignItems:'center', justifyContent:'space-between', mb:2, gap:1, flexWrap:'wrap' }}>
        <Typography variant="h4" sx={{ fontWeight: 700 }}>Tags (GreenLake)</Typography>
        <Box sx={{ display:'flex', gap:1 }}>
          <TextField size="small" placeholder="Search" value={search} onChange={(e)=>setSearch(e.target.value)} onKeyDown={(e)=>e.key==='Enter'&&fetchTags()} InputProps={{ startAdornment:<InputAdornment position="start">🔎</InputAdornment> }} />
          <Button startIcon={<DownloadIcon/>} onClick={exportCsv} variant="outlined">Export CSV</Button>
        </Box>
      </Box>
      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      <Card>
        <CardContent>
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow>
                  <TableCell onClick={()=>handleSort('key')} sx={{ cursor:'pointer' }}>Key {sortBy==='key'?(sortDir==='asc'?'▲':'▼'):''}</TableCell>
                  <TableCell onClick={()=>handleSort('value')} sx={{ cursor:'pointer' }}>Value {sortBy==='value'?(sortDir==='asc'?'▲':'▼'):''}</TableCell>
                  <TableCell onClick={()=>handleSort('type')} sx={{ cursor:'pointer' }}>Resource Type {sortBy==='type'?(sortDir==='asc'?'▲':'▼'):''}</TableCell>
                  <TableCell onClick={()=>handleSort('rid')} sx={{ cursor:'pointer' }}>Resource ID {sortBy==='rid'?(sortDir==='asc'?'▲':'▼'):''}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {tags.map((t, idx) => (
                  <TableRow key={idx}>
                    <TableCell>{t.key || t.tagKey || '-'}</TableCell>
                    <TableCell>{t.value || t.tagValue || '-'}</TableCell>
                    <TableCell>{t.resourceType || '-'}</TableCell>
                    <TableCell>{t.resourceId || '-'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>
    </Box>
  );
}

export default GLTagsPage;


