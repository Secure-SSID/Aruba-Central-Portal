#!/usr/bin/env python3
"""Compare WPA3 WLANs - with and without personal-security"""

import json
import requests

# Load cached token
with open('/home/choate/aruba-central-portal-v2/aruba-central-portal/dashboard/backend/.token_cache_central.json', 'r') as f:
    token_data = json.load(f)
    access_token = token_data['access_token']

print("=" * 80)
print("Comparing WPA3 WLAN Configurations")
print("=" * 80)

base_url = "https://internal.api.central.arubanetworks.com/network-config/v1alpha1"
headers = {
    "Authorization": f"Bearer {access_token}",
    "Content-Type": "application/json"
}

# Check TestWPA3 (with personal-security)
print(f"\n1. TestWPA3 (created WITH personal-security):")
response1 = requests.get(
    f"{base_url}/wlan-ssids/TestWPA3",
    headers=headers,
    params={'object_type': 'SHARED'}
)
if response1.status_code == 200:
    wlan1 = response1.json()
    print(f"   Status: 200")
    print(f"   SSID: {wlan1.get('ssid', 'N/A')}")
    print(f"   OpMode: {wlan1.get('opmode', 'N/A')}")
    print(f"   Has personal-security: {'personal-security' in wlan1}")
    if 'personal-security' in wlan1:
        print(f"   Passphrase configured: {'wpa-passphrase' in wlan1['personal-security']}")
    print(f"   Config length: {len(wlan1)} fields")

# Check TestWPA3Broken (without personal-security)
print(f"\n2. TestWPA3Broken (created WITHOUT personal-security):")
response2 = requests.get(
    f"{base_url}/wlan-ssids/TestWPA3Broken",
    headers=headers,
    params={'object_type': 'SHARED'}
)
if response2.status_code == 200:
    wlan2 = response2.json()
    print(f"   Status: 200")
    print(f"   SSID: {wlan2.get('ssid', 'N/A')}")
    print(f"   OpMode: {wlan2.get('opmode', 'N/A')}")
    print(f"   Has personal-security: {'personal-security' in wlan2}")
    if 'personal-security' in wlan2:
        print(f"   Passphrase configured: {'wpa-passphrase' in wlan2['personal-security']}")
    print(f"   Config length: {len(wlan2)} fields")

print("\n" + "=" * 80)
print("ANALYSIS:")
print("=" * 80)
print("If TestWPA3Broken has no personal-security or empty config,")
print("it won't be usable (APs will reject it or clients can't authenticate).")
print("=" * 80)
