"""Pytest fixtures and configuration for Aruba Central Portal tests."""

import json
import os
import pytest
import responses
import tempfile
from pathlib import Path
from typing import Dict, Any
from unittest.mock import MagicMock, patch

# Add project root to path
import sys
sys.path.insert(0, str(Path(__file__).parent.parent))


# =============================================================================
# Constants for Testing
# =============================================================================

TEST_BASE_URL = "https://test.api.central.arubanetworks.com"
TEST_TOKEN_URL = "https://sso.common.cloud.hpe.com/as/token.oauth2"
TEST_CLIENT_ID = "test-client-id"
TEST_CLIENT_SECRET = "test-client-secret"
TEST_ACCESS_TOKEN = "test-access-token-12345"


# =============================================================================
# Sample API Response Data
# =============================================================================

SAMPLE_DEVICES = {
    "devices": [
        {
            "serial": "CN12345678",
            "name": "AP-Office-1",
            "device_type": "AP",
            "status": "Up"
        },
        {
            "serial": "CN87654321",
            "name": "GW-Main",
            "device_type": "GATEWAY",
            "status": "Up"
        }
    ],
    "total": 2
}

SAMPLE_WLANS = {
    "data": [
        {
            "ssid": "Corporate-WiFi",
            "opmode": "WPA2_PERSONAL",
            "forward-mode": "FORWARD_MODE_BRIDGE",
            "enable": True,
            "default-role": "authenticated"
        },
        {
            "ssid": "Guest-WiFi",
            "opmode": "OPEN",
            "forward-mode": "FORWARD_MODE_BRIDGE",
            "enable": True,
            "default-role": "guest"
        }
    ]
}

SAMPLE_SITES = {
    "items": [
        {
            "site_name": "HomeLab",
            "scope-id": "54819475093",
            "site_type": "branch"
        },
        {
            "site_name": "Office",
            "scope-id": "12345678901",
            "site_type": "campus"
        }
    ]
}

SAMPLE_ROLES = {
    "data": [
        {
            "name": "authenticated",
            "vlan-parameters": {"access-vlan": 10}
        },
        {
            "name": "guest",
            "vlan-parameters": {"access-vlan": 20}
        }
    ]
}

SAMPLE_TOKEN_RESPONSE = {
    "access_token": TEST_ACCESS_TOKEN,
    "token_type": "Bearer",
    "expires_in": 7200
}


# =============================================================================
# Fixtures
# =============================================================================

@pytest.fixture
def mock_token_response():
    """Return a mock token response dictionary."""
    return SAMPLE_TOKEN_RESPONSE.copy()


@pytest.fixture
def mock_devices_response():
    """Return a mock devices response dictionary."""
    return SAMPLE_DEVICES.copy()


@pytest.fixture
def mock_wlans_response():
    """Return a mock WLANs response dictionary."""
    return SAMPLE_WLANS.copy()


@pytest.fixture
def mock_sites_response():
    """Return a mock sites response dictionary."""
    return SAMPLE_SITES.copy()


@pytest.fixture
def temp_token_cache(tmp_path):
    """Create a temporary token cache file with valid token data.

    Returns:
        Path to the temporary token cache file
    """
    import time

    cache_file = tmp_path / ".token_cache_test.json"
    cache_data = {
        "access_token": TEST_ACCESS_TOKEN,
        "expires_at": time.time() + 7200,  # 2 hours from now
        "cached_at": time.time()
    }

    with open(cache_file, "w") as f:
        json.dump(cache_data, f)

    return cache_file


@pytest.fixture
def expired_token_cache(tmp_path):
    """Create a temporary token cache file with expired token.

    Returns:
        Path to the temporary token cache file
    """
    import time

    cache_file = tmp_path / ".token_cache_expired.json"
    cache_data = {
        "access_token": "expired-token",
        "expires_at": time.time() - 3600,  # Expired 1 hour ago
        "cached_at": time.time() - 7200
    }

    with open(cache_file, "w") as f:
        json.dump(cache_data, f)

    return cache_file


@pytest.fixture
def mock_config():
    """Return a mock configuration dictionary."""
    return {
        "aruba_central": {
            "base_url": TEST_BASE_URL,
            "client_id": TEST_CLIENT_ID,
            "client_secret": TEST_CLIENT_SECRET,
            "customer_id": "test-customer-id"
        }
    }


@pytest.fixture
def mock_token_manager():
    """Create a mock TokenManager that returns a test token."""
    mock = MagicMock()
    mock.get_access_token.return_value = TEST_ACCESS_TOKEN
    mock.is_token_valid.return_value = True
    return mock


@pytest.fixture
def api_client(mock_token_manager):
    """Create a CentralAPIClient with mocked token manager."""
    from utils.central_api_client import CentralAPIClient

    return CentralAPIClient(
        base_url=TEST_BASE_URL,
        token_manager=mock_token_manager
    )


@pytest.fixture
def token_manager(tmp_path):
    """Create a TokenManager with temporary cache file."""
    from utils.token_manager import TokenManager

    cache_file = tmp_path / ".token_cache_test.json"

    return TokenManager(
        client_id=TEST_CLIENT_ID,
        client_secret=TEST_CLIENT_SECRET,
        cache_file=str(cache_file)
    )


@pytest.fixture
def responses_mock():
    """Activate responses mock for HTTP requests.

    Use this fixture to mock HTTP responses in tests:

        def test_api_call(responses_mock):
            responses_mock.add(
                responses.GET,
                "https://api.example.com/endpoint",
                json={"key": "value"},
                status=200
            )
    """
    with responses.RequestsMock() as rsps:
        yield rsps


@pytest.fixture
def mock_env_vars(monkeypatch):
    """Set up mock environment variables for testing."""
    monkeypatch.setenv("ARUBA_CLIENT_ID", TEST_CLIENT_ID)
    monkeypatch.setenv("ARUBA_CLIENT_SECRET", TEST_CLIENT_SECRET)
    monkeypatch.setenv("ARUBA_BASE_URL", TEST_BASE_URL)


# =============================================================================
# Helper Functions for Tests
# =============================================================================

def add_token_endpoint(rsps, token_data=None, status=200):
    """Add a mock token endpoint to responses.

    Args:
        rsps: responses.RequestsMock instance
        token_data: Token response data (defaults to SAMPLE_TOKEN_RESPONSE)
        status: HTTP status code
    """
    rsps.add(
        responses.POST,
        TEST_TOKEN_URL,
        json=token_data or SAMPLE_TOKEN_RESPONSE,
        status=status
    )


def add_api_endpoint(rsps, method, endpoint, response_data, status=200):
    """Add a mock API endpoint to responses.

    Args:
        rsps: responses.RequestsMock instance
        method: HTTP method (GET, POST, PUT, DELETE)
        endpoint: API endpoint path
        response_data: Response JSON data
        status: HTTP status code
    """
    method_map = {
        "GET": responses.GET,
        "POST": responses.POST,
        "PUT": responses.PUT,
        "PATCH": responses.PATCH,
        "DELETE": responses.DELETE
    }

    rsps.add(
        method_map[method.upper()],
        f"{TEST_BASE_URL}{endpoint}",
        json=response_data,
        status=status
    )
