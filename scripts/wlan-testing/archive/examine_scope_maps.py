#!/usr/bin/env python3
"""Examine existing scope maps to understand the data structure"""

import json
import requests

# Load cached token
with open('/home/choate/aruba-central-portal-v2/aruba-central-portal/dashboard/backend/.token_cache_central.json', 'r') as f:
    token_data = json.load(f)
    access_token = token_data['access_token']

print("=" * 80)
print("Examining Existing Scope Maps")
print("=" * 80)

base_url = "https://internal.api.central.arubanetworks.com/network-config/v1alpha1"
headers = {
    "Authorization": f"Bearer {access_token}",
    "Content-Type": "application/json"
}

scope_id = "54819475093"
scope_name = "HomeLab"
persona = "CAMPUS_AP"

# Try different GET endpoints to see what exists
endpoints = [
    (f"{base_url}/scope-maps", "All scope maps"),
    (f"{base_url}/scope-maps?scope_id={scope_id}", "Scope maps for HomeLab (by ID)"),
    (f"{base_url}/scope-maps?scope_name={scope_name}", "Scope maps for HomeLab (by name)"),
    (f"{base_url}/scope-maps?persona={persona}", "Scope maps for CAMPUS_AP"),
    (f"{base_url}/scope-maps/{scope_id}", "Scope map by ID"),
    (f"{base_url}/scope-maps/{scope_name}", "Scope map by name"),
    (f"{base_url}/scope-maps/{scope_id}/{persona}", "Scope map by ID + persona"),
    (f"{base_url}/scope-maps/{scope_name}/{persona}", "Scope map by name + persona"),
    (f"{base_url}/scopes", "All scopes"),
    (f"{base_url}/scopes/{scope_id}", "Scope by ID"),
    (f"{base_url}/scopes/{scope_name}", "Scope by name"),
    (f"{base_url}/assignments", "All assignments"),
    (f"{base_url}/assignments?scope_id={scope_id}", "Assignments for HomeLab"),
]

for url, description in endpoints:
    print(f"\n{description}:")
    print(f"  URL: {url}")
    response = requests.get(url, headers=headers)
    print(f"  Status: {response.status_code}")

    if response.status_code == 200:
        try:
            data = response.json()
            print(f"  ✅ Success! Data:")
            print(json.dumps(data, indent=2)[:1000])  # First 1000 chars
            if isinstance(data, dict):
                print(f"\n  Keys: {list(data.keys())}")
                if 'data' in data and isinstance(data['data'], list):
                    print(f"  Items count: {len(data['data'])}")
                    if len(data['data']) > 0:
                        print(f"  Sample item:")
                        print(json.dumps(data['data'][0], indent=2)[:500])
        except Exception as e:
            print(f"  Data: {response.text[:500]}")
    else:
        print(f"  Error: {response.text[:200]}")

print("\n" + "=" * 80)
print("Checking what resources exist in Library")
print("=" * 80)

# List all WLANs in Library
print(f"\nWLANs in Library (SHARED):")
response = requests.get(f"{base_url}/wlan-ssids", headers=headers, params={'object_type': 'SHARED'})
if response.status_code == 200:
    wlans = response.json().get('data', [])
    print(f"  Found {len(wlans)} WLANs")
    for w in wlans[:5]:  # First 5
        print(f"    - {w.get('ssid', 'N/A')}")

# List all roles in Library
print(f"\nRoles in Library (SHARED):")
response = requests.get(f"{base_url}/roles", headers=headers, params={'object_type': 'SHARED'})
if response.status_code == 200:
    roles = response.json().get('data', [])
    print(f"  Found {len(roles)} roles")
    for r in roles[:5]:  # First 5
        print(f"    - {r.get('name', 'N/A')}")

print("\n" + "=" * 80)
