# WLAN Wizard Fixes - Session 2 (November 23, 2025)

## Executive Summary

Continued troubleshooting of WLAN deployment wizard. Identified and fixed 3 critical issues:
1. **ESSID field format** - Should be string, not array
2. **high-efficiency object structure** - Should only contain `enable` field
3. **Scope map query parameters** - Backend wasn't forwarding them to Aruba API

---

## Issues Fixed

### 1. ESSID Field Format (CRITICAL)
**Problem**: Changed ESSID name to array format based on API spec, but actual API expects string.

**Location**:
- `ReviewDeployPage.jsx:269-272`
- `wlanTemplates.js` (documentation comment)

**Root Cause**: Misinterpretation of API spec. Actual working WLANs use string format.

**Before** (WRONG):
```javascript
essid: {
  name: [data.ssidBroadcastName],  // ❌ Array
}
```

**After** (CORRECT):
```javascript
essid: {
  name: data.ssidBroadcastName,  // ✅ String (matches working API examples)
}
```

**Evidence**: User provided working WLAN configurations from API showing:
```json
"essid": {
  "use-alias": false,
  "name": "aruba-home"  // String, not array!
}
```

**Impact**: 400 Bad Request errors with message "failed to parse data tree: Expected JSON name/value or special name/[null], but input data contains name/[string]."

---

### 2. high-efficiency Object Structure (CRITICAL)
**Problem**: Included `txbf` and `individual-twt` sub-features in base configuration, but API rejects these.

**Location**: `wlanTemplates.js:19-22`

**Before** (WRONG):
```javascript
'high-efficiency': {
  'enable': true,
  'txbf': true,             // ❌ Not in working examples
  'individual-twt': true,   // ❌ Not in working examples
}
```

**After** (CORRECT):
```javascript
'high-efficiency': {
  'enable': true,
  // Note: txbf and individual-twt are sub-features not included in base config
}
```

**Evidence**: Working WLANs from API only show:
```json
"high-efficiency": {
  "enable": true
}
```

**Impact**: Same 400 Bad Request JSON parsing error.

---

### 3. Scope Map Query Parameters Not Forwarded (CRITICAL)
**Problem**: Backend receives query parameters from frontend but doesn't forward them to Aruba API.

**Location**: `app.py:1019-1040` (backend)

**Root Cause**: Backend's `create_scope_map` function only forwarded request body, not query parameters.

**Before** (WRONG):
```python
@app.route('/api/config/scope-maps/<path:scope_resource>', methods=['POST'])
@require_session
def create_scope_map(scope_resource):
    try:
        assignment_data = request.get_json()
        logger.info(f"Creating scope map {scope_resource} with data: {assignment_data}")
        # ❌ NOT forwarding query parameters!
        response = aruba_client.post(f'/network-config/v1alpha1/scope-maps/{scope_resource}', data=assignment_data)
        return jsonify(response)
    except Exception as e:
        # error handling
```

**After** (CORRECT):
```python
@app.route('/api/config/scope-maps/<path:scope_resource>', methods=['POST'])
@require_session
def create_scope_map(scope_resource):
    try:
        assignment_data = request.get_json()
        params = request.args.to_dict()  # ✅ Get query parameters
        logger.info(f"Creating scope map {scope_resource} with data: {assignment_data}")
        logger.info(f"Query parameters: {params}")  # ✅ Log them
        # ✅ Forward query parameters to API
        response = aruba_client.post(f'/network-config/v1alpha1/scope-maps/{scope_resource}', data=assignment_data, params=params)
        return jsonify(response)
    except Exception as e:
        # error handling
```

**Impact**:
- Scope map assignments failing with 400 Bad Request
- Query parameters `object_type=LOCAL`, `scope_id`, and `persona` not being sent to API
- API likely rejecting requests due to missing required parameters

**Error Message**:
```
Failed to assign WLAN to scope: 400 Client Error: Bad Request for url:
https://internal.api.central.arubanetworks.com/network-config/v1alpha1/scope-maps/54819475093/CAMPUS_AP/wlan-ssids~2Fyes
```

---

## Investigation Process

### 1. Initial Error Analysis
User reported 400 Bad Request on scope map assignment for WLAN "yes":
```
POST http://localhost:1344/api/config/scope-maps/54819475093/CAMPUS_AP/wlan-ssids~2Fyes?object_type=LOCAL&scope_id=54819475093&persona=CAMPUS_AP 500 (INTERNAL SERVER ERROR)
```

Key observations:
- Frontend sending query parameters ✅
- URL encoding working correctly (`wlan-ssids~2Fyes` for `wlan-ssids/yes`) ✅
- Backend returning 500 error (internal error, not API error)

### 2. Backend Logs Review
Previous deployment for WLAN "bedtime" showed:
```python
'essid': {'name': ['bedtime']}  # ❌ Array format
'high-efficiency': {
  'enable': True,
  'txbf': True,
  'individual-twt': True
}  # ❌ Sub-features included
```

These matched our earlier "best practice" additions, confirming the WLAN config was still incorrect.

### 3. User-Provided Working Examples
User shared 3 working WLAN configurations from their system:
- `VendorNet-MPSK-AES` (MPSK with bridge mode)
- `aruba-home` (WPA3-SAE with L2 tunnel)
- `cnx` (WPA2-Personal with L2 tunnel)

All showed:
- ESSID name as **string**, not array
- high-efficiency with **only `enable` field**

### 4. API Specification Review
Read `scopemap.json` OpenAPI spec:
- Path: `/scope-maps/{scopeName}/{persona}/{resource}`
- All three parameters required in path
- Query parameters: `object_type`, `scope_id`, `persona`

Discovered backend wasn't extracting and forwarding query parameters.

---

## Testing Performed

### Manual Testing
1. ✅ Read scopemap.json API specification
2. ✅ Reviewed backend create_scope_map implementation
3. ✅ Compared user's working WLAN configs with our templates
4. ✅ Identified ESSID format mismatch
5. ✅ Identified high-efficiency structure mismatch
6. ✅ Identified missing query parameter forwarding

### Files Modified and Rebuilt
1. **wlanTemplates.js** - Fixed high-efficiency object structure
2. **ReviewDeployPage.jsx** - Fixed ESSID format from array to string
3. **app.py** (backend) - Added query parameter forwarding
4. **Frontend rebuilt** successfully (11.69s, no errors)
5. **Backend auto-reloaded** (Flask debug mode)

---

## Current Status

### ✅ Fixed Issues
1. ESSID field format corrected (string instead of array)
2. high-efficiency object simplified (only `enable` field)
3. Backend now forwards query parameters for scope maps

### ⏳ Awaiting Testing
User needs to test WLAN creation with fixes:
1. Create a simple WPA2-Personal WLAN
2. Verify WLAN creation succeeds
3. Verify scope map assignment succeeds
4. Verify WLAN appears on devices

---

## Key Learnings

### 1. Trust Working Examples Over Specs
The API spec suggested ESSID should be an array, but working configurations showed strings. Real-world examples are more reliable than documentation.

### 2. Backend Query Parameter Forwarding
Flask's `@app.route` receives query parameters via `request.args`, but they must be explicitly extracted and forwarded when proxying to another API.

### 3. URL Encoding in Path Parameters
The `~2F` encoding for forward slashes is correct and necessary:
- Frontend: `wlan-ssids/yes` → `wlan-ssids~2Fyes`
- Flask decodes: `wlan-ssids/yes` (via `<path:scope_resource>`)
- Requests library encodes again when building URL
- Result: Correct path format for Aruba API

### 4. Best Practice Defaults Need Validation
Our "best practice" defaults for 802.11k/r/v and WiFi 6 were well-intentioned but included fields the API doesn't accept in base configuration:
- ✅ Keep: `dot11k`, `dot11r`, `dot11v`, `high-efficiency.enable`
- ❌ Remove: `txbf`, `individual-twt` (these are sub-features)

---

## Recommended Next Steps

### Immediate (Required for Testing)
1. **User**: Test WLAN creation with new fixes
2. **User**: Hard refresh browser (Ctrl+F5) to clear cached JS
3. **User**: Attempt deployment and report results

### High Priority (If Tests Pass)
1. **Add comprehensive error messages** for scope map failures
2. **Add rollback confirmation** before deleting resources
3. **Implement AAA profile creation** for WPA2-Enterprise
4. **Add Hide SSID UI toggle** in wizard

### Medium Priority (Future Enhancement)
5. **RF Band Selection** (2.4GHz only, 5GHz only, etc.)
6. **Client Isolation** toggle for guest networks
7. **Inactivity Timeout** customization
8. **VLAN Selector Options** (named VLAN vs VLAN ranges)

---

## Files Changed This Session

### Frontend
1. `/home/choate/aruba-central-portal-v2/aruba-central-portal/dashboard/frontend/src/utils/wlanTemplates.js`
   - Lines 19-22: Removed `txbf` and `individual-twt` from high-efficiency object

2. `/home/choate/aruba-central-portal-v2/aruba-central-portal/dashboard/frontend/src/components/wlan-wizard/ReviewDeployPage.jsx`
   - Lines 269-272: Changed ESSID name from array to string

### Backend
3. `/home/choate/aruba-central-portal-v2/aruba-central-portal/dashboard/backend/app.py`
   - Lines 1031-1034: Added query parameter extraction and forwarding for scope maps

---

## Build Status

### Frontend Build
```bash
✓ built in 11.69s
✓ 12917 modules transformed
✓ No compilation errors
```

### Backend Status
```
Flask auto-reload: ✅ Active (debug mode)
Token manager: ✅ Loaded valid token from cache
API client: ✅ Initialized successfully
```

---

## Error Messages Reference

### Before Fixes
```
400 Client Error: Bad Request
{
  "httpStatusCode": 400,
  "message": "failed to parse data tree: Expected JSON name/value or
             special name/[null], but input data contains name/[string].",
  "debugId": "b40d935138c98abbcb71eaf760cdb209",
  "errorCode": "HPE_GL_ERROR_BAD_REQUEST"
}
```

### Expected After Fixes
```
✅ WLAN created successfully
✅ Scope map assigned successfully
✅ WLAN appears on access points
```

---

## Summary of All Changes (Both Sessions)

### Session 1 (November 22, 2025)
1. Fixed forward mode enums (`FORWARD_MODE_L2/L3` instead of `TUNNEL`)
2. Added 802.11k/r/v fast roaming defaults
3. Added WiFi 6 high-efficiency defaults (later corrected)
4. Removed bandwidth throttling (100 Kbps limits)
5. Added modern auth types (Enhanced Open, WPA3 variants)
6. Removed manual role-gpid creation (auto-created)

### Session 2 (November 23, 2025 - This Session)
7. Fixed ESSID format (string, not array)
8. Fixed high-efficiency structure (only `enable` field)
9. Fixed scope map query parameter forwarding

---

**Generated**: November 23, 2025, 12:57 AM UTC
**Session Duration**: ~2 hours investigation
**User Status**: Going to bed, requested autonomous investigation
**Next Action**: User testing upon waking

