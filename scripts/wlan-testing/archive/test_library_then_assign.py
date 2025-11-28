#!/usr/bin/env python3
"""Test creating resources in Library (SHARED) then assigning to device function and scope

Workflow:
1. Create role in Library (SHARED)
2. Create WLAN in Library (SHARED)
3. Assign role to device function (persona)
4. Assign role to device scope (site)
5. Assign WLAN to device function (persona)
6. Assign WLAN to device scope (site)
"""

import json
import requests

# Load cached token
with open('/home/choate/aruba-central-portal-v2/aruba-central-portal/dashboard/backend/.token_cache_central.json', 'r') as f:
    token_data = json.load(f)
    access_token = token_data['access_token']

print("=" * 80)
print("Testing Library → Device Function → Device Scope Workflow")
print("=" * 80)

base_url = "https://internal.api.central.arubanetworks.com/network-config/v1alpha1"
headers = {
    "Authorization": f"Bearer {access_token}",
    "Content-Type": "application/json"
}

wlan_name = "LibraryTest"
role_name = f"{wlan_name}-default"
scope_id = "54819475093"
scope_name = "HomeLab"
persona = "CAMPUS_AP"

# Step 1: Create role-gpid in Library (SHARED)
print(f"\n1. Creating role-gpid '{role_name}' in Library (SHARED)...")
role_gpid_data = {
    'name': role_name,
    'description': f'Role-gpid for {wlan_name}',
}

url1 = f"{base_url}/role-gpids/{role_name}"
response1 = requests.post(url1, headers=headers, json=role_gpid_data, params={'object_type': 'SHARED'})
print(f"   Status: {response1.status_code}")
if response1.status_code != 200:
    print(f"   Error: {response1.text[:500]}")
else:
    print(f"   ✅ Role-gpid created in Library")

# Step 2: Create role in Library (SHARED)
print(f"\n2. Creating role '{role_name}' in Library (SHARED)...")
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
response2 = requests.post(url2, headers=headers, json=role_data, params={'object_type': 'SHARED'})
print(f"   Status: {response2.status_code}")
if response2.status_code != 200:
    print(f"   Error: {response2.text[:500]}")
else:
    print(f"   ✅ Role created in Library")

# Step 3: Create WLAN in Library (SHARED)
print(f"\n3. Creating WLAN '{wlan_name}' in Library (SHARED)...")
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
response3 = requests.post(url3, headers=headers, json=wlan_data, params={'object_type': 'SHARED'})
print(f"   Status: {response3.status_code}")
if response3.status_code != 200:
    print(f"   Error: {response3.text[:500]}")
else:
    print(f"   ✅ WLAN created in Library")

print("\n" + "=" * 80)
print("Now trying to assign to device function and scope...")
print("=" * 80)

# Step 4: Try to assign role to device function (persona)
print(f"\n4. Assigning role to device function '{persona}'...")

# Try different possible endpoints for device function assignment
endpoints_to_try = [
    # Maybe there's a device-functions endpoint?
    f"{base_url}/device-functions/{persona}/roles/{role_name}",
    # Or maybe assignments endpoint?
    f"{base_url}/assignments/device-functions/{persona}/roles/{role_name}",
    # Or maybe scope-maps with just persona?
    f"{base_url}/scope-maps/device-function/{persona}/roles/{role_name}",
]

for idx, endpoint in enumerate(endpoints_to_try, 1):
    print(f"\n   4.{idx}. Trying: {endpoint}")
    response = requests.post(endpoint, headers=headers, json={})
    print(f"        Status: {response.status_code}")
    if response.status_code == 200:
        print(f"        ✅ Success!")
        break
    else:
        print(f"        Error: {response.text[:200]}")

# Step 5: Try scope assignment with different URL patterns
print(f"\n5. Assigning role to scope '{scope_name}' (ID: {scope_id})...")

# Try different scope assignment patterns
scope_endpoints = [
    # Using scope name
    (f"{base_url}/scope-maps/{scope_name}/{persona}/roles~2F{role_name}", "scope name with ~2F"),
    # Using scope ID
    (f"{base_url}/scope-maps/{scope_id}/{persona}/roles~2F{role_name}", "scope ID with ~2F"),
    # Without persona in URL (in body instead?)
    (f"{base_url}/scope-maps/{scope_name}/roles~2F{role_name}", "scope name, persona in body"),
    # Assignments endpoint
    (f"{base_url}/assignments/scopes/{scope_id}/roles/{role_name}", "assignments endpoint"),
    # Scope-assignments endpoint
    (f"{base_url}/scope-assignments", "scope-assignments POST with body"),
]

for idx, (endpoint, description) in enumerate(scope_endpoints, 1):
    print(f"\n   5.{idx}. Trying: {description}")
    print(f"        URL: {endpoint}")

    if "body" in description:
        # Try with persona in request body
        body = {'persona': persona, 'scope_id': scope_id}
        response = requests.post(endpoint, headers=headers, json=body)
    else:
        response = requests.post(endpoint, headers=headers, json={})

    print(f"        Status: {response.status_code}")
    if response.status_code == 200:
        print(f"        ✅ Success!")
        break
    else:
        print(f"        Error: {response.text[:200]}")

# Step 6: Do the same for WLAN
print(f"\n6. Assigning WLAN to device function and scope...")

wlan_endpoints = [
    (f"{base_url}/scope-maps/{scope_name}/{persona}/wlan-ssids~2F{wlan_name}", "scope name with ~2F"),
    (f"{base_url}/scope-maps/{scope_id}/{persona}/wlan-ssids~2F{wlan_name}", "scope ID with ~2F"),
    (f"{base_url}/assignments/scopes/{scope_id}/wlan-ssids/{wlan_name}", "assignments endpoint"),
]

for idx, (endpoint, description) in enumerate(wlan_endpoints, 1):
    print(f"\n   6.{idx}. Trying: {description}")
    print(f"        URL: {endpoint}")
    response = requests.post(endpoint, headers=headers, json={})
    print(f"        Status: {response.status_code}")
    if response.status_code == 200:
        print(f"        ✅ Success!")
        break
    else:
        print(f"        Error: {response.text[:200]}")

print("\n" + "=" * 80)
print("VERIFICATION")
print("=" * 80)

# Verify the WLAN was created properly in Library
print(f"\nReading WLAN '{wlan_name}' from Library...")
response = requests.get(f"{base_url}/wlan-ssids/{wlan_name}", headers=headers, params={'object_type': 'SHARED'})
print(f"Status: {response.status_code}")
if response.status_code == 200:
    wlan_read = response.json()
    print(f"SSID: {wlan_read.get('ssid', 'N/A')}")
    print(f"Enabled: {wlan_read.get('enable', 'N/A')}")
    print(f"Password configured: {'personal-security' in wlan_read}")
    if len(wlan_read) > 0:
        print(f"✅ WLAN has proper configuration in Library")
    else:
        print(f"❌ WLAN is empty")

print("\n" + "=" * 80)
