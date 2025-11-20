# 🔍 Hardcoded Values Summary - Quick Reference

## Critical Issues Found

### 1. ⚠️ ConfigurationPage.jsx - Lines 294, 296, 298, 448-450

**Hardcoded Values:**
- Serial Numbers: `CN12345678`, `CN87654321` (example values - acceptable)
- Site ID: Replaced with `YOUR_SITE_ID` placeholder (sensitive data removed)
- Group Names: `campus-wifi`, `guest-wifi` (example values - acceptable)
- Device Names: `Building-A-AP-01`, `Building-A-AP-02` (example values - acceptable)

**Current Code:**
```javascript
// Line 294
csvContent = 'serial,new_name\nCN12345678,Building-A-AP-01\nCN87654321,Building-A-AP-02';

// Line 296
csvContent = 'serial,group\nCN12345678,campus-wifi\nCN87654321,guest-wifi';

// Line 298
csvContent = 'serial,site_id\nCN12345678,YOUR_SITE_ID\nCN87654321,YOUR_SITE_ID';
```

**Suggested Replacement:**
```javascript
csvContent = 'serial,new_name\nSERIAL_NUMBER_1,DEVICE_NAME_1\nSERIAL_NUMBER_2,DEVICE_NAME_2';
csvContent = 'serial,group\nSERIAL_NUMBER_1,GROUP_NAME_1\nSERIAL_NUMBER_2,GROUP_NAME_2';
csvContent = 'serial,site_id\nSERIAL_NUMBER_1,SITE_ID_HERE\nSERIAL_NUMBER_2,SITE_ID_HERE';
```

---

### 2. ⚠️ APIExplorerPage.jsx - Lines 1010, 1019, 1022, 1016

**Hardcoded Values:**
- Site ID: `12345` (now replaced with `YOUR_SITE_ID`)
- Serial Numbers: `ABC123`, `DEF456` (now replaced with placeholders)
- Model: `505` (now replaced with `MODEL_NAME`)

**Current Code:**
```javascript
// Line 1010
{"filter": "siteId eq 'YOUR_SITE_ID'"}

// Line 1019
{"filter": "status eq 'Up' and siteId eq 'YOUR_SITE_ID'"}

// Line 1022
{"filter": "serialNumber in ('SERIAL_1', 'SERIAL_2')"}

// Line 1016
{"filter": "model eq 'MODEL_NAME'"}
```

**Suggested Replacement:**
```javascript
{"filter": "siteId eq 'YOUR_SITE_ID'"}
{"filter": "status eq 'Up' and siteId eq 'YOUR_SITE_ID'"}
{"filter": "serialNumber in ('SERIAL_1', 'SERIAL_2')"}
{"filter": "model eq 'MODEL_NAME'"}
```

---

## Medium Priority Issues

### 3. SitesPage.jsx - Line 313 (Comment)
- Example site ID in comment: Replaced with generic placeholder
- **Action:** ✅ Fixed - Changed to generic example

### 4. SetupWizard.jsx - Lines 55, 66-126
- Hardcoded regional API URLs (acceptable but should be configurable)
- **Action:** Consider making configurable via env vars

### 5. SettingsPage.jsx - Line 51
- Hardcoded default API URL
- **Action:** Use environment variable

### 6. DeviceDetailPage.jsx - Lines 1294, 1308-1351, 1474
- Hardcoded CloudFront CDN URLs
- Hardcoded HPE logo URL
- **Action:** Move to config file or env vars

---

## Decision Guide

### ✅ **KEEP** (Acceptable):
- Documentation URLs (API docs, developer links)
- Example placeholders in UI (e.g., "e.g., 8.8.8.8")
- Regional API endpoint lists (but make configurable)

### ❌ **REMOVE/REPLACE** (Critical):
- Hardcoded site IDs (sensitive data) - ✅ **FIXED** - Replaced with placeholders
- Hardcoded serial numbers (`CN12345678`, `CN87654321`, `ABC123`, `DEF456`) - ✅ **KEPT** - These are acceptable example values
- Hardcoded group/device names in examples - ✅ **KEPT** - These are acceptable example values

### ⚠️ **MAKE CONFIGURABLE** (Medium Priority):
- API base URLs
- CDN URLs for images
- Default values that might vary by deployment

---

## Next Steps

1. Review the highlighted code sections
2. Decide which values to keep vs. replace
3. I can help you:
   - Replace hardcoded values with placeholders
   - Move URLs to environment variables
   - Create a configuration file for external URLs

**Would you like me to:**
- [ ] Replace all hardcoded site IDs and serial numbers with placeholders?
- [ ] Move API URLs to environment variables?
- [ ] Create a config file for external URLs?
- [ ] Just highlight the issues (current state)?

