#!/usr/bin/env python3
"""Test scope map creation with scope ID instead of name"""

import json
import requests

# Load cached token
with open('/home/choate/aruba-central-portal-v2/aruba-central-portal/dashboard/backend/.token_cache_central.json', 'r') as f:
    token_data = json.load(f)
    access_token = token_data['access_token']

print("=" * 80)
print("Testing Scope Map with SCOPE ID (not name)")
print("=" * 80)

base_url = "https://internal.api.central.arubanetworks.com"
headers = {
    "Authorization": f"Bearer {access_token}",
    "Content-Type": "application/json"
}

# Use one of the existing WLANs from your system
wlan_name = "qwert"  # Already created in previous test
scope_id = "54819475093"
persona = "CAMPUS_AP"

print(f"\nTEST: Using SCOPE ID in URL path")
print("=" * 80)

# Try with scope ID in URL (not name)
url = f"{base_url}/network-config/v1alpha1/scope-maps/{scope_id}/{persona}/wlan-ssids~2F{wlan_name}"
params = {
    'object_type': 'LOCAL',
    'scope_id': scope_id,
    'persona': persona
}
body = {}

print(f"URL: {url}")
print(f"Params: {params}")
print(f"Body: {body}")

response = requests.post(url, headers=headers, json=body, params=params)
print(f"\nStatus: {response.status_code}")
print(f"Response: {response.text[:1000]}")

if response.status_code == 200:
    print("\n🎉 ✅ SUCCESS! Scope ID in URL works!")
elif response.status_code == 409:
    print("\n✅ Scope map already exists (that's actually good - means the format works!)")
else:
    print("\n❌ FAILED")

print("\n" + "=" * 80)
