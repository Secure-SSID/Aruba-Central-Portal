"""Configuration management utilities."""

import os
import yaml
from pathlib import Path
from typing import Dict, Any
from dotenv import load_dotenv


def load_config(config_path: str = "config.yaml") -> Dict[str, Any]:
    """Load configuration from YAML file and environment variables.

    Args:
        config_path: Path to configuration file

    Returns:
        Configuration dictionary
    """
    # Load environment variables from .env file with override
    # This ensures we always get the latest values from .env
    try:
        load_dotenv(override=True)
    except (FileNotFoundError, PermissionError):
        # .env file doesn't exist or isn't readable - that's okay,
        # environment variables may be set directly (e.g., in Docker)
        pass

    config_file = Path(config_path)

    # Start with empty config
    config: Dict[str, Any] = {}

    # Load from YAML if it exists
    if config_file.exists():
        with open(config_file, "r") as f:
            config = yaml.safe_load(f) or {}

    # Override with environment variables
    config["aruba_central"] = {
        "base_url": os.getenv(
            "ARUBA_BASE_URL",
            config.get("aruba_central", {}).get("base_url", "https://apigw-prod2.central.arubanetworks.com"),
        ),
        "client_id": os.getenv("ARUBA_CLIENT_ID", config.get("aruba_central", {}).get("client_id", "")),
        "client_secret": os.getenv(
            "ARUBA_CLIENT_SECRET", config.get("aruba_central", {}).get("client_secret", "")
        ),
        "customer_id": os.getenv(
            "ARUBA_CUSTOMER_ID", config.get("aruba_central", {}).get("customer_id", "")
        ),
        "access_token": os.getenv("ARUBA_ACCESS_TOKEN", config.get("aruba_central", {}).get("access_token")),
        "username": os.getenv("ARUBA_USERNAME", config.get("aruba_central", {}).get("username")),
        "password": os.getenv("ARUBA_PASSWORD", config.get("aruba_central", {}).get("password")),
    }

    return config
