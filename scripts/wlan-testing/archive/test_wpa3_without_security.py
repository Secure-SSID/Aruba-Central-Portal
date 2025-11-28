#!/usr/bin/env python3
"""Test WPA3 WLAN creation WITHOUT personal-security (should fail)"""

import json
import requests

# Load cached token
with open('/home/choate/aruba-central-portal-v2/aruba-central-portal/dashboard/backend/.token_cache_central.json', 'r') as f:
    token_data = json.load(f)
    access_token = token_data['access_token']

print("=" * 80)
print("Testing WPA3 WITHOUT personal-security (demonstrating the bug)")
print("=" * 80)

base_url = "https://internal.api.central.arubanetworks.com/network-config/v1alpha1"
headers = {
    "Authorization": f"Bearer {access_token}",
    "Content-Type": "application/json"
}

wlan_name = "TestWPA3Broken"

# BROKEN: WPA3 config WITHOUT personal-security (what old wizard was sending)
broken_config = {
    "ssid": wlan_name,
    "description": f"WLAN {wlan_name}",
    "enable": True,
    "opmode": "WPA3_SAE",
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
    "vlan-id-range": ["1"]
    # MISSING: personal-security - THIS IS THE BUG!
}

print(f"\nAttempting to create WPA3 WLAN WITHOUT personal-security...")
print(f"This demonstrates what the old wizard was doing (before the fix)")

response = requests.post(
    f"{base_url}/wlan-ssids/{wlan_name}",
    headers=headers,
    json=broken_config,
    params={'object_type': 'SHARED'}
)

print(f"\nStatus: {response.status_code}")
if response.status_code == 200:
    print(f"   Unexpected success (API may have changed)")
else:
    print(f"   ❌ Failed as expected!")
    print(f"\nError Response:")
    print(f"{response.text}")

print("\n" + "=" * 80)
print("CONCLUSION:")
print("=" * 80)
print("WPA3-Personal requires 'personal-security' field with 'wpa-passphrase'")
print("The old wizard code was missing WPA3-Personal from the condition,")
print("so it never added personal-security, causing this 400 error.")
print("=" * 80)
