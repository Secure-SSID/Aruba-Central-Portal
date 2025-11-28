#!/usr/bin/env python3
"""MSP Dashboard - View users, devices, and system info."""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from utils import CentralAPIClient, TokenManager, load_config
from rich.console import Console
from rich.table import Table
from rich.panel import Panel

console = Console()


def main():
    """Display MSP dashboard."""
    console.print(Panel.fit(
        "[bold blue]Aruba Central MSP Dashboard[/bold blue]",
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

    try:
        # Get Users
        console.print("[bold cyan]Users[/bold cyan]")
        users_response = client.get("/platform/rbac/v1/users")

        if users_response and 'items' in users_response:
            users = users_response['items']
            console.print(f"Total users: [green]{users_response.get('total', len(users))}[/green]\n")

            # Create users table
            table = Table(title=f"User List ({len(users)} shown)")
            table.add_column("Name", style="cyan")
            table.add_column("Role", style="yellow")
            table.add_column("Apps", style="green")

            for user in users[:10]:  # Show first 10
                name_obj = user.get('name', {})
                full_name = f"{name_obj.get('firstname', '')} {name_obj.get('lastname', '')}".strip()
                if not full_name:
                    full_name = user.get('username', 'N/A')

                # Extract role
                apps = user.get('applications', [])
                role = "N/A"
                app_names = []
                for app in apps:
                    app_names.append(app.get('name', ''))
                    info = app.get('info', [])
                    if info and isinstance(info, list) and len(info) > 0:
                        role = info[0].get('role', role)

                table.add_row(
                    full_name,
                    role,
                    ", ".join(app_names) if app_names else "None"
                )

            console.print(table)
            console.print()

        # Get Switches
        console.print("\n[bold cyan]Network Devices[/bold cyan]")
        switches_response = client.get("/monitoring/v1/switches")

        if switches_response:
            switch_count = switches_response.get('count', 0)
            console.print(f"Switches: [green]{switch_count}[/green]")

            if switch_count > 0:
                switches = switches_response.get('switches', [])
                switch_table = Table(title="Switches")
                switch_table.add_column("Name", style="cyan")
                switch_table.add_column("Serial", style="yellow")
                switch_table.add_column("Model", style="green")
                switch_table.add_column("Status", style="magenta")

                for switch in switches[:10]:
                    switch_table.add_row(
                        switch.get('name', 'N/A'),
                        switch.get('serial', 'N/A'),
                        switch.get('model', 'N/A'),
                        switch.get('status', 'N/A')
                    )

                console.print(switch_table)

        console.print()

        # Summary
        console.print(Panel.fit(
            f"[green]✓ Successfully connected to Aruba Central[/green]\n"
            f"Region: {aruba_config['base_url']}\n"
            f"Customer ID: {aruba_config['customer_id'][:16]}...",
            title="Connection Status",
            border_style="green"
        ))

    except Exception as e:
        console.print(f"\n[red]Error: {e}[/red]")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
