#!/usr/bin/env python3
"""Read LOCAL WLAN with scope parameters"""

import json
import requests

# Load cached token
with open('/home/choate/aruba-central-portal-v2/aruba-central-portal/dashboard/backend/.token_cache_central.json', 'r') as f:
    token_data = json.load(f)
    access_token = token_data['access_token']

print("=" * 80)
print("Reading LOCAL WLAN with Scope Parameters")
print("=" * 80)

base_url = "https://internal.api.central.arubanetworks.com/network-config/v1alpha1"
headers = {
    "Authorization": f"Bearer {access_token}",
    "Content-Type": "application/json"
}

wlan_name = "test-local-wlan"
scope_id = "54819475093"
persona = "CAMPUS_AP"

# Try reading with scope parameters
print(f"\nReading WLAN '{wlan_name}' WITH scope parameters...")
url = f"{base_url}/wlan-ssids/{wlan_name}"
params = {'scope_id': scope_id, 'persona': persona}

print(f"URL: {url}")
print(f"Params: {params}")

response = requests.get(url, headers=headers, params=params)
print(f"Status: {response.status_code}")

if response.status_code == 200:
    wlan_data = response.json()
    print(f"✅ WLAN found!")
    print(json.dumps(wlan_data, indent=2))
else:
    print(f"Error: {response.text[:500]}")

# Also try the SHARED WLANs for comparison
print(f"\n" + "=" * 80)
print("Comparing with SHARED WLANs...")
print("=" * 80)

url2 = f"{base_url}/wlan-ssids"
params2 = {'object_type': 'SHARED'}

response2 = requests.get(url2, headers=headers, params=params2)
print(f"Status: {response2.status_code}")

if response2.status_code == 200:
    shared_wlans = response2.json().get('data', [])
    print(f"Found {len(shared_wlans)} SHARED WLANs")
    for w in shared_wlans:
        print(f"  - {w.get('ssid', 'N/A')}")

# Try LOCAL WLANs
print(f"\nTrying LOCAL WLANs for scope...")
url3 = f"{base_url}/wlan-ssids"
params3 = {'object_type': 'LOCAL', 'scope_id': scope_id, 'persona': persona}

response3 = requests.get(url3, headers=headers, params=params3)
print(f"Status: {response3.status_code}")

if response3.status_code == 200:
    local_wlans = response3.json().get('data', [])
    print(f"Found {len(local_wlans)} LOCAL WLANs for this scope")
    for w in local_wlans:
        print(f"  - {w.get('ssid', 'N/A')}")

    # Check if our test WLAN is there
    test_wlan = [w for w in local_wlans if w.get('ssid') == wlan_name]
    if test_wlan:
        print(f"\n✅ Found our test-local-wlan!")
        print(json.dumps(test_wlan[0], indent=2))
    else:
        print(f"\n⚠️  test-local-wlan not found in LOCAL WLANs")

print("\n" + "=" * 80)
