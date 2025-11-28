#!/usr/bin/env python3
"""Check a working WLAN to see what fields it has"""

import json
import requests

# Load cached token
with open('/home/choate/aruba-central-portal-v2/aruba-central-portal/dashboard/backend/.token_cache_central.json', 'r') as f:
    token_data = json.load(f)
    access_token = token_data['access_token']

print("=" * 80)
print("Checking Working WLANs")
print("=" * 80)

base_url = "https://internal.api.central.arubanetworks.com/network-config/v1alpha1"
headers = {
    "Authorization": f"Bearer {access_token}",
    "Content-Type": "application/json"
}

scope_id = "54819475093"
persona = "CAMPUS_AP"

# Get WLANs that are assigned to HomeLab scope (working ones)
print(f"\n1. Getting scope maps for HomeLab...")
response = requests.get(f"{base_url}/scope-maps", headers=headers, params={'scope_id': scope_id})

if response.status_code == 200:
    maps = response.json().get('scope-map', [])
    wlan_maps = [m for m in maps if 'wlan-ssids' in m.get('resource', '')]

    if wlan_maps:
        print(f"   Found {len(wlan_maps)} WLANs assigned to HomeLab")

        # Get the first working WLAN
        for wlan_map in wlan_maps[:1]:
            wlan_name = wlan_map['resource'].replace('wlan-ssids/', '')
            print(f"\n2. Checking WLAN '{wlan_name}'...")

            response2 = requests.get(
                f"{base_url}/wlan-ssids/{wlan_name}",
                headers=headers,
                params={'scope_id': scope_id, 'persona': persona}
            )

            if response2.status_code == 200:
                wlan_config = response2.json()
                print(f"   ✅ WLAN config:")
                print(json.dumps(wlan_config, indent=2))
            else:
                print(f"   Status: {response2.status_code}")
    else:
        print(f"   No WLANs assigned to HomeLab")
else:
    print(f"Error: {response.status_code}")

print("\n" + "=" * 80)
