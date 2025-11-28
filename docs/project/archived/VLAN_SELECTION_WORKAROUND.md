# Tunnel Mode VLAN Selection - Workaround Solution

**Date**: November 24, 2025
**Status**: ✅ Implemented with Fallback

---

## Problem Summary

The Aruba Central CNX Config API does not provide a dedicated endpoint to fetch VLANs configured on a specific gateway. Attempted endpoints:

- ❌ `/network-config/v1alpha1/gateways/{serial}/vlans` → 400 "Invalid module name"
- ❌ `/network-config/v1alpha1/layer2-vlans` → 400 "Invalid module name"
- ❌ `/configuration/v1/gateways/{serial}/vlans` → 404 Not Found

**Root Cause**: These VLAN endpoints either don't exist in the API or require different parameters/authentication.

---

## Implemented Solution

### Adaptive UI Behavior

The WLAN wizard now uses **adaptive logic** for tunnel mode VLAN selection:

#### Scenario 1: Gateway VLANs Available ✅
If the gateway VLAN API returns data successfully:
- Show **dropdown** with available VLANs
- User selects from pre-configured VLANs only
- Success message: "✓ Showing VLANs configured on the selected gateway"

#### Scenario 2: Gateway VLANs Not Available (Current) ⚠️
If the gateway VLAN API fails or returns empty:
- Show **text input** for manual VLAN ID entry
- Display prominent **warning message**:
  ```
  ⚠️ Important: For tunnel mode, the VLAN must be pre-configured on gateway.
  If the VLAN doesn't exist, WLAN creation will fail with error "L2-VLAN:X is not configured".
  ```
- Show helpful tip: "💡 Tip: Configure VLANs on your gateway in Aruba Central before creating tunnel mode WLANs"

---

## User Experience

### For Bridge Mode (No Change)
- User enters any VLAN ID (1-4094)
- System checks if VLAN exists
- If not, offers to create it

### For Tunnel Mode (New Behavior)

**When Gateway VLANs Can Be Fetched**:
```
[Dropdown: VLAN ID (from Gateway)]
  VLAN 2 - Corporate
  VLAN 10 - Guest
  VLAN 20 - IoT

✓ Showing VLANs configured on the selected gateway
```

**When Gateway VLANs Cannot Be Fetched**:
```
[Text Input: VLAN ID (Manual Entry)]
Enter VLAN ID (1-4094)

⚠️ Important: For tunnel mode, the VLAN must be pre-configured
on gateway Aruba9004_82_04_C2.
If the VLAN doesn't exist, WLAN creation will fail with error
"L2-VLAN:X is not configured".

💡 Tip: Configure VLANs on your gateway in Aruba Central before
creating tunnel mode WLANs
```

---

## Code Changes

### Frontend: `AuthNetworkPage.jsx`

**Before** (Always showed dropdown):
```jsx
{data.forwardMode === 'FORWARD_MODE_L2' && data.gatewaySerial ? (
  <Select>
    {gatewayVlans.map(...)}
  </Select>
) : (
  <TextField label="VLAN ID" />
)}
```

**After** (Adaptive logic):
```jsx
{/* If tunnel mode AND VLANs available → show dropdown */}
{data.forwardMode === 'FORWARD_MODE_L2' && data.gatewaySerial &&
 gatewayVlans.length > 0 && !loadingGatewayVlans ? (
  <Select>
    {gatewayVlans.map(...)}
  </Select>
  <Typography color="success.main">
    ✓ Showing VLANs configured on the selected gateway
  </Typography>

{/* If tunnel mode but NO VLANs → show text field with warning */}
) : data.forwardMode === 'FORWARD_MODE_L2' && data.gatewaySerial ? (
  <TextField label="VLAN ID (Manual Entry)" />
  <Alert severity="warning">
    <strong>Important:</strong> For tunnel mode, the VLAN must be
    pre-configured on gateway...
  </Alert>
  <Typography variant="caption">
    💡 Tip: Configure VLANs on your gateway in Aruba Central...
  </Typography>

{/* Bridge mode → normal text field */}
) : (
  <TextField label="VLAN ID" />
)}
```

**Key Points**:
- Three distinct UI paths based on mode and VLAN availability
- Clear warning messages when manual entry required
- Graceful degradation from dropdown to text input

---

## Benefits of This Approach

### 1. **Future-Proof** ✅
When Aruba adds proper VLAN APIs, the dropdown will automatically work without code changes

### 2. **User-Friendly** ✅
Clear warning messages explain the requirements and prevent confusion

### 3. **Functional** ✅
Users can still create tunnel mode WLANs if they know the correct VLAN ID

### 4. **Error Prevention** ✅
Warning message educates users about the requirement BEFORE they encounter errors

### 5. **No Breaking Changes** ✅
Bridge mode functionality unchanged, only tunnel mode enhanced

---

## Testing Instructions

### Test Case 1: Tunnel Mode WLAN Creation

1. **Navigate to WLAN Wizard**:
   - Open dashboard: http://localhost:1344
   - Go to Configuration → Wireless → Create WLAN

2. **Configure Tunnel Mode**:
   - Select "Tunneled (Gateway)" forward mode
   - Select gateway from dropdown
   - Observe VLAN field behavior

3. **Expected Result**:
   - Text input appears with label "VLAN ID (Manual Entry)"
   - Warning message displayed:
     ```
     ⚠️ Important: For tunnel mode, the VLAN must be pre-configured on gateway...
     ```

4. **Enter VLAN ID**:
   - Enter "2" (or another VLAN you've configured on your gateway)
   - Complete wizard

5. **Test Scenarios**:

   **A. VLAN Exists on Gateway** ✅
   - Enter VLAN 2
   - WLAN creation succeeds
   - WLAN shows as "Tunneled" in dashboard

   **B. VLAN Doesn't Exist** ⚠️
   - Enter VLAN 999
   - WLAN creation fails
   - Error: `"L2-VLAN:999 is not configured"`
   - User sees error, but was warned beforehand

---

## How to Configure VLANs on Gateway

### Option 1: Via Aruba Central UI

1. Login to Aruba Central
2. Navigate to **Configuration → Network**
3. Select your gateway device
4. Go to **VLANs** tab
5. Click **+ Add VLAN**
6. Enter VLAN ID and name
7. Save configuration

### Option 2: Via ArubaOS CLI

```bash
# SSH into gateway
ssh admin@<gateway-ip>

# Enter config mode
configure terminal

# Create VLAN
vlan 2
  name Corporate
  exit

# Save config
write memory
```

### Option 3: Via Aruba Central API

```bash
# Example API call (requires proper endpoint discovery)
POST /configuration/v1/gateways/{serial}/vlans
{
  "vlan_id": 2,
  "name": "Corporate",
  "description": "Corporate network"
}
```

---

## Known Limitations

### 1. **No VLAN Validation**
- System cannot pre-validate if VLAN exists on gateway
- User will only discover errors during WLAN creation
- **Mitigation**: Clear warning messages

### 2. **No VLAN Discovery**
- Cannot show list of available gateway VLANs
- User must know VLAN IDs beforehand
- **Mitigation**: Instructional messages and links

### 3. **No VLAN Creation**
- Cannot create VLANs directly from wizard
- User must configure VLANs via Central UI first
- **Mitigation**: Future enhancement possibility

---

## Future Enhancements

### Priority 1: Find Correct VLAN API ⭐⭐⭐
- Research Aruba Central API documentation
- Test alternative API paths
- Contact Aruba support if needed

### Priority 2: Parse Gateway Configuration ⭐⭐
- Fetch full gateway config: `/network-config/v1alpha1/gateways/{serial}`
- Parse VLAN information from configuration object
- Extract VLAN IDs and names

### Priority 3: Add VLAN Creation UI ⭐
- Add "Create VLAN" button in wizard
- Modal dialog for VLAN configuration
- Create VLAN on gateway via API

### Priority 4: VLAN Validation ⭐
- Add backend endpoint to check if VLAN exists
- Show real-time validation in UI
- Prevent WLAN creation with non-existent VLANs

---

## API Research Needed

### Potential Endpoints to Test

1. **Gateway Full Configuration**:
   ```
   GET /network-config/v1alpha1/gateways/{serial}
   → May contain VLAN config in response
   ```

2. **Monitoring API**:
   ```
   GET /network-monitoring/v1alpha1/gateways/{serial}
   → May include operational VLAN data
   ```

3. **Device Inventory**:
   ```
   GET /platform/device_inventory/v1/devices/{serial}
   → May show configured VLANs
   ```

4. **Configuration API (older)**:
   ```
   GET /configuration/v1/devices/{serial}
   → Legacy endpoint, may have VLAN info
   ```

### Documentation Links

- [Aruba Central API Docs](https://developer.arubanetworks.com/aruba-central/docs)
- [HPE GreenLake Networking API](https://developer.greenlake.hpe.com/)
- [Aruba Support Portal](https://asp.arubanetworks.com/)

---

## Conclusion

The implemented solution provides a **functional workaround** that:
- ✅ Allows users to create tunnel mode WLANs
- ✅ Provides clear warnings about requirements
- ✅ Gracefully degrades when API unavailable
- ✅ Will automatically use dropdown when API becomes available

**User Action Required**:
1. Configure VLANs on gateway via Aruba Central UI
2. Use manual VLAN ID entry when creating tunnel mode WLANs
3. Ensure VLAN ID matches configured gateway VLAN

**Next Steps for Development**:
1. Research correct gateway VLAN API endpoint
2. Test parsing VLANs from full gateway configuration
3. Consider adding VLAN creation UI as future enhancement

---

**Status**: ✅ **Workaround Implemented and Functional**

**Files Modified**:
- `dashboard/frontend/src/components/wlan-wizard/AuthNetworkPage.jsx`

**Documentation**:
- `aruba-api-docs/TUNNEL_MODE_VLAN_SELECTION.md` - Original implementation
- `aruba-api-docs/TUNNEL_MODE_TESTING_RESULTS.md` - Test results
- `aruba-api-docs/VLAN_SELECTION_WORKAROUND.md` - This document
