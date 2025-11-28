#!/usr/bin/env python3
"""Check MSP account information and tenant details."""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from utils import CentralAPIClient, TokenManager, load_config
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.tree import Tree
import json

console = Console()


def main():
    """Check MSP information."""
    console.print(Panel.fit(
        "[bold blue]MSP Account Information[/bold blue]",
        border_style="blue"
    ))
    console.print()

    # Load configuration
    config = load_config()
    aruba_config = config["aruba_central"]

    # Initialize token manager and client
    token_manager = TokenManager(
        client_id=aruba_config["client_id"],
        client_secret=aruba_config["client_secret"],
    )
    client = CentralAPIClient(
        base_url=aruba_config["base_url"],
        token_manager=token_manager,
    )

    # Try to get account/customer information
    console.print("[bold]Checking Account Information...[/bold]\n")

    # 1. Check users (we know this works) to see if we can get tenant info
    try:
        users = client.get("/platform/rbac/v1/users")
        console.print(f"[green]✓[/green] Users API accessible")
        console.print(f"  Total users: {users.get('total', 0)}\n")
    except Exception as e:
        console.print(f"[red]✗[/red] Users API: {e}\n")

    # 2. Try to get topology/groups (might reveal tenant structure)
    endpoints_to_try = [
        ("/configuration/v1/groups", "Configuration Groups"),
        ("/topology_external_api/groups", "Topology Groups"),
        ("/monitoring/v1/groups", "Monitoring Groups"),
        ("/configuration/v2/groups", "Configuration Groups v2"),
    ]

    working_endpoints = []
    for endpoint, desc in endpoints_to_try:
        try:
            console.print(f"[cyan]Testing:[/cyan] {endpoint}")
            result = client.get(endpoint)
            console.print(f"[green]✓ Success:[/green] {desc}")
            working_endpoints.append((endpoint, desc, result))
        except Exception as e:
            console.print(f"[dim]✗ {str(e)[:80]}[/dim]")
        console.print()

    # Display working endpoints
    if working_endpoints:
        console.print("\n" + "="*70 + "\n")
        console.print(f"[bold green]Found {len(working_endpoints)} endpoint(s) with data![/bold green]\n")

        for endpoint, desc, data in working_endpoints:
            console.print(Panel.fit(f"[cyan]{desc}[/cyan]\n[dim]{endpoint}[/dim]", border_style="cyan"))
            console.print()

            if isinstance(data, dict):
                # Show structure
                console.print(f"[yellow]Keys:[/yellow] {', '.join(data.keys())}")

                # Look for groups/tenants
                if 'data' in data and isinstance(data['data'], list):
                    console.print(f"[green]Groups found:[/green] {len(data['data'])}")

                    if data['data']:
                        table = Table(title=f"{desc}")
                        # Determine columns from first item
                        first_item = data['data'][0]
                        columns = ['group', 'name', 'template_group', 'properties']
                        for col in columns:
                            if col in first_item:
                                table.add_column(col.replace('_', ' ').title(), style="cyan")

                        for item in data['data'][:20]:
                            row = []
                            for col in columns:
                                if col in first_item:
                                    val = item.get(col, 'N/A')
                                    if isinstance(val, dict):
                                        val = json.dumps(val)[:50]
                                    row.append(str(val))
                            table.add_row(*row)

                        console.print(table)

                elif 'groups' in data and isinstance(data['groups'], list):
                    console.print(f"[green]Groups found:[/green] {len(data['groups'])}")

                    if data['groups']:
                        table = Table(title=f"{desc}")
                        table.add_column("Group Name", style="cyan")
                        table.add_column("Template Group", style="yellow")

                        for group in data['groups'][:20]:
                            if isinstance(group, dict):
                                table.add_row(
                                    group.get('group', group.get('name', 'N/A')),
                                    str(group.get('template_group', 'N/A'))
                                )
                            else:
                                table.add_row(str(group), "N/A")

                        console.print(table)

                # Show raw data if small
                if len(str(data)) < 1000:
                    console.print(f"\n[yellow]Raw Data:[/yellow]")
                    console.print(json.dumps(data, indent=2))

            console.print("\n" + "-"*70 + "\n")

    # Try to get licensing info (might show tenant/customer info)
    console.print("\n[bold]Checking License Information...[/bold]\n")
    try:
        license_info = client.get("/platform/licensing/v1/customer/licenses")
        console.print("[green]✓ License API accessible[/green]")
        if isinstance(license_info, dict):
            console.print(f"Keys: {', '.join(license_info.keys())}")
            console.print(json.dumps(license_info, indent=2)[:500])
    except Exception as e:
        console.print(f"[dim]License API not accessible: {str(e)[:80]}[/dim]")

    # Summary
    console.print("\n")
    console.print(Panel.fit(
        f"[bold]Current Configuration[/bold]\n\n"
        f"Customer ID: {aruba_config['customer_id']}\n"
        f"Username: {aruba_config['username']}\n"
        f"Base URL: {aruba_config['base_url']}\n\n"
        f"[yellow]Note:[/yellow] Your account appears to be in a single tenant context.\n"
        f"The customer_id {aruba_config['customer_id'][:16]}... is your tenant identifier.",
        title="MSP Context",
        border_style="blue"
    ))


if __name__ == "__main__":
    main()
