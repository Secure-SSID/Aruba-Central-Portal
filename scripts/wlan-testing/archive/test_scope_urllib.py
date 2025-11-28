#!/usr/bin/env python3
"""Test scope map with proper URL encoding"""

import json
import requests
from urllib.parse import quote

# Load cached token
with open('/home/choate/aruba-central-portal-v2/aruba-central-portal/dashboard/backend/.token_cache_central.json', 'r') as f:
    token_data = json.load(f)
    access_token = token_data['access_token']

print("=" * 80)
print("Testing Different URL Encoding Methods")
print("=" * 80)

base_url = "https://internal.api.central.arubanetworks.com/network-config/v1alpha1"
headers = {
    "Authorization": f"Bearer {access_token}",
    "Content-Type": "application/json"
}

wlan_name = "qwert"
scope_id = "54819475093"
persona = "CAMPUS_AP"

params = {
    'object_type': 'LOCAL',
    'scope_id': scope_id,
    'persona': persona
}
body = {}

# Test 1: Manual ~2F encoding (what we've been doing)
print(f"\nTEST 1: Manual ~2F encoding")
resource1 = f"wlan-ssids~2F{wlan_name}"
url1 = f"{base_url}/scope-maps/{scope_id}/{persona}/{resource1}"
print(f"URL: {url1}")
print(f"Params: {params}")

response1 = requests.post(url1, headers=headers, json=body, params=params)
print(f"Status: {response1.status_code}")
if response1.status_code != 200:
    print(f"Error: {response1.json().get('message', 'Unknown')}")

# Test 2: URL encoding with quote()
print(f"\nTEST 2: Using urllib.parse.quote()")
resource2 = quote(f"wlan-ssids/{wlan_name}", safe='')
url2 = f"{base_url}/scope-maps/{scope_id}/{persona}/{resource2}"
print(f"URL: {url2}")
print(f"Params: {params}")

response2 = requests.post(url2, headers=headers, json=body, params=params)
print(f"Status: {response2.status_code}")
if response2.status_code != 200:
    print(f"Error: {response2.json().get('message', 'Unknown')}")

# Test 3: Double encoding
print(f"\nTEST 3: Double URL encoding")
resource3 = quote(f"wlan-ssids/{wlan_name}")  # %2F
url3 = f"{base_url}/scope-maps/{scope_id}/{persona}/{resource3}"
print(f"URL: {url3}")
print(f"Params: {params}")

response3 = requests.post(url3, headers=headers, json=body, params=params)
print(f"Status: {response3.status_code}")
if response3.status_code == 200 or response3.status_code == 409:
    print(f"✅ SUCCESS! This encoding works!")
    print(f"Response: {response3.text[:500]}")
elif response3.status_code != 200:
    print(f"Error: {response3.json().get('message', 'Unknown')}")

# Test 4: No encoding at all
print(f"\nTEST 4: No encoding (raw slash)")
url4_path = f"/scope-maps/{scope_id}/{persona}/wlan-ssids/{wlan_name}"
url4 = base_url + url4_path
print(f"URL: {url4}")
print(f"Params: {params}")

response4 = requests.post(url4, headers=headers, json=body, params=params)
print(f"Status: {response4.status_code}")
if response4.status_code == 200 or response4.status_code == 409:
    print(f"✅ SUCCESS! Raw slash works!")
    print(f"Response: {response4.text[:500]}")
elif response4.status_code != 200:
    print(f"Error: {response4.json().get('message', 'Unknown')}")

print("\n" + "=" * 80)
