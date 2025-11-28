"""Tests for CentralAPIClient."""

import pytest
import responses
import time
from unittest.mock import MagicMock, patch, call
from requests.exceptions import HTTPError

from utils.central_api_client import CentralAPIClient
from tests.conftest import (
    TEST_BASE_URL,
    TEST_ACCESS_TOKEN,
    SAMPLE_DEVICES,
    SAMPLE_WLANS,
    add_api_endpoint,
)


class TestCentralAPIClientInit:
    """Tests for CentralAPIClient initialization."""

    def test_init_with_token_manager(self, mock_token_manager):
        """Test initialization with a token manager."""
        client = CentralAPIClient(
            base_url=TEST_BASE_URL,
            token_manager=mock_token_manager
        )

        assert client.base_url == TEST_BASE_URL
        assert client.token_manager == mock_token_manager
        mock_token_manager.get_access_token.assert_called_once()

    def test_init_with_static_token(self):
        """Test initialization with a static access token."""
        client = CentralAPIClient(
            base_url=TEST_BASE_URL,
            access_token=TEST_ACCESS_TOKEN
        )

        assert client.base_url == TEST_BASE_URL
        assert client.token_manager is None
        assert f"Bearer {TEST_ACCESS_TOKEN}" in client.session.headers["Authorization"]

    def test_init_without_token_raises_error(self):
        """Test that initialization without any token raises ValueError."""
        with pytest.raises(ValueError, match="Either access_token or token_manager must be provided"):
            CentralAPIClient(base_url=TEST_BASE_URL)

    def test_base_url_trailing_slash_stripped(self, mock_token_manager):
        """Test that trailing slash is stripped from base URL."""
        client = CentralAPIClient(
            base_url=f"{TEST_BASE_URL}/",
            token_manager=mock_token_manager
        )

        assert client.base_url == TEST_BASE_URL


class TestCentralAPIClientGet:
    """Tests for CentralAPIClient GET requests."""

    @responses.activate
    def test_get_success(self, api_client, mock_devices_response):
        """Test successful GET request."""
        add_api_endpoint(
            responses,
            "GET",
            "/monitoring/v1/devices",
            mock_devices_response
        )

        result = api_client.get("/monitoring/v1/devices")

        assert result == mock_devices_response
        assert len(responses.calls) == 1

    @responses.activate
    def test_get_with_params(self, api_client, mock_devices_response):
        """Test GET request with query parameters."""
        add_api_endpoint(
            responses,
            "GET",
            "/monitoring/v1/devices",
            mock_devices_response
        )

        result = api_client.get(
            "/monitoring/v1/devices",
            params={"limit": 10, "offset": 0}
        )

        assert result == mock_devices_response
        assert "limit=10" in responses.calls[0].request.url

    @responses.activate
    def test_get_empty_response(self, api_client):
        """Test GET request that returns empty body."""
        responses.add(
            responses.GET,
            f"{TEST_BASE_URL}/api/empty",
            body="",
            status=200
        )

        result = api_client.get("/api/empty")

        assert result == {}

    @responses.activate
    def test_get_404_raises_error(self, api_client):
        """Test that 404 raises HTTPError."""
        responses.add(
            responses.GET,
            f"{TEST_BASE_URL}/api/notfound",
            json={"error": "Not found"},
            status=404
        )

        with pytest.raises(HTTPError):
            api_client.get("/api/notfound")


class TestCentralAPIClientPost:
    """Tests for CentralAPIClient POST requests."""

    @responses.activate
    def test_post_success(self, api_client):
        """Test successful POST request."""
        response_data = {"status": "created", "id": "12345"}
        add_api_endpoint(
            responses,
            "POST",
            "/api/resource",
            response_data
        )

        result = api_client.post(
            "/api/resource",
            data={"name": "test"}
        )

        assert result == response_data
        assert len(responses.calls) == 1

    @responses.activate
    def test_post_with_params(self, api_client):
        """Test POST request with query parameters."""
        response_data = {"status": "created"}
        add_api_endpoint(
            responses,
            "POST",
            "/api/resource",
            response_data
        )

        result = api_client.post(
            "/api/resource",
            data={"name": "test"},
            params={"object_type": "SHARED"}
        )

        assert "object_type=SHARED" in responses.calls[0].request.url


class TestCentralAPIClientDelete:
    """Tests for CentralAPIClient DELETE requests."""

    @responses.activate
    def test_delete_success(self, api_client):
        """Test successful DELETE request."""
        response_data = {"status": "deleted"}
        add_api_endpoint(
            responses,
            "DELETE",
            "/api/resource/123",
            response_data
        )

        result = api_client.delete("/api/resource/123")

        assert result == response_data


class TestCentralAPIClientRateLimiting:
    """Tests for 429 rate limit retry behavior."""

    @responses.activate
    def test_retry_on_429(self, api_client, mock_devices_response):
        """Test automatic retry on 429 rate limit."""
        # First call returns 429, second succeeds
        responses.add(
            responses.GET,
            f"{TEST_BASE_URL}/api/endpoint",
            json={"error": "rate limited"},
            status=429
        )
        responses.add(
            responses.GET,
            f"{TEST_BASE_URL}/api/endpoint",
            json=mock_devices_response,
            status=200
        )

        # Patch time.sleep to avoid actual delays in tests
        with patch("time.sleep"):
            result = api_client.get("/api/endpoint")

        assert result == mock_devices_response
        assert len(responses.calls) == 2

    @responses.activate
    def test_max_retries_exceeded(self, api_client):
        """Test that error is raised after max retries."""
        # All calls return 429
        for _ in range(4):
            responses.add(
                responses.GET,
                f"{TEST_BASE_URL}/api/endpoint",
                json={"error": "rate limited"},
                status=429
            )

        with patch("time.sleep"):
            with pytest.raises(HTTPError):
                api_client.get("/api/endpoint")

        # 1 initial + 3 retries = 4 calls
        assert len(responses.calls) == 4

    @responses.activate
    def test_exponential_backoff(self, api_client):
        """Test that retry delays increase exponentially."""
        # All calls return 429
        for _ in range(4):
            responses.add(
                responses.GET,
                f"{TEST_BASE_URL}/api/endpoint",
                json={"error": "rate limited"},
                status=429
            )

        with patch("time.sleep") as mock_sleep:
            with pytest.raises(HTTPError):
                api_client.get("/api/endpoint")

            # Check sleep was called with increasing delays
            # Initial delay is 60, then 60*1.5=90, then 90*1.5=135
            calls = mock_sleep.call_args_list
            assert len(calls) == 3
            assert calls[0] == call(60)
            assert calls[1] == call(90)
            assert calls[2] == call(135)


class TestCentralAPIClientTokenRefresh:
    """Tests for token refresh behavior."""

    @responses.activate
    def test_token_refresh_before_request(self, mock_devices_response):
        """Test that token is refreshed before each request."""
        mock_manager = MagicMock()
        mock_manager.get_access_token.return_value = TEST_ACCESS_TOKEN

        client = CentralAPIClient(
            base_url=TEST_BASE_URL,
            token_manager=mock_manager
        )

        add_api_endpoint(
            responses,
            "GET",
            "/api/endpoint",
            mock_devices_response
        )

        client.get("/api/endpoint")

        # Token manager should be called during init and before request
        assert mock_manager.get_access_token.call_count >= 2


class TestCentralAPIClientHTTPMethods:
    """Test all HTTP method wrappers."""

    @responses.activate
    def test_put_method(self, api_client):
        """Test PUT request."""
        response_data = {"status": "updated"}
        add_api_endpoint(
            responses,
            "PUT",
            "/api/resource/123",
            response_data
        )

        result = api_client.put(
            "/api/resource/123",
            data={"name": "updated"}
        )

        assert result == response_data

    @responses.activate
    def test_patch_method(self, api_client):
        """Test PATCH request."""
        response_data = {"status": "patched"}
        add_api_endpoint(
            responses,
            "PATCH",
            "/api/resource/123",
            response_data
        )

        result = api_client.patch(
            "/api/resource/123",
            data={"name": "patched"}
        )

        assert result == response_data
