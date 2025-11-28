# WLAN Wizard - Required Code Fixes

## File 1: ReviewDeployPage.jsx

### Fix 1.1: Line 224 - Add Query Parameters to Role Creation
```javascript
// BEFORE (Line 224):
await configAPI.rolesPolicies.createRole(roleName, roleData);

// AFTER:
await configAPI.rolesPolicies.createRole(roleName, roleData, {});
```

### Fix 1.2: Line 299 - Add Query Parameters to WLAN Creation
```javascript
// BEFORE (Line 299):
await configAPI.wireless.createWLAN(data.wlanName, wlanData);

// AFTER:
await configAPI.wireless.createWLAN(data.wlanName, wlanData, {});
```

### Fix 1.3: Lines 315-346 - Fix Scope Map Query Parameters (CRITICAL)
**Issue:** Query parameter names use underscores instead of hyphens, and scope identifier type is wrong

```javascript
// BEFORE (Lines 315-346):
const scopeIdentifier = data.scopeType === 'global' ? 'Global' : String(data.scopeId);
const scopeIdNum = data.scopeType === 'global' ? 0 : parseInt(data.scopeId, 10);

const scopeMapData = {
  'scope-name': scopeIdentifier,
  'scope-id': scopeIdNum,
  'persona': devicePersona,
  'resource': wlanResource,
};

const queryParams = data.scopeType === 'global' ? {} : {
  object_type: 'LOCAL',
  scope_id: scopeIdentifier,
  persona: devicePersona,
};

await configAPI.scopeMaps.createScopeMap(
  scopeIdentifier,
  devicePersona,
  wlanResource,
  scopeMapData,
  queryParams
);

// AFTER:
const scopeIdentifier = data.scopeType === 'global' ? 'Global' : String(parseInt(data.scopeId, 10));
const scopeIdNum = data.scopeType === 'global' ? 0 : parseInt(data.scopeId, 10);

const scopeMapData = {
  'scope-name': scopeIdentifier,
  'scope-id': scopeIdNum,
  'persona': devicePersona,
  'resource': wlanResource,
};

// FIX: Use hyphens in query parameter names, not underscores
const queryParams = data.scopeType === 'global' ? {} : {
  'object-type': 'LOCAL',     // ← Changed from object_type
  'scope-id': scopeIdentifier, // ← Changed from scope_id
  'persona': devicePersona,
};

await configAPI.scopeMaps.createScopeMap(
  scopeIdentifier,
  devicePersona,
  wlanResource,
  scopeMapData,
  queryParams
);
```

### Fix 1.4: Lines 357-383 - Fix Role Scope Map (Apply same fix as 1.3)
```javascript
// BEFORE (Lines 357-383):
const queryParams = data.scopeType === 'global' ? {} : {
  object_type: 'LOCAL',
  scope_id: scopeIdentifier,
  persona: devicePersona,
};

// AFTER:
const queryParams = data.scopeType === 'global' ? {} : {
  'object-type': 'LOCAL',     // ← Fixed hyphen
  'scope-id': scopeIdentifier, // ← Fixed hyphen
  'persona': devicePersona,
};
```

### Fix 1.5: Lines 394-420 - Fix Role-GPID Scope Map (Apply same fix as 1.3)
```javascript
// BEFORE (Lines 394-420):
const queryParams = data.scopeType === 'global' ? {} : {
  object_type: 'LOCAL',
  scope_id: scopeIdentifier,
  persona: devicePersona,
};

// AFTER:
const queryParams = data.scopeType === 'global' ? {} : {
  'object-type': 'LOCAL',     // ← Fixed hyphen
  'scope-id': scopeIdentifier, // ← Fixed hyphen
  'persona': devicePersona,
};
```

### Fix 1.6: Line 437 - Remove Unnecessary String Conversion for VLAN ID
```javascript
// BEFORE (Lines 432-438):
for (const mpsk of data.mpskList) {
  const mpskData = {
    name: mpsk.name,
    passphrase: mpsk.passphrase,
    role: roleName,
    vlan: vlanId.toString(),  // ← Unnecessary conversion
  };
  await configAPI.nacService.createMPSKRegistration(mpskData);
}

// AFTER:
for (const mpsk of data.mpskList) {
  const mpskData = {
    name: mpsk.name,
    passphrase: mpsk.passphrase,
    role: roleName,
    vlan: vlanId,  // ← Use numeric value directly
  };
  await configAPI.nacService.createMPSKRegistration(mpskData);
}
```

### Fix 1.7: Lines 228-235 - Improve Role "Already Exists" Error Handling
```javascript
// BEFORE:
} catch (error) {
  // If role already exists, treat it as success
  if (error.message && error.message.includes('already exists')) {
    console.log(`Role ${roleName} already exists, continuing...`);
    updateStepStatus('role', 'completed');
  } else {
    updateStepStatus('role', 'error', error.message);
    throw new Error(`Failed to create role: ${error.message}`);
  }
}

// AFTER:
} catch (error) {
  // If role already exists, treat it as success
  // Check both status code and error message for robustness
  const statusCode = error.response?.status;
  const errorMsg = error.message || '';

  if (statusCode === 409 || errorMsg.toLowerCase().includes('already exists')) {
    console.log(`Role ${roleName} already exists, continuing...`);
    updateStepStatus('role', 'completed');
  } else {
    updateStepStatus('role', 'error', error.message);
    throw new Error(`Failed to create role: ${error.message}`);
  }
}
```

### Fix 1.8: Line 180 - Add Fallback for Empty VLAN Name
```javascript
// BEFORE:
const vlanData = {
  vlan: vlanId,
  name: data.vlanName || `VLAN-${vlanId}`,
  descriptionAlias: `VLAN for ${data.wlanName}`,
};

// AFTER:
const vlanData = {
  vlan: vlanId,
  name: (data.vlanName && data.vlanName.trim()) || `VLAN-${vlanId}`,
  descriptionAlias: `VLAN for ${data.wlanName}`,
};
```

### Fix 1.9: Line 191 - Use Numeric Type for vlanIdRanges
```javascript
// BEFORE:
const namedVlanData = {
  name: `vlan-${vlanId}`,
  vlan: {
    vlanIdRanges: [vlanId.toString()],  // ← String type
  },
};

// AFTER:
const namedVlanData = {
  name: `vlan-${vlanId}`,
  vlan: {
    vlanIdRanges: [vlanId],  // ← Use numeric type for consistency
  },
};
```

---

## File 2: central_api_client.py

### Fix 2.1: Line 105-131 - Add Comprehensive Logging to POST Method
```python
# BEFORE:
def post(self, endpoint: str, data: Optional[Dict[str, Any]] = None, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Make a POST request to the API."""
    self._ensure_valid_token()
    url = f"{self.base_url}{endpoint}"
    logger.debug(f"POST {url}")

    response = self.session.post(url, json=data, params=params)
    response.raise_for_status()

    return response.json()

# AFTER:
def post(self, endpoint: str, data: Optional[Dict[str, Any]] = None, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Make a POST request to the API."""
    self._ensure_valid_token()
    url = f"{self.base_url}{endpoint}"
    logger.info(f"POST {url}")
    logger.debug(f"POST data: {data}, params: {params}")

    response = self.session.post(url, json=data, params=params)

    # Log response details for debugging
    logger.debug(f"Response status: {response.status_code}")
    logger.debug(f"Response headers: {dict(response.headers)}")

    if response.status_code >= 400:
        logger.error(f"API Error {response.status_code}: {response.text[:500]}")

    response.raise_for_status()

    # Handle empty responses
    if not response.text or response.text.strip() == '':
        logger.warning(f"Empty response body from {url}")
        return {}

    try:
        return response.json()
    except ValueError as e:
        logger.error(f"Failed to parse JSON response from {url}: {e}")
        logger.error(f"Response text (first 500 chars): {response.text[:500]}")
        return {}
```

---

## Summary of Changes

### Critical (Must Fix):
- [x] Fix 1.3 - Query parameter hyphens (scope-maps WLAN)
- [x] Fix 1.4 - Query parameter hyphens (scope-maps Role)
- [x] Fix 1.5 - Query parameter hyphens (scope-maps Role-GPID)
- [x] Fix 1.1 - Add query params to role creation
- [x] Fix 1.2 - Add query params to WLAN creation

### High Priority (Should Fix):
- [x] Fix 1.7 - Improve error detection for role already exists
- [x] Fix 1.6 - Remove unnecessary VLAN string conversion
- [x] Fix 2.1 - Add logging to POST method

### Medium Priority (Nice to Fix):
- [x] Fix 1.8 - Validate VLAN name not empty
- [x] Fix 1.9 - Use consistent numeric type for VLAN ranges

---

## Testing Checklist

After applying fixes, test with these scenarios:

```javascript
// Test 1: Global scope WLAN
POST /api/config/scope-maps/Global/CAMPUS_AP/wlan-ssids~2FTest-WLAN
Query: object-type=LOCAL&persona=CAMPUS_AP
Body: {scope-name, scope-id, persona, resource}

// Test 2: Local site scope WLAN
POST /api/config/scope-maps/123/CAMPUS_AP/wlan-ssids~2FTest-WLAN
Query: object-type=LOCAL&scope-id=123&persona=CAMPUS_AP
Body: {scope-name: 123, scope-id: 123, persona: CAMPUS_AP, resource: wlan-ssids/Test-WLAN}

// Test 3: Verify query parameter hyphen format
Request should contain: object-type=LOCAL (not object_type=LOCAL)
Request should contain: scope-id=123 (not scope_id=123)

// Test 4: Verify role creation gets empty query params
POST /api/config/roles/Test-Role
Query: (empty)
Body: {name, description, vlan-parameters, qos-parameters}

// Test 5: Verify WLAN creation gets empty query params
POST /api/config/wlan/Test-WLAN
Query: (empty)
Body: {ssid, opmode, vlan-id-range, default-role, ...}
```

