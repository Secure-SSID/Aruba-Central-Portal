#!/usr/bin/env python3
"""Assign Frontendtest WLAN to HomeLab scope"""

import json
import requests

# Load cached token
with open('/home/choate/aruba-central-portal-v2/aruba-central-portal/dashboard/backend/.token_cache_central.json', 'r') as f:
    token_data = json.load(f)
    access_token = token_data['access_token']

print("=" * 80)
print("Assigning Frontendtest to HomeLab Scope")
print("=" * 80)

base_url = "https://internal.api.central.arubanetworks.com/network-config/v1alpha1"
headers = {
    "Authorization": f"Bearer {access_token}",
    "Content-Type": "application/json"
}

scope_id = 54819475093
scope_name = "HomeLab"
persona = "CAMPUS_AP"
wlan_name = "Frontendtest"

# Try exact structure from existing maps
scope_map = {
    "scope-name": str(scope_id),  # Existing maps show scope-name as string of ID
    "scope-id": scope_id,
    "persona": persona,
    "resource": f"wlan-ssids/{wlan_name}"
}

print(f"\n1. Trying POST with single object...")
print(f"   Data: {json.dumps(scope_map, indent=2)}")
response1 = requests.post(f"{base_url}/scope-maps", headers=headers, json=scope_map)
print(f"   Status: {response1.status_code}")
if response1.status_code in [200, 201]:
    print(f"   ✅ Success!")
else:
    print(f"   Error: {response1.text[:300]}")

# Try with scope-map wrapper
print(f"\n2. Trying POST with scope-map array...")
wrapped = {"scope-map": [scope_map]}
print(f"   Data: {json.dumps(wrapped, indent=2)}")
response2 = requests.post(f"{base_url}/scope-maps", headers=headers, json=wrapped)
print(f"   Status: {response2.status_code}")
if response2.status_code in [200, 201]:
    print(f"   ✅ Success!")
else:
    print(f"   Error: {response2.text[:300]}")

# Try PUT
print(f"\n3. Trying PUT...")
response3 = requests.put(f"{base_url}/scope-maps", headers=headers, json=scope_map)
print(f"   Status: {response3.status_code}")
if response3.status_code in [200, 201]:
    print(f"   ✅ Success!")
else:
    print(f"   Error: {response3.text[:300]}")

# Try PATCH
print(f"\n4. Trying PATCH...")
response4 = requests.patch(f"{base_url}/scope-maps", headers=headers, json=wrapped)
print(f"   Status: {response4.status_code}")
if response4.status_code in [200, 201]:
    print(f"   ✅ Success!")
else:
    print(f"   Error: {response4.text[:300]}")

# Check if scope map was created
print(f"\n5. Verifying scope map creation...")
response5 = requests.get(f"{base_url}/scope-maps", headers=headers, params={'scope_id': scope_id})
if response5.status_code == 200:
    maps = response5.json().get('scope-map', [])
    frontendtest_maps = [m for m in maps if 'Frontendtest' in m.get('resource', '')]
    if frontendtest_maps:
        print(f"   ✅ Found scope map for Frontendtest!")
        for m in frontendtest_maps:
            print(f"      {json.dumps(m, indent=2)}")
    else:
        print(f"   ❌ Still no scope map for Frontendtest")

print("\n" + "=" * 80)
