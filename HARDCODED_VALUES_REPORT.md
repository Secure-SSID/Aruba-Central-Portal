# Hardcoded Values Audit Report

This report identifies all hardcoded site IDs, serial numbers, and other static values found in the codebase that should be made configurable or removed.

## 🔴 Critical Issues (Should be removed/replaced)

### 1. ConfigurationPage.jsx - Hardcoded Site IDs and Serial Numbers

**Location:** `dashboard/frontend/src/pages/ConfigurationPage.jsx`

**Lines 294-298:** CSV template examples contain example values:
```javascript
// Line 294
csvContent = 'serial,new_name\nCN12345678,Building-A-AP-01\nCN87654321,Building-A-AP-02';

// Line 296
csvContent = 'serial,group\nCN12345678,campus-wifi\nCN87654321,guest-wifi';

// Line 298
csvContent = 'serial,site_id\nCN12345678,YOUR_SITE_ID\nCN87654321,YOUR_SITE_ID';
```

**Issues:**
- Hardcoded serial numbers: `CN12345678`, `CN87654321` (example values - acceptable)
- Hardcoded site_id: Site ID was replaced with `YOUR_SITE_ID` placeholder
- Hardcoded group names: `campus-wifi`, `guest-wifi` (example values - acceptable)
- Hardcoded device names: `Building-A-AP-01`, `Building-A-AP-02` (example values - acceptable)

**Recommendation:** Replace with generic placeholder values like:
- `SERIAL_NUMBER_1`, `SERIAL_NUMBER_2`
- `SITE_ID_HERE`
- `GROUP_NAME_HERE`
- `DEVICE_NAME_HERE`

**Also found on lines 448-450** in the textarea placeholder.

---

### 2. APIExplorerPage.jsx - Hardcoded Example Values

**Location:** `dashboard/frontend/src/pages/APIExplorerPage.jsx`

**Lines 1010, 1019:** Filter examples contain hardcoded site ID:
```javascript
// Line 1010
{"filter": "siteId eq 'YOUR_SITE_ID'"}

// Line 1019
{"filter": "status eq 'Up' and siteId eq 'YOUR_SITE_ID'"}
```

**Line 1022:** Hardcoded example serial numbers:
```javascript
{"filter": "serialNumber in ('SERIAL_1', 'SERIAL_2')"}
```

**Line 1016:** Hardcoded example model:
```javascript
{"filter": "model eq 'MODEL_NAME'"}
```

**Recommendation:** ✅ Fixed - Replaced with generic placeholders:
- `'YOUR_SITE_ID'` instead of `'12345'`
- `'SERIAL_1', 'SERIAL_2'` instead of `'ABC123', 'DEF456'`
- `'MODEL_NAME'` instead of `'505'`

---

## 🟡 Medium Priority (Review needed)

### 3. SitesPage.jsx - Comment with Example Site ID

**Location:** `dashboard/frontend/src/pages/SitesPage.jsx`

**Line 313:** Comment contains example site ID:
```javascript
// Health API uses 'id' field (e.g., "YOUR_SITE_ID")
```

**Recommendation:** ✅ Fixed - Changed to generic example

---

### 4. SetupWizard.jsx - Hardcoded API Base URLs

**Location:** `dashboard/frontend/src/pages/SetupWizard.jsx`

**Lines 55, 66-126:** Multiple hardcoded regional API URLs:
```javascript
const [baseUrl, setBaseUrl] = useState('https://internal.api.central.arubanetworks.com');

const regions = [
  { name: 'Internal (Default)', url: 'https://internal.api.central.arubanetworks.com' },
  { name: 'Germany 1', url: 'https://de1.api.central.arubanetworks.com' },
  { name: 'Germany 2', url: 'https://de2.api.central.arubanetworks.com' },
  // ... more regions
];
```

**Status:** ⚠️ These are legitimate regional endpoints, but should be configurable via environment variables or config file.

**Recommendation:** Keep as default options, but allow override via environment variables.

---

### 5. SettingsPage.jsx - Hardcoded Default API URL

**Location:** `dashboard/frontend/src/pages/SettingsPage.jsx`

**Line 51:** Hardcoded default API URL:
```javascript
const [baseUrl, setBaseUrl] = useState('https://apigw-uswest4.central.arubanetworks.com');
```

**Recommendation:** Use environment variable or config file for default.

---

### 6. DeviceDetailPage.jsx - Hardcoded CloudFront URLs

**Location:** `dashboard/frontend/src/pages/DeviceDetailPage.jsx`

**Lines 1294, 1308-1315, 1344-1351:** Hardcoded CloudFront CDN URLs for device images:
```javascript
'https://diz7hgluhzsxv.cloudfront.net/ui-base/v33191/assets/ui-components/static/media/Q9H73A.e0f32991.png'
'https://diz7hgluhzsxv.cloudfront.net/2025/udl/v3132/static/media/${imagePartNumber}.3e5127c7.png'
// ... more URLs
```

**Status:** ✅ These are CDN URLs for device images - likely acceptable, but should be configurable.

**Recommendation:** Move to environment variable or config file.

---

### 7. DeviceDetailPage.jsx - Hardcoded HPE Logo URL

**Location:** `dashboard/frontend/src/pages/DeviceDetailPage.jsx`

**Line 1474:** Hardcoded Wikipedia URL for HPE logo:
```javascript
const HPE_LOGO_URL = 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/46/Hewlett_Packard_Enterprise_logo.svg/530px-Hewlett_Packard_Enterprise_logo.svg.png';
```

**Status:** ✅ External resource URL - acceptable but could be moved to config.

---

## 🟢 Low Priority (Documentation/Examples)

### 8. APIExplorerPage.jsx - Base URL Documentation

**Location:** `dashboard/frontend/src/pages/APIExplorerPage.jsx`

**Lines 37, 957, 973:** Documentation mentions base URL:
```javascript
// Base URL: https://internal.api.central.arubanetworks.com
```

**Status:** ✅ Documentation only - acceptable.

---

### 9. TroubleshootPage.jsx - Example Placeholders

**Location:** `dashboard/frontend/src/pages/TroubleshootPage.jsx`

**Lines 384, 482:** Example placeholders in input fields:
```javascript
placeholder="e.g., 8.8.8.8 or google.com"
placeholder="e.g., aa:bb:cc:dd:ee:ff"
```

**Status:** ✅ These are just UI placeholders - acceptable.

---

## Summary

### Total Issues Found: 9

- **🔴 Critical (Must Fix):** 2 files with hardcoded site IDs and serial numbers
- **🟡 Medium Priority:** 4 files with hardcoded URLs that should be configurable
- **🟢 Low Priority:** 3 files with documentation/examples (acceptable)

### Action Items:

1. **Immediate:** Replace hardcoded site IDs and serial numbers in ConfigurationPage.jsx and APIExplorerPage.jsx
2. **Short-term:** Make API base URLs configurable via environment variables
3. **Long-term:** Consider moving all external URLs to a configuration file

---

## Files to Review:

1. `dashboard/frontend/src/pages/ConfigurationPage.jsx` - **CRITICAL**
2. `dashboard/frontend/src/pages/APIExplorerPage.jsx` - **CRITICAL**
3. `dashboard/frontend/src/pages/SitesPage.jsx` - **MEDIUM**
4. `dashboard/frontend/src/pages/SetupWizard.jsx` - **MEDIUM**
5. `dashboard/frontend/src/pages/SettingsPage.jsx` - **MEDIUM**
6. `dashboard/frontend/src/pages/DeviceDetailPage.jsx` - **MEDIUM**

