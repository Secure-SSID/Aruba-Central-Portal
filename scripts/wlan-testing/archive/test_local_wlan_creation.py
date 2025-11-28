#!/usr/bin/env python3
"""Test creating a WLAN with object_type=LOCAL to automatically assign to scope"""

import json
import requests

# Load cached token
with open('/home/choate/aruba-central-portal-v2/aruba-central-portal/dashboard/backend/.token_cache_central.json', 'r') as f:
    token_data = json.load(f)
    access_token = token_data['access_token']

print("=" * 80)
print("Testing LOCAL WLAN Creation (auto-assigned to scope)")
print("=" * 80)

base_url = "https://internal.api.central.arubanetworks.com"
headers = {
    "Authorization": f"Bearer {access_token}",
    "Content-Type": "application/json"
}

wlan_name = "test-local-wlan"
scope_id = "54819475093"
persona = "CAMPUS_AP"

# First, create the default role
print(f"\nStep 1: Creating role {wlan_name}-default...")
role_data = {
    'name': f'{wlan_name}-default',
    'description': f'Default role for {wlan_name}',
    'vlan-parameters': {
        'access-vlan': 1
    },
    'qos-parameters': {
        'cos': 0
    }
}

role_url = f"{base_url}/network-config/v1alpha1/roles/{wlan_name}-default"
role_params = {'object_type': 'LOCAL', 'scope_id': scope_id, 'persona': persona}

role_response = requests.post(role_url, headers=headers, json=role_data, params=role_params)
print(f"Role Status: {role_response.status_code}")
if role_response.status_code not in [200, 409]:
    print(f"Error: {role_response.text[:500]}")

# Now create the WLAN with LOCAL scope assignment
print(f"\nStep 2: Creating WLAN '{wlan_name}' with object_type=LOCAL...")
wlan_data = {
    'enable': True,
    'dot11k': True,
    'dot11r': True,
    'dot11v': True,
    'high-efficiency': {'enable': True},
    'max-clients-threshold': 64,
    'inactivity-timeout': 1000,
    'personal-security': {
        'passphrase-format': 'STRING',
        'wpa-passphrase': 'Aruba123!',
    },
    'ssid': wlan_name,
    'description': f'WLAN {wlan_name}',
    'opmode': 'WPA2_PERSONAL',
    'forward-mode': 'FORWARD_MODE_BRIDGE',
    'essid': {'name': wlan_name},
    'vlan-selector': 'VLAN_RANGES',
    'vlan-id-range': ['1'],
    'default-role': f'{wlan_name}-default',
}

wlan_url = f"{base_url}/network-config/v1alpha1/wlan-ssids/{wlan_name}"
wlan_params = {'object_type': 'LOCAL', 'scope_id': scope_id, 'persona': persona}

print(f"URL: {wlan_url}")
print(f"Params: {wlan_params}")

wlan_response = requests.post(wlan_url, headers=headers, json=wlan_data, params=wlan_params)
print(f"\nWLAN Status: {wlan_response.status_code}")
print(f"Response: {wlan_response.text[:500]}")

if wlan_response.status_code == 200:
    print("\n✅ SUCCESS! WLAN created with LOCAL scope assignment!")

    # Check if it appears in monitoring API
    print(f"\nStep 3: Checking monitoring API...")
    mon_url = f"{base_url}/network-monitoring/v1alpha1/wlans"
    mon_response = requests.get(mon_url, headers=headers)

    if mon_response.status_code == 200:
        wlans = mon_response.json().get('data', [])
        matching = [w for w in wlans if w.get('name') == wlan_name or w.get('ssid') == wlan_name]
        if matching:
            print(f"✅ WLAN appears in monitoring API!")
            print(json.dumps(matching[0], indent=2)[:500])
        else:
            print(f"⚠️  WLAN not yet in monitoring API (might take time to propagate)")

    # Check scope maps
    print(f"\nStep 4: Checking scope maps...")
    scope_url = f"{base_url}/network-config/v1alpha1/scope-maps"
    scope_params = {'scope_id': scope_id, 'limit': 50}
    scope_response = requests.get(scope_url, headers=headers, params=scope_params)

    if scope_response.status_code == 200:
        maps = scope_response.json().get('data', [])
        print(f"Found {len(maps)} scope maps for this scope")
        wlan_maps = [m for m in maps if 'wlan' in str(m).lower()]
        if wlan_maps:
            print(f"WLAN-related scope maps:")
            for m in wlan_maps:
                print(json.dumps(m, indent=2)[:300])
        else:
            print("No WLAN-related scope maps found")
            if len(maps) > 0:
                print(f"Sample scope map: {json.dumps(maps[0], indent=2)[:300]}")
elif wlan_response.status_code == 409:
    print("\n⚠️  WLAN already exists")
else:
    print("\n❌ FAILED")

print("\n" + "=" * 80)
