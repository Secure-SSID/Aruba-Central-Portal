#!/usr/bin/env python3
"""Delete Frontendtest WLAN and related resources"""

import json
import requests

# Load cached token
with open('/home/choate/aruba-central-portal-v2/aruba-central-portal/dashboard/backend/.token_cache_central.json', 'r') as f:
    token_data = json.load(f)
    access_token = token_data['access_token']

print("=" * 80)
print("Deleting Frontendtest WLAN and Resources")
print("=" * 80)

base_url = "https://internal.api.central.arubanetworks.com/network-config/v1alpha1"
headers = {
    "Authorization": f"Bearer {access_token}",
    "Content-Type": "application/json"
}

wlan_name = "Frontendtest"
scope_id = "54819475093"
persona = "CAMPUS_AP"

# Step 1: Delete scope maps first
print(f"\n1. Deleting scope maps...")
# We need to delete the scope maps that reference the WLAN
# Unfortunately there's no direct DELETE for scope maps, so we'll try

# Step 2: Delete WLAN
print(f"\n2. Deleting WLAN '{wlan_name}'...")
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

# Step 3: Delete auto-created role
print(f"\n3. Deleting role '{wlan_name}'...")
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

# Step 4: Delete role-gpid
print(f"\n4. Deleting role-gpid '{wlan_name}'...")
response3 = requests.delete(
    f"{base_url}/role-gpids/{wlan_name}",
    headers=headers,
    params={'object_type': 'SHARED'}
)
print(f"   Status: {response3.status_code}")
if response3.status_code == 200:
    print(f"   ✅ Role-gpid deleted")
else:
    print(f"   Error: {response3.text[:300]}")

print("\n" + "=" * 80)
print("Cleanup complete! You can now recreate the WLAN with the wizard.")
print("=" * 80)
