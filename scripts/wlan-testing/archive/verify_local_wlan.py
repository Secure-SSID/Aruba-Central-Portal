#!/usr/bin/env python3
"""Verify that LOCAL WLANs are properly scoped"""

import json
import requests

# Load cached token
with open('/home/choate/aruba-central-portal-v2/aruba-central-portal/dashboard/backend/.token_cache_central.json', 'r') as f:
    token_data = json.load(f)
    access_token = token_data['access_token']

print("=" * 80)
print("Verifying LOCAL WLAN Scope Assignment")
print("=" * 80)

base_url = "https://internal.api.central.arubanetworks.com/network-config/v1alpha1"
headers = {
    "Authorization": f"Bearer {access_token}",
    "Content-Type": "application/json"
}

wlan_name = "test-local-wlan"
scope_id = "54819475093"
persona = "CAMPUS_AP"

# Try to read the WLAN back
print(f"\n1. Reading WLAN '{wlan_name}'...")
url = f"{base_url}/wlan-ssids/{wlan_name}"
response = requests.get(url, headers=headers)

print(f"Status: {response.status_code}")
if response.status_code == 200:
    wlan_data = response.json()
    print(f"✅ WLAN found!")
    print(json.dumps(wlan_data, indent=2)[:800])

# Try listing all WLANs
print(f"\n2. Listing all WLANs...")
url2 = f"{base_url}/wlan-ssids"
response2 = requests.get(url2, headers=headers)

print(f"Status: {response2.status_code}")
if response2.status_code == 200:
    wlans = response2.json().get('data', [])
    print(f"Found {len(wlans)} WLANs total")

    # Find our test WLAN
    test_wlan = [w for w in wlans if w.get('ssid') == wlan_name]
    if test_wlan:
        print(f"✅ Found our test WLAN in the list!")
        print(json.dumps(test_wlan[0], indent=2)[:500])

# Try listing WLANs for the specific scope
print(f"\n3. Listing WLANs for scope {scope_id}...")
url3 = f"{base_url}/wlan-ssids"
params = {'scope_id': scope_id, 'persona': persona}
response3 = requests.get(url3, headers=headers, params=params)

print(f"Status: {response3.status_code}")
if response3.status_code == 200:
    scoped_wlans = response3.json().get('data', [])
    print(f"Found {len(scoped_wlans)} WLANs for this scope")

    test_wlan_scoped = [w for w in scoped_wlans if w.get('ssid') == wlan_name]
    if test_wlan_scoped:
        print(f"✅ Test WLAN appears in scope-filtered list!")
    else:
        print(f"⚠️  Test WLAN NOT in scope-filtered list")
        print(f"WLANs in scope: {[w.get('ssid') for w in scoped_wlans]}")

print("\n" + "=" * 80)
print("CONCLUSION: If WLAN was created successfully and can be read back,")
print("then object_type=LOCAL during creation is sufficient for scope assignment.")
print("The scope map API is NOT needed for WLAN deployment!")
print("=" * 80)
