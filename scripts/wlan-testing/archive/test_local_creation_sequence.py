#!/usr/bin/env python3
"""Test LOCAL resource creation in the sequence the real wizard uses:
1. Create role-gpid first
2. Create role as LOCAL
3. Create WLAN as LOCAL
"""

import json
import requests

# Load cached token
with open('/home/choate/aruba-central-portal-v2/aruba-central-portal/dashboard/backend/.token_cache_central.json', 'r') as f:
    token_data = json.load(f)
    access_token = token_data['access_token']

print("=" * 80)
print("Testing LOCAL Resource Creation Sequence")
print("=" * 80)

base_url = "https://internal.api.central.arubanetworks.com/network-config/v1alpha1"
headers = {
    "Authorization": f"Bearer {access_token}",
    "Content-Type": "application/json"
}

wlan_name = "TestSequence"
role_name = f"{wlan_name}-default"
scope_id = "54819475093"
persona = "CAMPUS_AP"

local_params = {
    'object_type': 'LOCAL',
    'scope_id': scope_id,
    'persona': persona
}

# Step 1: Create role-gpid first
print(f"\n1. Creating role-gpid '{role_name}' as LOCAL...")
role_gpid_data = {
    'name': role_name,
    'description': f'Auto-generated role-gpid for {wlan_name}',
}

url1 = f"{base_url}/role-gpids/{role_name}"
response1 = requests.post(url1, headers=headers, json=role_gpid_data, params=local_params)
print(f"   Status: {response1.status_code}")
if response1.status_code != 200:
    print(f"   Error: {response1.text[:500]}")
else:
    print(f"   ✅ Role-gpid created")

# Step 2: Create role as LOCAL
print(f"\n2. Creating role '{role_name}' as LOCAL...")
role_data = {
    'name': role_name,
    'description': f'Default role for {wlan_name}',
    'vlan-parameters': {
        'access-vlan': 1
    },
    'qos-parameters': {
        'cos': 0
    }
}

url2 = f"{base_url}/roles/{role_name}"
response2 = requests.post(url2, headers=headers, json=role_data, params=local_params)
print(f"   Status: {response2.status_code}")
if response2.status_code != 200:
    print(f"   Error: {response2.text[:500]}")
else:
    print(f"   ✅ Role created")

# Step 3: Create WLAN as LOCAL
print(f"\n3. Creating WLAN '{wlan_name}' as LOCAL...")
wlan_data = {
    'enable': True,
    'dot11k': True,
    'dot11r': True,
    'dot11v': True,
    'high-efficiency': {
        'enable': True
    },
    'max-clients-threshold': 64,
    'inactivity-timeout': 1000,
    'personal-security': {
        'passphrase-format': 'STRING',
        'wpa-passphrase': 'Aruba123!',
    },
    'ssid': wlan_name,
    'description': f'Test WLAN {wlan_name}',
    'opmode': 'WPA2_PERSONAL',
    'forward-mode': 'FORWARD_MODE_BRIDGE',
    'essid': {
        'name': wlan_name
    },
    'vlan-selector': 'VLAN_RANGES',
    'vlan-id-range': ['1'],
    'default-role': role_name,
}

url3 = f"{base_url}/wlan-ssids/{wlan_name}"
response3 = requests.post(url3, headers=headers, json=wlan_data, params=local_params)
print(f"   Status: {response3.status_code}")
if response3.status_code != 200:
    print(f"   Error: {response3.text[:500]}")
else:
    print(f"   ✅ WLAN created")

# Step 4: Verify by reading back the resources
print("\n" + "=" * 80)
print("Verification: Reading back created resources")
print("=" * 80)

# Read role-gpid
print(f"\n1. Reading role-gpid '{role_name}'...")
response4 = requests.get(f"{base_url}/role-gpids/{role_name}", headers=headers, params={'scope_id': scope_id, 'persona': persona})
print(f"   Status: {response4.status_code}")
if response4.status_code == 200:
    gpid_data = response4.json()
    print(f"   Name: {gpid_data.get('name', 'N/A')}")
    print(f"   Description: {gpid_data.get('description', 'N/A')}")
    print(f"   Empty: {len(gpid_data) == 0}")
    if len(gpid_data) > 0:
        print(f"   ✅ Role-gpid has data!")
        print(f"   Data: {json.dumps(gpid_data, indent=2)}")
    else:
        print(f"   ❌ Role-gpid is empty")

# Read role
print(f"\n2. Reading role '{role_name}'...")
response5 = requests.get(f"{base_url}/roles/{role_name}", headers=headers, params={'scope_id': scope_id, 'persona': persona})
print(f"   Status: {response5.status_code}")
if response5.status_code == 200:
    role_read = response5.json()
    print(f"   Name: {role_read.get('name', 'N/A')}")
    print(f"   VLAN: {role_read.get('vlan-parameters', {}).get('access-vlan', 'N/A')}")
    print(f"   Empty: {len(role_read) == 0}")
    if len(role_read) > 0:
        print(f"   ✅ Role has data!")
        print(f"   Data: {json.dumps(role_read, indent=2)}")
    else:
        print(f"   ❌ Role is empty")

# Read WLAN
print(f"\n3. Reading WLAN '{wlan_name}'...")
response6 = requests.get(f"{base_url}/wlan-ssids/{wlan_name}", headers=headers, params={'scope_id': scope_id, 'persona': persona})
print(f"   Status: {response6.status_code}")
if response6.status_code == 200:
    wlan_read = response6.json()
    print(f"   SSID: {wlan_read.get('ssid', 'N/A')}")
    print(f"   Enabled: {wlan_read.get('enable', 'N/A')}")
    print(f"   OpMode: {wlan_read.get('opmode', 'N/A')}")
    print(f"   Password configured: {'personal-security' in wlan_read}")
    print(f"   Default Role: {wlan_read.get('default-role', 'N/A')}")
    print(f"   Empty: {len(wlan_read) == 0}")
    if len(wlan_read) > 0:
        print(f"   ✅ WLAN has data!")
        print(f"   Data: {json.dumps(wlan_read, indent=2)}")
    else:
        print(f"   ❌ WLAN is empty")

print("\n" + "=" * 80)
print("CONCLUSION")
print("=" * 80)
print("\nIf all resources show as empty, LOCAL creation doesn't persist config data.")
print("If resources have data, then the sequence matters (role-gpid → role → WLAN).")
print("=" * 80)
