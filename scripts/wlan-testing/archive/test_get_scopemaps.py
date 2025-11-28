#!/usr/bin/env python3
"""Get existing scope maps to see the correct format"""

import json
import requests

# Load cached token
with open('/home/choate/aruba-central-portal-v2/aruba-central-portal/dashboard/backend/.token_cache_central.json', 'r') as f:
    token_data = json.load(f)
    access_token = token_data['access_token']

print("=" * 80)
print("Getting Existing Scope Maps")
print("=" * 80)

base_url = "https://internal.api.central.arubanetworks.com"
headers = {
    "Authorization": f"Bearer {access_token}",
    "Content-Type": "application/json"
}

# Get scope maps for HomeLab site
scope_id = "54819475093"

print(f"\nGET /network-config/v1alpha1/scope-maps?scope_id={scope_id}&limit=50")
url = f"{base_url}/network-config/v1alpha1/scope-maps"
params = {'scope_id': scope_id, 'limit': 50}

response = requests.get(url, headers=headers, params=params)
print(f"Status: {response.status_code}")

if response.status_code == 200:
    data = response.json()
    print(f"\nFound {len(data.get('data', []))} scope maps")

    # Print first few to see the structure
    for i, item in enumerate(data.get('data', [])[:5]):
        print(f"\n--- Scope Map {i+1} ---")
        print(json.dumps(item, indent=2)[:500])
else:
    print(f"Response: {response.text[:1000]}")

print("\n" + "=" * 80)
