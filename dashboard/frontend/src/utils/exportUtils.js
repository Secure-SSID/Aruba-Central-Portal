/**
 * Export Utilities
 * Functions to export data to CSV, JSON, and other formats
 */

/**
 * Convert data to CSV format
 */
export const exportToCSV = (data, filename = 'export.csv') => {
  if (!data || data.length === 0) {
    console.warn('No data to export');
    return;
  }

  // Get headers from first object
  const headers = Object.keys(data[0]);

  // Create CSV content
  const csvContent = [
    headers.join(','), // Header row
    ...data.map(row =>
      headers.map(header => {
        const value = row[header];
        // Escape values that contain commas or quotes
        if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value ?? '';
      }).join(',')
    )
  ].join('\n');

  // Create and trigger download
  downloadFile(csvContent, filename, 'text/csv;charset=utf-8;');
};

/**
 * Convert data to JSON format
 */
export const exportToJSON = (data, filename = 'export.json') => {
  if (!data) {
    console.warn('No data to export');
    return;
  }

  const jsonContent = JSON.stringify(data, null, 2);
  downloadFile(jsonContent, filename, 'application/json;charset=utf-8;');
};

/**
 * Export table to CSV with custom formatting
 */
export const exportTableToCSV = (headers, rows, filename = 'table-export.csv') => {
  if (!rows || rows.length === 0) {
    console.warn('No rows to export');
    return;
  }

  const csvContent = [
    headers.join(','),
    ...rows.map(row =>
      row.map(cell => {
        const value = String(cell ?? '');
        if (value.includes(',') || value.includes('"') || value.includes('\n')) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      }).join(',')
    )
  ].join('\n');

  downloadFile(csvContent, filename, 'text/csv;charset=utf-8;');
};

/**
 * Helper function to trigger file download
 */
const downloadFile = (content, filename, mimeType) => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';

  document.body.appendChild(link);
  link.click();

  // Cleanup
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/**
 * Format device data for export
 */
export const formatDevicesForExport = (devices) => {
  return devices.map(device => ({
    Serial: device.serial,
    Name: device.name || 'N/A',
    Model: device.model || 'N/A',
    Type: device.device_type || device.type || 'N/A',
    Status: device.status || 'Unknown',
    'IP Address': device.ip_address || device.ip || 'N/A',
    'MAC Address': device.macaddr || 'N/A',
    Firmware: device.firmware_version || 'N/A',
    Site: device.site || 'N/A',
    Group: device.group_name || 'N/A',
    Uptime: device.uptime ? `${Math.floor(device.uptime / 86400)} days` : 'N/A',
    'Last Modified': device.last_modified ? new Date(device.last_modified * 1000).toLocaleString() : 'N/A',
  }));
};

/**
 * Format client data for export
 */
export const formatClientsForExport = (clients) => {
  return clients.map(client => ({
    'MAC Address': client.macaddr || 'N/A',
    'IP Address': client.ip_address || 'N/A',
    Name: client.name || client.username || 'N/A',
    'Connection Type': client.connection || 'N/A',
    SSID: client.network || client.essid || 'N/A',
    'AP Name': client.associated_device_name || 'N/A',
    'Signal Strength': client.signal_db ? `${client.signal_db} dBm` : 'N/A',
    Speed: client.speed ? `${client.speed} Mbps` : 'N/A',
    VLAN: client.vlan || 'N/A',
    'Connected Since': client.connected_since ? new Date(client.connected_since * 1000).toLocaleString() : 'N/A',
  }));
};

/**
 * Format site data for export
 */
export const formatSitesForExport = (sites) => {
  return sites.map(site => ({
    'Site Name': site.site_name || 'N/A',
    'Site ID': site.site_id || 'N/A',
    Address: site.address || 'N/A',
    City: site.city || 'N/A',
    State: site.state || 'N/A',
    Country: site.country || 'N/A',
    'Zip Code': site.zipcode || 'N/A',
    Latitude: site.latitude || 'N/A',
    Longitude: site.longitude || 'N/A',
  }));
};

/**
 * Generate filename with timestamp
 */
export const generateFilename = (prefix, extension = 'csv') => {
  const timestamp = new Date().toISOString().split('T')[0];
  return `${prefix}_${timestamp}.${extension}`;
};
