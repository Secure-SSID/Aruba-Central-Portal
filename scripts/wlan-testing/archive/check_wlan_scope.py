#!/usr/bin/env python3
"""Check if WLAN qwert is already associated with any scope"""

import json
import requests

# Load cached token
with open('/home/choate/aruba-central-portal-v2/aruba-central-portal/dashboard/backend/.token_cache_central.json', 'r') as f:
    token_data = json.load(f)
    access_token = token_data['access_token']

print("=" * 80)
print("Checking WLAN Configuration and Scope Assignment")
print("=" * 80)

base_url = "https://internal.api.central.arubanetworks.com"
headers = {
    "Authorization": f"Bearer {access_token}",
    "Content-Type": "application/json"
}

wlan_name = "qwert"

# Get WLAN details
print(f"\n1. Getting WLAN '{wlan_name}' configuration...")
url = f"{base_url}/network-config/v1alpha1/wlan-ssids/{wlan_name}"
response = requests.get(url, headers=headers)

if response.status_code == 200:
    wlan_data = response.json()
    print(f"✅ WLAN exists")
    print(json.dumps(wlan_data, indent=2)[:1000])
else:
    print(f"❌ Failed: {response.status_code}")
    print(response.text[:500])

# Check if there's a "scope" field or similar
print(f"\n2. Checking for scope-related fields in WLAN config...")
if response.status_code == 200:
    scope_fields = [k for k in wlan_data.keys() if 'scope' in k.lower()]
    if scope_fields:
        print(f"Found scope fields: {scope_fields}")
        for field in scope_fields:
            print(f"  {field}: {wlan_data[field]}")
    else:
        print("No scope-related fields found in WLAN config")

# Try getting WLANs from monitoring API (might show assignment status)
print(f"\n3. Checking monitoring API for WLAN status...")
url2 = f"{base_url}/network-monitoring/v1alpha1/wlans"
response2 = requests.get(url2, headers=headers)

if response2.status_code == 200:
    wlans_data = response2.json()
    matching_wlans = [w for w in wlans_data.get('data', []) if w.get('name') == wlan_name or w.get('ssid') == wlan_name]
    if matching_wlans:
        print(f"✅ Found WLAN in monitoring API:")
        print(json.dumps(matching_wlans[0], indent=2)[:1000])
    else:
        print(f"⚠️  WLAN not found in monitoring API (might not be deployed to any AP)")
else:
    print(f"Monitoring API returned: {response2.status_code}")

print("\n" + "=" * 80)
print("CONCLUSION: If WLAN exists but isn't showing scope assignment,")
print("it might need to be deployed differently or scope maps API")
print("might not be the right approach for this version.")
print("=" * 80)
