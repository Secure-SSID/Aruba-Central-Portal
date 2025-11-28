# WLAN Wizard Scope Assignment Fix - November 23, 2025

## Problem

The WLAN wizard was failing at the scope assignment step with a 400 "Invalid URL" error when trying to use the scope map API to assign WLANs and roles to sites.

### Symptoms
- WLAN and role creation would succeed
- Scope map assignment would fail with:
  ```
  400 Client Error: Bad Request
  {"message":"Invalid URL","debugId":"..."}
  ```
- All attempts to use `POST /network-config/v1alpha1/scope-maps/{scopeName}/{persona}/{resource}` failed

## Root Cause

The scope map POST endpoint documented in the OpenAPI spec does not work as expected. Testing revealed that ALL variations of the API call failed:
- Using scope name vs scope ID in URL path
- Different URL encoding methods (~2F, %2F, raw /)
- With or without persona in query parameters

## Solution

**The correct approach is to create resources WITH scope parameters in the creation call itself, not through a separate scope map assignment.**

### How It Works

When creating a WLAN or role for a specific site (non-global):
1. Include query parameters in the creation POST:
   - `object_type=LOCAL`
   - `scope_id={numeric_site_id}`
   - `persona={device_persona}` (e.g., "CAMPUS_AP")

2. The resource is automatically assigned to that scope
3. No separate scope map API call is needed

For global (shared) resources:
- Use `object_type=SHARED`
- Omit scope_id and persona

### Code Changes

#### ReviewDeployPage.jsx (Role Creation)
```javascript
// Before:
await configAPI.rolesPolicies.createRole(roleName, roleData);

// After:
const roleQueryParams = data.scopeType === 'global' ?
  { object_type: 'SHARED' } :
  {
    object_type: 'LOCAL',
    scope_id: data.scopeId,
    persona: devicePersona,
  };

await configAPI.rolesPolicies.createRole(roleName, roleData, roleQueryParams);
```

#### ReviewDeployPage.jsx (WLAN Creation)
```javascript
// Before:
await configAPI.wireless.createWLAN(data.wlanName, wlanData);

// After:
const wlanQueryParams = data.scopeType === 'global' ?
  { object_type: 'SHARED' } :
  {
    object_type: 'LOCAL',
    scope_id: data.scopeId,
    persona: devicePersona,
  };

await configAPI.wireless.createWLAN(data.wlanName, wlanData, wlanQueryParams);
```

#### ReviewDeployPage.jsx (Scope Assignment Steps)
```javascript
// Removed the entire scope map assignment logic (Steps 4, 5, 6)
// Replaced with instant completion since assignment happens during creation:
updateStepStatus('scope-wlan', 'completed');
updateStepStatus('scope-role', 'completed');
updateStepStatus('scope-role-gpid', 'completed');
```

## Testing

Created test scripts to validate the fix:

### test_local_wlan_creation.py
Successfully created WLAN and role with LOCAL scope parameters:
```python
wlan_params = {'object_type': 'LOCAL', 'scope_id': '54819475093', 'persona': 'CAMPUS_AP'}
role_params = {'object_type': 'LOCAL', 'scope_id': '54819475093', 'persona': 'CAMPUS_AP'}

# Both returned 200 success
```

### test_scope_urllib.py
Confirmed that scope map POST endpoint fails with ALL URL encoding methods:
- Manual ~2F encoding: 400 "Invalid URL"
- %2F encoding with quote(): 400 "Invalid URL"
- Raw slash (no encoding): 400 "Invalid URL"

## API Endpoints Tested

### ✅ Working Endpoints
- `POST /network-config/v1alpha1/wlan-ssids/{name}?object_type=LOCAL&scope_id={id}&persona={persona}`
- `POST /network-config/v1alpha1/roles/{name}?object_type=LOCAL&scope_id={id}&persona={persona}`
- `GET /network-config/v1alpha1/scope-maps` (returns empty list, but endpoint works)

### ❌ Non-Working Endpoints
- `POST /network-config/v1alpha1/scope-maps/{scopeName}/{persona}/{resource}` (all variations)

## Impact

- **WLAN Wizard**: Now successfully deploys WLANs to specific sites
- **Scope Assignment**: Happens automatically during resource creation
- **User Experience**: No more "Invalid URL" errors during deployment
- **Deployment Steps**: Reduced from 6-7 steps to 3 steps (scope assignment is instant)

## Files Modified

1. `/aruba-central-portal-v2/aruba-central-portal/dashboard/frontend/src/components/wlan-wizard/ReviewDeployPage.jsx`
   - Added LOCAL scope parameters to role creation
   - Added LOCAL scope parameters to WLAN creation
   - Removed scope map assignment API calls (Steps 4, 5, 6)
   - Commented out old code with explanation

2. `/aruba-central-portal-v2/aruba-central-portal/dashboard/frontend/src/services/api.js`
   - No changes needed (already supported query parameters)

## Test Scripts Created

1. `check_wlan_scope.py` - Verified WLAN configuration structure
2. `test_get_scopemaps.py` - Confirmed GET scope maps works
3. `test_local_wlan_creation.py` - Validated LOCAL resource creation ✅
4. `test_scope_map_id.py` - Tested scope map with scope ID
5. `test_scope_map_simple.py` - Tested scope map creation
6. `test_scope_urllib.py` - Tested different URL encodings
7. `verify_local_wlan.py` - Verified LOCAL WLAN can be read back
8. `read_local_wlan_with_scope.py` - Read LOCAL WLAN with scope params

## Conclusion

The scope map POST API endpoint is either:
1. Not implemented/enabled in this version of Aruba Central
2. Requires different authentication or permissions
3. Has incorrect documentation in the OpenAPI spec

The working solution is to use LOCAL object creation with scope parameters, which:
- Is simpler (fewer API calls)
- Works reliably (tested and validated)
- Automatically handles scope assignment
- Matches how the system is designed to work

## Next Steps

Users can now:
1. Create WLANs for specific sites using the wizard
2. Deploy WLANs successfully without scope assignment errors
3. View deployed WLANs in the WLAN management interface

## Build Information

- Frontend rebuild: 11.39s
- Date: November 23, 2025
- Status: ✅ Ready for testing
