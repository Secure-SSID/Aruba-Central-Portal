#!/usr/bin/env python3
"""Check portal-test WLAN status"""

import json
import requests

# Load cached token
with open('/home/choate/aruba-central-portal-v2/aruba-central-portal/dashboard/backend/.token_cache_central.json', 'r') as f:
    token_data = json.load(f)
    access_token = token_data['access_token']

print("=" * 80)
print("Checking portal-test WLAN Status")
print("=" * 80)

base_url = "https://internal.api.central.arubanetworks.com"
headers = {
    "Authorization": f"Bearer {access_token}",
    "Content-Type": "application/json"
}

wlan_name = "portal-test"
scope_id = "54819475093"
persona = "CAMPUS_AP"

# 1. Check WLAN configuration
print(f"\n1. Checking WLAN '{wlan_name}' configuration...")
response = requests.get(
    f"{base_url}/network-config/v1alpha1/wlan-ssids/{wlan_name}",
    headers=headers,
    params={'scope_id': scope_id, 'persona': persona}
)
print(f"   Status: {response.status_code}")
if response.status_code == 200:
    wlan = response.json()
    print(f"   ✅ WLAN found")
    print(f"      SSID: {wlan.get('ssid', 'N/A')}")
    print(f"      Enabled: {wlan.get('enable', 'N/A')}")
    print(f"      OpMode: {wlan.get('opmode', 'N/A')}")
    print(f"      dot11v: {wlan.get('dot11v', 'NOT SET')}")
    print(f"      Has password: {'personal-security' in wlan}")

# 2. Check if it's broadcasting on APs
print(f"\n2. Checking if WLAN is broadcasting on APs...")
response2 = requests.get(
    f"{base_url}/network-monitoring/v1alpha1/wlans",
    headers=headers
)
if response2.status_code == 200:
    wlans = response2.json().get('data', [])
    portal_wlans = [w for w in wlans if w.get('name') == wlan_name or w.get('ssid') == wlan_name]

    if portal_wlans:
        print(f"   ✅ WLAN is broadcasting on {len(portal_wlans)} AP(s)!")
        for w in portal_wlans:
            print(f"      - AP: {w.get('ap_name', 'N/A')}, Status: {w.get('status', 'N/A')}")
    else:
        print(f"   ⚠️  WLAN not broadcasting yet (may take 1-2 minutes)")

# 3. Check scope assignments
print(f"\n3. Checking scope assignments...")
response3 = requests.get(
    f"{base_url}/network-config/v1alpha1/scope-maps",
    headers=headers,
    params={'scope_id': scope_id}
)
if response3.status_code == 200:
    maps = response3.json().get('scope-map', [])
    portal_maps = [m for m in maps if wlan_name in m.get('resource', '')]

    if portal_maps:
        print(f"   ✅ Found {len(portal_maps)} scope map(s):")
        for m in portal_maps:
            print(f"      - {m.get('resource', 'N/A')}")
    else:
        print(f"   ❌ No scope maps found")

print("\n" + "=" * 80)
print("Summary:")
print("=" * 80)
print("\nThe 'dot11v' warnings are non-blocking - your APs don't support 802.11v")
print("but the WLAN should still work. The APs automatically remove unsupported")
print("settings. If the WLAN is broadcasting, you should be able to connect.")
print("=" * 80)
