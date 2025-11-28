#!/usr/bin/env python3
"""Test Aruba Central authentication with different methods."""

import sys
from pathlib import Path
# Add project root to path (scripts/testing -> scripts -> project root)
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

import requests
from rich.console import Console
from utils import load_config

console = Console()

def test_auth():
    """Test various authentication methods."""
    config = load_config()
    aruba_config = config["aruba_central"]

    console.print("[bold]Testing Aruba Central Authentication Methods[/bold]\n")

    # Method 1: Try the login endpoint
    login_url = f"{aruba_config['base_url']}/oauth2/authorize/central/api/login"

    console.print(f"[cyan]Method 1: API Login[/cyan]")
    console.print(f"URL: {login_url}\n")

    data = {
        "username": aruba_config["username"],
        "password": aruba_config["password"]
    }

    try:
        response = requests.post(login_url, json=data)
        console.print(f"Status: {response.status_code}")
        console.print(f"Response: {response.text[:500]}\n")
    except Exception as e:
        console.print(f"Error: {e}\n")

    # Method 2: Try refresh_token endpoint with customer_id
    console.print(f"[cyan]Method 2: Token with customer_id[/cyan]")
    token_url = f"{aruba_config['base_url']}/oauth2/token"

    data = {
        "client_id": aruba_config["client_id"],
        "client_secret": aruba_config["client_secret"],
        "grant_type": "refresh_token",
        "refresh_token": ""  # Empty for now
    }

    headers = {
        "Content-Type": "application/json"
    }

    try:
        response = requests.post(token_url, json=data, headers=headers)
        console.print(f"Status: {response.status_code}")
        console.print(f"Response: {response.text[:500]}\n")
    except Exception as e:
        console.print(f"Error: {e}\n")

if __name__ == "__main__":
    test_auth()
