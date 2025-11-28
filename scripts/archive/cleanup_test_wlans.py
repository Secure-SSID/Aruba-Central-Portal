#!/usr/bin/env python3
"""Clean up test WLANs"""

import json
import requests

# Load cached token
with open('/home/choate/aruba-central-portal-v2/aruba-central-portal/dashboard/backend/.token_cache_central.json', 'r') as f:
    token_data = json.load(f)
    access_token = token_data['access_token']

print("Cleaning up test WLANs...")

base_url = "https://internal.api.central.arubanetworks.com/network-config/v1alpha1"
headers = {
    "Authorization": f"Bearer {access_token}",
    "Content-Type": "application/json"
}

test_wlans = ['NoRoleTest', 'NoRoleField', 'LibraryTest', 'TestSequence']

for wlan_name in test_wlans:
    print(f"\nDeleting {wlan_name}...")
    url = f"{base_url}/wlan-ssids/{wlan_name}"
    params = {'object_type': 'SHARED'}
    response = requests.delete(url, headers=headers, params=params)
    print(f"  WLAN: {response.status_code}")

    # Also try to delete associated role
    role_name = f"{wlan_name}-default"
    url2 = f"{base_url}/roles/{role_name}"
    response2 = requests.delete(url2, headers=headers, params=params)
    print(f"  Role: {response2.status_code}")

    # And role-gpid
    url3 = f"{base_url}/role-gpids/{role_name}"
    response3 = requests.delete(url3, headers=headers, params=params)
    print(f"  Role-GPID: {response3.status_code}")

print("\nDone!")
