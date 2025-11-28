#!/usr/bin/env python3
"""Test authentication with Aruba Central."""

import sys
from pathlib import Path
# Add project root to path (scripts/testing -> scripts -> project root)
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

import requests
from rich.console import Console
from utils import load_config

console = Console()

def test_auth():
    """Test OAuth2 authentication."""
    config = load_config()
    aruba_config = config["aruba_central"]

    console.print("[bold]Testing Aruba Central Authentication[/bold]\n")
    console.print(f"Base URL: {aruba_config['base_url']}")
    console.print(f"Client ID: {aruba_config['client_id'][:10]}...")
    console.print(f"Customer ID: {aruba_config['customer_id'][:10]}...\n")

    auth_url = f"{aruba_config['base_url']}/oauth2/token"

    # Try password grant
    data = {
        "grant_type": "password",
        "client_id": aruba_config["client_id"],
        "client_secret": aruba_config["client_secret"],
        "username": aruba_config["username"],
        "password": aruba_config["password"],
    }

    console.print(f"Auth URL: {auth_url}")
    console.print(f"Grant type: {data['grant_type']}")
    console.print(f"Username: {aruba_config['username']}\n")

    try:
        response = requests.post(auth_url, data=data)
        console.print(f"Status Code: {response.status_code}")
        console.print(f"Response: {response.text}\n")

        if response.status_code == 200:
            token_data = response.json()
            console.print("[green]✓ Authentication successful![/green]")
            console.print(f"Access token: {token_data['access_token'][:20]}...")
            console.print(f"Expires in: {token_data.get('expires_in')} seconds")
        else:
            console.print("[red]✗ Authentication failed[/red]")

    except Exception as e:
        console.print(f"[red]Error: {e}[/red]")

if __name__ == "__main__":
    test_auth()
