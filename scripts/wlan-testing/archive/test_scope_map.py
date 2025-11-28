#!/usr/bin/env python3
"""Test scope map creation to debug the 400 error."""

import requests
import json

# Test creating a scope map via the backend
backend_url = "http://localhost:1344"

# Test data matching what the frontend is sending
scope_name = "54819475093"
persona = "CAMPUS_AP"
resource = "wlan-ssids/bridge1"

url = f"{backend_url}/api/config/scope-maps/{scope_name}/{persona}/{resource.replace('/', '~2F')}"

data = {
    "scope-name": scope_name,
    "scope-id": int(scope_name),
    "persona": persona,
    "resource": resource
}

print(f"URL: {url}")
print(f"Request body: {json.dumps(data, indent=2)}")

try:
    response = requests.post(url, json=data)
    print(f"\nStatus: {response.status_code}")
    print(f"Response: {json.dumps(response.json(), indent=2)}")
except Exception as e:
    print(f"Error: {e}")
    if hasattr(e, 'response'):
        print(f"Response text: {e.response.text}")
