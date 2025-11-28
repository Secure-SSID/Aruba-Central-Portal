#!/usr/bin/env python3
"""Test scope map creation using cached token"""

import json
import requests

# Load cached token
with open('/home/choate/aruba-central-portal-v2/aruba-central-portal/dashboard/backend/.token_cache_central.json', 'r') as f:
    token_data = json.load(f)
    access_token = token_data['access_token']

print("=" * 80)
print("Testing Scope Map API Call with Cached Token")
print("=" * 80)

base_url = "https://internal.api.central.arubanetworks.com"
headers = {
    "Authorization": f"Bearer {access_token}",
    "Content-Type": "application/json"
}

# Test parameters
wlan_name = "test-scope-api"
scope_name = "HomeLab"
scope_id = "54819475093"
persona = "CAMPUS_AP"
resource = f"wlan-ssids/{wlan_name}"

# First, create a test WLAN
print(f"\nStep 1: Creating test WLAN '{wlan_name}'...")
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
    'default-role': 'logread',
}

response = requests.post(
    f"{base_url}/network-config/v1alpha1/wlan-ssids/{wlan_name}",
    headers=headers,
    json=wlan_data
)

if response.status_code == 200:
    print(f"✅ WLAN created")
elif "already exists" in response.text:
    print(f"⚠️  WLAN already exists (will use it)")
else:
    print(f"❌ Failed to create WLAN: {response.status_code}")
    print(f"   Response: {response.text}")

# Now test scope map with different variations
print(f"\n" + "=" * 80)
print("TEST 1: Scope NAME in URL + persona in query params")
print("=" * 80)
url1 = f"{base_url}/network-config/v1alpha1/scope-maps/{scope_name}/{persona}/{resource}"
params1 = {
    'object_type': 'LOCAL',
    'scope_id': scope_id,
    'persona': persona
}
body1 = {}

print(f"URL: {url1}")
print(f"Params: {params1}")
print(f"Body: {body1}")

response1 = requests.post(url1, headers=headers, json=body1, params=params1)
print(f"\nStatus: {response1.status_code}")
print(f"Response: {response1.text[:500]}")

if response1.status_code == 200:
    print("\n🎉 ✅ SUCCESS! This is the correct format!")
else:
    print("\n❌ FAILED")

    # Try without persona in params
    print(f"\n" + "=" * 80)
    print("TEST 2: Scope NAME in URL WITHOUT persona in query params")
    print("=" * 80)
    params2 = {
        'object_type': 'LOCAL',
        'scope_id': scope_id
    }
    print(f"URL: {url1}")
    print(f"Params: {params2}")
    print(f"Body: {body1}")

    response2 = requests.post(url1, headers=headers, json=body1, params=params2)
    print(f"\nStatus: {response2.status_code}")
    print(f"Response: {response2.text[:500]}")

    if response2.status_code == 200:
        print("\n🎉 ✅ SUCCESS! Persona NOT needed in query params!")
    else:
        print("\n❌ FAILED")

        # Try with unencoded path
        print(f"\n" + "=" * 80)
        print("TEST 3: Unencoded resource path (/  instead of ~2F)")
        print("=" * 80)
        url3 = f"{base_url}/network-config/v1alpha1/scope-maps/{scope_name}/{persona}/wlan-ssids/{wlan_name}"
        params3 = {
            'object_type': 'LOCAL',
            'scope_id': scope_id,
            'persona': persona
        }
        print(f"URL: {url3}")
        print(f"Params: {params3}")
        print(f"Body: {body1}")

        response3 = requests.post(url3, headers=headers, json=body1, params=params3)
        print(f"\nStatus: {response3.status_code}")
        print(f"Response: {response3.text[:500]}")

        if response3.status_code == 200:
            print("\n🎉 ✅ SUCCESS! Unencoded path works!")
        else:
            print("\n❌ FAILED")

print("\n" + "=" * 80)
