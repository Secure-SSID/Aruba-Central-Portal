#!/usr/bin/env python3
"""Clean up test WPA3 WLANs"""

import requests
import json

# Load cached token
with open('/home/choate/aruba-central-portal-v2/aruba-central-portal/dashboard/backend/.token_cache_central.json', 'r') as f:
    token_data = json.load(f)
    access_token = token_data['access_token']

base_url = "https://internal.api.central.arubanetworks.com/network-config/v1alpha1"
headers = {
    "Authorization": f"Bearer {access_token}",
    "Content-Type": "application/json"
}

test_wlans = ['TestWPA3', 'TestWPA3Broken']

print("Cleaning up test WPA3 WLANs...")
for wlan_name in test_wlans:
    print(f"\nDeleting {wlan_name}...")

    # Delete WLAN
    response = requests.delete(
        f"{base_url}/wlan-ssids/{wlan_name}",
        headers=headers,
        params={'object_type': 'SHARED'}
    )
    print(f"  WLAN: {response.status_code}")

    # Delete role
    response2 = requests.delete(
        f"{base_url}/roles/{wlan_name}",
        headers=headers,
        params={'object_type': 'SHARED'}
    )
    print(f"  Role: {response2.status_code}")

print("\nDone!")
