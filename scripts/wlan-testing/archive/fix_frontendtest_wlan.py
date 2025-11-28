#!/usr/bin/env python3
"""Fix Frontendtest WLAN by adding missing required fields"""

import json
import requests

# Load cached token
with open('/home/choate/aruba-central-portal-v2/aruba-central-portal/dashboard/backend/.token_cache_central.json', 'r') as f:
    token_data = json.load(f)
    access_token = token_data['access_token']

print("=" * 80)
print("Fixing Frontendtest WLAN")
print("=" * 80)

base_url = "https://internal.api.central.arubanetworks.com/network-config/v1alpha1"
headers = {
    "Authorization": f"Bearer {access_token}",
    "Content-Type": "application/json"
}

wlan_name = "Frontendtest"

# Get current WLAN config
print(f"\n1. Reading current Frontendtest WLAN config...")
response = requests.get(f"{base_url}/wlan-ssids/{wlan_name}", headers=headers, params={'object_type': 'SHARED'})
print(f"   Status: {response.status_code}")

if response.status_code == 200:
    current_config = response.json()
    print(f"   ✅ WLAN found")

    # Add missing required fields
    updated_config = {
        **current_config,
        'dtim-period': 1,
        'broadcast-filter': 'arp',
        'dmo-channel-utilization-threshold': 90,
    }

    print(f"\n2. Updating WLAN with required fields...")
    print(f"   Adding: dtim-period=1, broadcast-filter=arp, dmo-channel-utilization-threshold=90")

    # Update the WLAN
    response2 = requests.put(
        f"{base_url}/wlan-ssids/{wlan_name}",
        headers=headers,
        json=updated_config,
        params={'object_type': 'SHARED'}
    )
    print(f"   Status: {response2.status_code}")

    if response2.status_code == 200:
        print(f"   ✅ WLAN updated successfully!")
    else:
        print(f"   Error: {response2.text[:500]}")

        # Try PATCH instead
        print(f"\n3. Trying PATCH method...")
        patch_data = {
            'dtim-period': 1,
            'broadcast-filter': 'arp',
            'dmo-channel-utilization-threshold': 90,
        }
        response3 = requests.patch(
            f"{base_url}/wlan-ssids/{wlan_name}",
            headers=headers,
            json=patch_data,
            params={'object_type': 'SHARED'}
        )
        print(f"   Status: {response3.status_code}")
        if response3.status_code == 200:
            print(f"   ✅ WLAN patched successfully!")
        else:
            print(f"   Error: {response3.text[:500]}")
else:
    print(f"   ❌ WLAN not found")
    print(f"   {response.text[:500]}")

print("\n" + "=" * 80)
