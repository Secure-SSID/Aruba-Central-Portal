#!/usr/bin/env python3
"""Check existing WLANs and their role configuration"""

import json
import requests

# Load cached token
with open('/home/choate/aruba-central-portal-v2/aruba-central-portal/dashboard/backend/.token_cache_central.json', 'r') as f:
    token_data = json.load(f)
    access_token = token_data['access_token']

print("=" * 80)
print("Checking Existing WLANs in Library")
print("=" * 80)

base_url = "https://internal.api.central.arubanetworks.com/network-config/v1alpha1"
headers = {
    "Authorization": f"Bearer {access_token}",
    "Content-Type": "application/json"
}

# Get all WLANs in Library (SHARED)
print(f"\nFetching all WLANs in Library (SHARED)...")
response = requests.get(f"{base_url}/wlan-ssids", headers=headers, params={'object_type': 'SHARED'})
print(f"Status: {response.status_code}")

if response.status_code == 200:
    wlans = response.json().get('data', [])
    print(f"\nFound {len(wlans)} WLANs in Library")

    for wlan in wlans:
        ssid = wlan.get('ssid', 'N/A')
        name = wlan.get('name', ssid)
        default_role = wlan.get('default-role', 'NONE')
        enabled = wlan.get('enable', 'N/A')
        opmode = wlan.get('opmode', 'N/A')

        print(f"\n  WLAN: {ssid}")
        print(f"    Name: {name}")
        print(f"    Default Role: {default_role}")
        print(f"    Enabled: {enabled}")
        print(f"    OpMode: {opmode}")

        # If it has a default-role, check if that role exists
        if default_role and default_role != 'NONE':
            role_response = requests.get(
                f"{base_url}/roles/{default_role}",
                headers=headers,
                params={'object_type': 'SHARED'}
            )
            if role_response.status_code == 200:
                role_data = role_response.json()
                vlan = role_data.get('vlan-parameters', {}).get('access-vlan', 'N/A')
                print(f"    Role exists: YES (VLAN: {vlan})")
                if len(role_data) == 0:
                    print(f"    ⚠️  Role is empty (no config data)")
            else:
                print(f"    Role exists: NO")

# Check WLANs for HomeLab scope specifically
print(f"\n" + "=" * 80)
print(f"Checking WLANs for HomeLab scope (LOCAL)")
print("=" * 80)

scope_id = "54819475093"
persona = "CAMPUS_AP"

response2 = requests.get(
    f"{base_url}/wlan-ssids",
    headers=headers,
    params={'object_type': 'LOCAL', 'scope_id': scope_id, 'persona': persona}
)

print(f"\nStatus: {response2.status_code}")
if response2.status_code == 200:
    local_wlans = response2.json().get('data', [])
    print(f"Found {len(local_wlans)} LOCAL WLANs for HomeLab scope")

    for wlan in local_wlans:
        ssid = wlan.get('ssid', 'N/A')
        name = wlan.get('name', ssid)
        default_role = wlan.get('default-role', 'NONE')

        print(f"\n  WLAN: {ssid}")
        print(f"    Name: {name}")
        print(f"    Default Role: {default_role}")

# Check all roles in Library
print(f"\n" + "=" * 80)
print(f"Checking Roles in Library")
print("=" * 80)

response3 = requests.get(f"{base_url}/roles", headers=headers, params={'object_type': 'SHARED'})
if response3.status_code == 200:
    roles = response3.json().get('data', [])
    print(f"\nFound {len(roles)} roles in Library")

    for role in roles[:10]:  # Show first 10
        name = role.get('name', 'N/A')
        vlan = role.get('vlan-parameters', {}).get('access-vlan', 'N/A')
        print(f"  - {name} (VLAN: {vlan})")

print("\n" + "=" * 80)
