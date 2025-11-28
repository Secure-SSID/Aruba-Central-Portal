#!/usr/bin/env python3
"""Inspect existing scope maps to understand their structure"""

import json
import requests

# Load cached token
with open('/home/choate/aruba-central-portal-v2/aruba-central-portal/dashboard/backend/.token_cache_central.json', 'r') as f:
    token_data = json.load(f)
    access_token = token_data['access_token']

print("=" * 80)
print("Inspecting Existing Scope Maps")
print("=" * 80)

base_url = "https://internal.api.central.arubanetworks.com/network-config/v1alpha1"
headers = {
    "Authorization": f"Bearer {access_token}",
    "Content-Type": "application/json"
}

scope_id = "54819475093"

# Get scope maps for HomeLab
response = requests.get(f"{base_url}/scope-maps", headers=headers, params={'scope_id': scope_id})

if response.status_code == 200:
    all_maps = response.json().get('scope-map', [])
    print(f"\nFound {len(all_maps)} scope maps for HomeLab (scope_id: {scope_id})")

    # Filter for wlan-related maps
    wlan_maps = [m for m in all_maps if 'wlan' in m.get('resource', '').lower()]
    role_maps = [m for m in all_maps if 'role' in m.get('resource', '').lower()]

    print(f"\nWLAN-related scope maps: {len(wlan_maps)}")
    for m in wlan_maps[:5]:  # Show first 5
        print(f"  {json.dumps(m, indent=2)}")

    print(f"\nRole-related scope maps: {len(role_maps)}")
    for m in role_maps[:5]:  # Show first 5
        print(f"  {json.dumps(m, indent=2)}")

    # Look at the Frontendtest WLAN user just created
    print(f"\n" + "=" * 80)
    print("Looking for 'Frontendtest' WLAN scope maps...")
    print("=" * 80)

    frontendtest_maps = [m for m in all_maps if 'Frontendtest' in m.get('resource', '') or 'frontendtest' in m.get('resource', '').lower()]
    if frontendtest_maps:
        print(f"\nFound {len(frontendtest_maps)} scope maps for Frontendtest:")
        for m in frontendtest_maps:
            print(f"  {json.dumps(m, indent=2)}")
    else:
        print(f"\n❌ No scope maps found for Frontendtest")

        # Check if Frontendtest WLAN exists
        print(f"\nChecking if Frontendtest WLAN exists...")
        response2 = requests.get(f"{base_url}/wlan-ssids/Frontendtest", headers=headers, params={'object_type': 'SHARED'})
        print(f"  SHARED: {response2.status_code}")

        response3 = requests.get(f"{base_url}/wlan-ssids/Frontendtest", headers=headers, params={'scope_id': scope_id, 'persona': 'CAMPUS_AP'})
        print(f"  LOCAL: {response3.status_code}")

        # Try without any params
        response4 = requests.get(f"{base_url}/wlan-ssids/Frontendtest", headers=headers)
        print(f"  No params: {response4.status_code}")
        if response4.status_code == 200:
            print(f"  WLAN data: {json.dumps(response4.json(), indent=2)[:500]}")

else:
    print(f"Error getting scope maps: {response.status_code}")
    print(response.text[:500])

print("\n" + "=" * 80)
