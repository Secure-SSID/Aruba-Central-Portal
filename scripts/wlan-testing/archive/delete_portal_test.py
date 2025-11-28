#!/usr/bin/env python3
"""Delete portal-test WLAN and related resources"""

import json
import requests

# Load cached token
with open('/home/choate/aruba-central-portal-v2/aruba-central-portal/dashboard/backend/.token_cache_central.json', 'r') as f:
    token_data = json.load(f)
    access_token = token_data['access_token']

print("=" * 80)
print("Deleting portal-test WLAN and Resources")
print("=" * 80)

base_url = "https://internal.api.central.arubanetworks.com/network-config/v1alpha1"
headers = {
    "Authorization": f"Bearer {access_token}",
    "Content-Type": "application/json"
}

wlan_name = "portal-test"

# Step 1: Delete WLAN
print(f"\n1. Deleting WLAN '{wlan_name}'...")
response = requests.delete(
    f"{base_url}/wlan-ssids/{wlan_name}",
    headers=headers,
    params={'object_type': 'SHARED'}
)
print(f"   Status: {response.status_code}")
if response.status_code == 200:
    print(f"   ✅ WLAN deleted")
else:
    print(f"   Error: {response.text[:300]}")

# Step 2: Delete auto-created role
print(f"\n2. Deleting role '{wlan_name}'...")
response2 = requests.delete(
    f"{base_url}/roles/{wlan_name}",
    headers=headers,
    params={'object_type': 'SHARED'}
)
print(f"   Status: {response2.status_code}")
if response2.status_code == 200:
    print(f"   ✅ Role deleted")
else:
    print(f"   Error: {response2.text[:300]}")

# Step 3: Delete role-gpid (may fail, that's ok)
print(f"\n3. Deleting role-gpid '{wlan_name}'...")
response3 = requests.delete(
    f"{base_url}/role-gpids/{wlan_name}",
    headers=headers,
    params={'object_type': 'SHARED'}
)
print(f"   Status: {response3.status_code}")
if response3.status_code == 200:
    print(f"   ✅ Role-gpid deleted")
else:
    print(f"   (Role-gpid deletion may not be supported - this is OK)")

print("\n" + "=" * 80)
print("Cleanup complete!")
print("=" * 80)
print("\nYou can now recreate portal-test using the wizard.")
print("The new WLAN will use the updated template without dot11v.")
print("=" * 80)
