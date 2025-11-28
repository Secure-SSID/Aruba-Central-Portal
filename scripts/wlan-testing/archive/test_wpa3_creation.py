#!/usr/bin/env python3
"""Test creating a WPA3-Personal WLAN via Aruba Central API"""

import json
import requests

# Load cached token
with open('/home/choate/aruba-central-portal-v2/aruba-central-portal/dashboard/backend/.token_cache_central.json', 'r') as f:
    token_data = json.load(f)
    access_token = token_data['access_token']

print("=" * 80)
print("Testing WPA3-Personal WLAN Creation")
print("=" * 80)

base_url = "https://internal.api.central.arubanetworks.com/network-config/v1alpha1"
headers = {
    "Authorization": f"Bearer {access_token}",
    "Content-Type": "application/json"
}

wlan_name = "TestWPA3"
scope_id = "54819475093"
persona = "CAMPUS_AP"

# WPA3-Personal WLAN configuration (matching what wizard should send)
wlan_data = {
    "ssid": wlan_name,
    "description": f"WLAN {wlan_name}",
    "enable": True,
    "opmode": "WPA3_SAE",  # WPA3-Personal opmode
    "forward-mode": "FORWARD_MODE_BRIDGE",
    "essid": {
        "name": wlan_name
    },
    "dot11k": True,
    "dot11r": True,
    "high-efficiency": {
        "enable": True
    },
    "max-clients-threshold": 64,
    "inactivity-timeout": 1000,
    "dtim-period": 1,
    "broadcast-filter-ipv4": "BCAST_FILTER_ARP",
    "broadcast-filter-ipv6": "UCAST_FILTER_RA",
    "dmo": {
        "enable": True,
        "channel-utilization-threshold": 90,
        "clients-threshold": 6
    },
    "vlan-selector": "VLAN_RANGES",
    "vlan-id-range": ["1"],
    # CRITICAL: personal-security with passphrase for WPA3
    "personal-security": {
        "passphrase-format": "STRING",
        "wpa-passphrase": "TestPassword123"
    }
    # NO default-role - uses system default
}

print(f"\n1. Creating WPA3-Personal WLAN '{wlan_name}'...")
print(f"   Config: {json.dumps(wlan_data, indent=2)[:500]}...")

response = requests.post(
    f"{base_url}/wlan-ssids/{wlan_name}",
    headers=headers,
    json=wlan_data,
    params={'object_type': 'SHARED'}
)

print(f"\n   Status: {response.status_code}")
if response.status_code == 200:
    print(f"   ✅ WLAN created successfully!")

    # Check if system created the role
    print(f"\n2. Checking if system auto-created role '{wlan_name}'...")
    role_response = requests.get(
        f"{base_url}/roles/{wlan_name}",
        headers=headers,
        params={'object_type': 'SHARED'}
    )
    print(f"   Role status: {role_response.status_code}")
    if role_response.status_code == 200:
        role_data = role_response.json()
        has_data = len(role_data) > 0
        print(f"   ✅ Role exists (has data: {has_data})")

    # Assign to scope
    print(f"\n3. Assigning WLAN to HomeLab scope...")
    scope_map_data = {
        "scope-map": [{
            "scope-name": str(scope_id),
            "scope-id": int(scope_id),
            "persona": persona,
            "resource": f"wlan-ssids/{wlan_name}"
        }]
    }

    scope_response = requests.post(
        f"{base_url}/scope-maps",
        headers=headers,
        json=scope_map_data
    )
    print(f"   Status: {scope_response.status_code}")
    if scope_response.status_code == 200:
        print(f"   ✅ Scope assignment successful!")
    else:
        print(f"   Error: {scope_response.text[:300]}")

    print(f"\n" + "=" * 80)
    print("SUCCESS! WPA3-Personal WLAN created and assigned to scope")
    print("=" * 80)

else:
    print(f"   ❌ WLAN creation failed!")
    print(f"\n   Error Response:")
    print(f"   {response.text}")

    print(f"\n" + "=" * 80)
    print("FAILURE - Check error details above")
    print("=" * 80)
