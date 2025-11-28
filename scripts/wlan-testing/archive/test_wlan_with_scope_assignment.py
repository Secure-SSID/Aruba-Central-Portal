#!/usr/bin/env python3
"""Test creating WLAN and then assigning to scope/device function"""

import json
import requests

# Load cached token
with open('/home/choate/aruba-central-portal-v2/aruba-central-portal/dashboard/backend/.token_cache_central.json', 'r') as f:
    token_data = json.load(f)
    access_token = token_data['access_token']

print("=" * 80)
print("Testing WLAN Creation + Scope Assignment")
print("=" * 80)

base_url = "https://internal.api.central.arubanetworks.com/network-config/v1alpha1"
headers = {
    "Authorization": f"Bearer {access_token}",
    "Content-Type": "application/json"
}

wlan_name = "AutoScopeTest"
scope_id = "54819475093"
scope_name = "HomeLab"
persona = "CAMPUS_AP"

# Step 1: Create WLAN in Library without default-role (system will auto-create)
print(f"\n1. Creating WLAN '{wlan_name}' in Library (SHARED)...")
wlan_data = {
    'enable': True,
    'dot11k': True,
    'personal-security': {
        'passphrase-format': 'STRING',
        'wpa-passphrase': 'Aruba123!',
    },
    'ssid': wlan_name,
    'description': f'Test WLAN with auto scope',
    'opmode': 'WPA2_PERSONAL',
    'forward-mode': 'FORWARD_MODE_BRIDGE',
    'essid': {
        'name': wlan_name
    },
    'vlan-selector': 'VLAN_RANGES',
    'vlan-id-range': ['1'],
    # No default-role - let system auto-create
}

url1 = f"{base_url}/wlan-ssids/{wlan_name}"
response1 = requests.post(url1, headers=headers, json=wlan_data, params={'object_type': 'SHARED'})
print(f"   Status: {response1.status_code}")
if response1.status_code == 200:
    print(f"   ✅ WLAN created in Library")
else:
    print(f"   Error: {response1.text[:500]}")

# Step 2: Try different scope assignment methods
print(f"\n2. Trying scope assignment methods...")

# Method 1: PUT to scope-maps
print(f"\n   Method 1: PUT to scope-maps...")
scope_map_data = {
    'scope-name': scope_name,
    'scope-id': int(scope_id),
    'persona': persona,
    'resource': f'wlan-ssids/{wlan_name}'
}
url2 = f"{base_url}/scope-maps"
response2 = requests.put(url2, headers=headers, json=scope_map_data)
print(f"   Status: {response2.status_code}")
if response2.status_code in [200, 201]:
    print(f"   ✅ Scope map created!")
else:
    print(f"   Error: {response2.text[:300]}")

# Method 2: POST with array
print(f"\n   Method 2: POST array to scope-maps...")
scope_maps_array = {
    'scope-map': [
        {
            'scope-name': scope_name,
            'scope-id': int(scope_id),
            'persona': persona,
            'resource': f'wlan-ssids/{wlan_name}'
        }
    ]
}
response3 = requests.post(url2, headers=headers, json=scope_maps_array)
print(f"   Status: {response3.status_code}")
if response3.status_code in [200, 201]:
    print(f"   ✅ Scope maps created!")
else:
    print(f"   Error: {response3.text[:300]}")

# Method 3: PATCH to scope-maps
print(f"\n   Method 3: PATCH to scope-maps...")
response4 = requests.patch(url2, headers=headers, json=scope_map_data)
print(f"   Status: {response4.status_code}")
if response4.status_code in [200, 201]:
    print(f"   ✅ Scope map patched!")
else:
    print(f"   Error: {response4.text[:300]}")

# Method 4: Try creating as LOCAL directly with scope in creation
print(f"\n   Method 4: Creating directly as LOCAL with scope...")
wlan_name2 = "DirectLocal"
wlan_data2 = {
    'enable': True,
    'dot11k': True,
    'personal-security': {
        'passphrase-format': 'STRING',
        'wpa-passphrase': 'Aruba123!',
    },
    'ssid': wlan_name2,
    'opmode': 'WPA2_PERSONAL',
    'forward-mode': 'FORWARD_MODE_BRIDGE',
    'essid': {
        'name': wlan_name2
    },
    'vlan-selector': 'VLAN_RANGES',
    'vlan-id-range': ['1'],
}
url3 = f"{base_url}/wlan-ssids/{wlan_name2}"
local_params = {'object_type': 'LOCAL', 'scope_id': scope_id, 'persona': persona}
response5 = requests.post(url3, headers=headers, json=wlan_data2, params=local_params)
print(f"   Status: {response5.status_code}")
if response5.status_code == 200:
    print(f"   ✅ LOCAL WLAN created")
    # Check if it has config
    response6 = requests.get(url3, headers=headers, params=local_params)
    if response6.status_code == 200:
        local_wlan = response6.json()
        has_config = len(local_wlan) > 0 and 'ssid' in local_wlan
        print(f"   Has config: {has_config}")
else:
    print(f"   Error: {response5.text[:300]}")

# Step 3: Check if scope maps were created
print(f"\n3. Checking scope maps...")
response7 = requests.get(f"{base_url}/scope-maps", headers=headers, params={'scope_id': scope_id})
if response7.status_code == 200:
    maps = response7.json().get('scope-map', [])
    print(f"   Found {len(maps)} scope maps for HomeLab")

    # Check for our WLAN
    our_maps = [m for m in maps if wlan_name in m.get('resource', '')]
    if our_maps:
        print(f"   ✅ Found scope map for {wlan_name}:")
        for m in our_maps:
            print(f"      {m}")
    else:
        print(f"   ❌ No scope map found for {wlan_name}")

print("\n" + "=" * 80)
