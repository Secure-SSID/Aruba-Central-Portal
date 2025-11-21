#!/usr/bin/env python3
"""Test script using existing bearer token."""

import sys
from pathlib import Path
import requests
from rich.console import Console

console = Console()

# Your access token (get from Aruba Central API)
ACCESS_TOKEN = "your_access_token_here"
BASE_URL = "https://apigw-prod2.central.arubanetworks.com"

def test_connection():
    """Test API connection with bearer token."""
    console.print("[bold blue]Testing Aruba Central API Connection[/bold blue]\n")

    headers = {
        "Authorization": f"Bearer {ACCESS_TOKEN}",
        "Content-Type": "application/json"
    }

    try:
        # Test with a simple endpoint - get platform details
        response = requests.get(
            f"{BASE_URL}/platform/v1/services/config/v1/status",
            headers=headers
        )

        console.print(f"Status Code: {response.status_code}")

        if response.status_code == 200:
            console.print("[green]✓ Connection successful![/green]")
            console.print(f"\nResponse:\n{response.json()}")
        else:
            console.print(f"[yellow]Response: {response.text}[/yellow]")

    except Exception as e:
        console.print(f"[red]Error: {e}[/red]")

if __name__ == "__main__":
    test_connection()
