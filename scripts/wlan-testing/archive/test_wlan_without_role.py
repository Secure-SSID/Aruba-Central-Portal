#!/usr/bin/env python3
"""Test creating WLAN without creating a role first"""

import json
import requests

# Load cached token
with open('/home/choate/aruba-central-portal-v2/aruba-central-portal/dashboard/backend/.token_cache_central.json', 'r') as f:
    token_data = json.load(f)
    access_token = token_data['access_token']

print("=" * 80)
print("Testing WLAN Creation Without Role")
print("=" * 80)

base_url = "https://internal.api.central.arubanetworks.com/network-config/v1alpha1"
headers = {
    "Authorization": f"Bearer {access_token}",
    "Content-Type": "application/json"
}

wlan_name = "NoRoleTest"
role_name = f"{wlan_name}-default"

# Test 1: Create WLAN that references a role that doesn't exist
print(f"\n1. Creating WLAN '{wlan_name}' with default-role that doesn't exist...")
wlan_data_with_role = {
    'enable': True,
    'dot11k': True,
    'personal-security': {
        'passphrase-format': 'STRING',
        'wpa-passphrase': 'Aruba123!',
    },
    'ssid': wlan_name,
    'description': f'Test WLAN without pre-created role',
    'opmode': 'WPA2_PERSONAL',
    'forward-mode': 'FORWARD_MODE_BRIDGE',
    'essid': {
        'name': wlan_name
    },
    'vlan-selector': 'VLAN_RANGES',
    'vlan-id-range': ['1'],
    'default-role': role_name,  # Role doesn't exist yet
}

url1 = f"{base_url}/wlan-ssids/{wlan_name}"
response1 = requests.post(url1, headers=headers, json=wlan_data_with_role, params={'object_type': 'SHARED'})
print(f"   Status: {response1.status_code}")
if response1.status_code == 200:
    print(f"   ✅ WLAN created successfully (role may be auto-created)")
else:
    print(f"   Error: {response1.text[:500]}")

# Check if role was auto-created
print(f"\n2. Checking if role '{role_name}' was auto-created...")
response2 = requests.get(f"{base_url}/roles/{role_name}", headers=headers, params={'object_type': 'SHARED'})
print(f"   Status: {response2.status_code}")
if response2.status_code == 200:
    role_data = response2.json()
    print(f"   ✅ Role exists!")
    print(f"   Name: {role_data.get('name', 'N/A')}")
    print(f"   VLAN: {role_data.get('vlan-parameters', {}).get('access-vlan', 'N/A')}")
    if len(role_data) > 0:
        print(f"   Has data: YES")
    else:
        print(f"   Has data: NO (empty)")
else:
    print(f"   Role does not exist")

# Test 2: Create WLAN without default-role field at all
wlan_name2 = "NoRoleField"
print(f"\n3. Creating WLAN '{wlan_name2}' WITHOUT default-role field...")
wlan_data_no_role = {
    'enable': True,
    'dot11k': True,
    'personal-security': {
        'passphrase-format': 'STRING',
        'wpa-passphrase': 'Aruba123!',
    },
    'ssid': wlan_name2,
    'description': f'Test WLAN without default-role field',
    'opmode': 'WPA2_PERSONAL',
    'forward-mode': 'FORWARD_MODE_BRIDGE',
    'essid': {
        'name': wlan_name2
    },
    'vlan-selector': 'VLAN_RANGES',
    'vlan-id-range': ['1'],
    # NO default-role field
}

url2 = f"{base_url}/wlan-ssids/{wlan_name2}"
response3 = requests.post(url2, headers=headers, json=wlan_data_no_role, params={'object_type': 'SHARED'})
print(f"   Status: {response3.status_code}")
if response3.status_code == 200:
    print(f"   ✅ WLAN created successfully without role")

    # Read it back to see if it has a role assigned
    response4 = requests.get(url2, headers=headers, params={'object_type': 'SHARED'})
    if response4.status_code == 200:
        wlan_check = response4.json()
        print(f"   Default role in config: {wlan_check.get('default-role', 'NONE')}")
else:
    print(f"   Error: {response3.text[:500]}")

# Test 3: Try to create a scope map for the WLAN using the correct resource format
print(f"\n4. Trying to create scope map with correct resource format...")
scope_id = "54819475093"
persona = "CAMPUS_AP"

# Based on the scope-map data structure, resource should be "wlan-ssids/WlanName"
resource = f"wlan-ssids/{wlan_name}"

# Try POST to create scope map
scope_map_url = f"{base_url}/scope-maps/{scope_id}/{persona}/{resource}"
print(f"   URL: {scope_map_url}")
response5 = requests.post(scope_map_url, headers=headers, json={})
print(f"   Status: {response5.status_code}")
if response5.status_code == 200:
    print(f"   ✅ Scope map created!")
else:
    print(f"   Error: {response5.text[:500]}")

# Try without encoding the slash
scope_map_url2 = f"{base_url}/scope-maps/{scope_id}/{persona}/wlan-ssids/{wlan_name}"
print(f"\n   URL (unencoded): {scope_map_url2}")
response6 = requests.post(scope_map_url2, headers=headers, json={})
print(f"   Status: {response6.status_code}")
if response6.status_code == 200:
    print(f"   ✅ Scope map created!")
else:
    print(f"   Error: {response6.text[:200]}")

print("\n" + "=" * 80)
print("CONCLUSION")
print("=" * 80)
print("\nChecking:")
print("1. Can WLAN be created with non-existent role?")
print("2. Does the system auto-create the role?")
print("3. Can WLAN work without a role at all?")
print("4. What's the correct scope map POST format?")
print("=" * 80)
