"""Tests for TokenManager."""

import json
import time
import pytest
import responses
from pathlib import Path
from unittest.mock import patch

from utils.token_manager import TokenManager
from tests.conftest import (
    TEST_TOKEN_URL,
    TEST_CLIENT_ID,
    TEST_CLIENT_SECRET,
    TEST_ACCESS_TOKEN,
    SAMPLE_TOKEN_RESPONSE,
    add_token_endpoint,
)


class TestTokenManagerInit:
    """Tests for TokenManager initialization."""

    def test_init_creates_manager(self, tmp_path):
        """Test basic initialization."""
        cache_file = tmp_path / ".token_cache.json"

        manager = TokenManager(
            client_id=TEST_CLIENT_ID,
            client_secret=TEST_CLIENT_SECRET,
            cache_file=str(cache_file)
        )

        assert manager.client_id == TEST_CLIENT_ID
        assert manager.client_secret == TEST_CLIENT_SECRET
        assert manager.cache_file == cache_file

    def test_init_loads_valid_cached_token(self, temp_token_cache):
        """Test that valid cached token is loaded on init."""
        manager = TokenManager(
            client_id=TEST_CLIENT_ID,
            client_secret=TEST_CLIENT_SECRET,
            cache_file=str(temp_token_cache)
        )

        assert manager.access_token == TEST_ACCESS_TOKEN
        assert manager.is_token_valid()

    def test_init_discards_expired_cached_token(self, expired_token_cache):
        """Test that expired cached token is discarded."""
        manager = TokenManager(
            client_id=TEST_CLIENT_ID,
            client_secret=TEST_CLIENT_SECRET,
            cache_file=str(expired_token_cache)
        )

        assert manager.access_token is None
        assert not manager.is_token_valid()

    def test_init_without_cache_file(self, tmp_path):
        """Test initialization when cache file doesn't exist."""
        cache_file = tmp_path / "nonexistent.json"

        manager = TokenManager(
            client_id=TEST_CLIENT_ID,
            client_secret=TEST_CLIENT_SECRET,
            cache_file=str(cache_file)
        )

        assert manager.access_token is None


class TestTokenManagerGetToken:
    """Tests for TokenManager.get_access_token()."""

    @responses.activate
    def test_get_token_refreshes_when_no_token(self, tmp_path):
        """Test that token is refreshed when no cached token exists."""
        cache_file = tmp_path / ".token_cache.json"
        add_token_endpoint(responses)

        manager = TokenManager(
            client_id=TEST_CLIENT_ID,
            client_secret=TEST_CLIENT_SECRET,
            cache_file=str(cache_file)
        )

        token = manager.get_access_token()

        assert token == TEST_ACCESS_TOKEN
        assert len(responses.calls) == 1

    @responses.activate
    def test_get_token_uses_cached_token(self, temp_token_cache):
        """Test that valid cached token is returned without API call."""
        manager = TokenManager(
            client_id=TEST_CLIENT_ID,
            client_secret=TEST_CLIENT_SECRET,
            cache_file=str(temp_token_cache)
        )

        token = manager.get_access_token()

        assert token == TEST_ACCESS_TOKEN
        assert len(responses.calls) == 0  # No API call made

    @responses.activate
    def test_get_token_force_refresh(self, temp_token_cache):
        """Test force refresh bypasses cache."""
        new_token = "new-refreshed-token"
        responses.add(
            responses.POST,
            TEST_TOKEN_URL,
            json={
                "access_token": new_token,
                "token_type": "Bearer",
                "expires_in": 7200
            },
            status=200
        )

        manager = TokenManager(
            client_id=TEST_CLIENT_ID,
            client_secret=TEST_CLIENT_SECRET,
            cache_file=str(temp_token_cache)
        )

        token = manager.get_access_token(force_refresh=True)

        assert token == new_token
        assert len(responses.calls) == 1

    @responses.activate
    def test_get_token_refreshes_near_expiry(self, tmp_path):
        """Test token refresh when within 5-minute buffer of expiry."""
        cache_file = tmp_path / ".token_cache.json"

        # Create cache with token expiring in 4 minutes (within 5-min buffer)
        cache_data = {
            "access_token": "expiring-soon-token",
            "expires_at": time.time() + 240,  # 4 minutes
            "cached_at": time.time()
        }
        with open(cache_file, "w") as f:
            json.dump(cache_data, f)

        add_token_endpoint(responses)

        manager = TokenManager(
            client_id=TEST_CLIENT_ID,
            client_secret=TEST_CLIENT_SECRET,
            cache_file=str(cache_file)
        )

        token = manager.get_access_token()

        # Should have refreshed since within buffer
        assert token == TEST_ACCESS_TOKEN
        assert len(responses.calls) == 1


class TestTokenManagerCaching:
    """Tests for token caching behavior."""

    @responses.activate
    def test_token_saved_to_cache(self, tmp_path):
        """Test that refreshed token is saved to cache file."""
        cache_file = tmp_path / ".token_cache.json"
        add_token_endpoint(responses)

        manager = TokenManager(
            client_id=TEST_CLIENT_ID,
            client_secret=TEST_CLIENT_SECRET,
            cache_file=str(cache_file)
        )

        manager.get_access_token()

        # Verify cache file was created
        assert cache_file.exists()

        # Verify cache contents
        with open(cache_file) as f:
            cache_data = json.load(f)

        assert cache_data["access_token"] == TEST_ACCESS_TOKEN
        assert "expires_at" in cache_data
        assert "cached_at" in cache_data

    @responses.activate
    def test_cache_directory_from_env(self, tmp_path, monkeypatch):
        """Test cache directory can be set via environment variable."""
        cache_dir = tmp_path / "custom_cache"
        monkeypatch.setenv("TOKEN_CACHE_DIR", str(cache_dir))
        add_token_endpoint(responses)

        manager = TokenManager(
            client_id=TEST_CLIENT_ID,
            client_secret=TEST_CLIENT_SECRET,
            cache_file=".token_cache.json"
        )

        manager.get_access_token()

        # Verify cache was created in custom directory
        expected_cache = cache_dir / ".token_cache.json"
        assert expected_cache.exists()


class TestTokenManagerIsValid:
    """Tests for TokenManager.is_token_valid()."""

    def test_is_valid_with_valid_token(self, temp_token_cache):
        """Test is_token_valid returns True for valid token."""
        manager = TokenManager(
            client_id=TEST_CLIENT_ID,
            client_secret=TEST_CLIENT_SECRET,
            cache_file=str(temp_token_cache)
        )

        assert manager.is_token_valid() is True

    def test_is_valid_with_expired_token(self, expired_token_cache):
        """Test is_token_valid returns False for expired token."""
        manager = TokenManager(
            client_id=TEST_CLIENT_ID,
            client_secret=TEST_CLIENT_SECRET,
            cache_file=str(expired_token_cache)
        )

        assert manager.is_token_valid() is False

    def test_is_valid_with_no_token(self, tmp_path):
        """Test is_token_valid returns False when no token."""
        cache_file = tmp_path / "nonexistent.json"

        manager = TokenManager(
            client_id=TEST_CLIENT_ID,
            client_secret=TEST_CLIENT_SECRET,
            cache_file=str(cache_file)
        )

        assert manager.is_token_valid() is False


class TestTokenManagerGetInfo:
    """Tests for TokenManager.get_token_info()."""

    def test_get_info_with_valid_token(self, temp_token_cache):
        """Test get_token_info with valid token."""
        manager = TokenManager(
            client_id=TEST_CLIENT_ID,
            client_secret=TEST_CLIENT_SECRET,
            cache_file=str(temp_token_cache)
        )

        info = manager.get_token_info()

        assert info["has_token"] is True
        assert info["is_valid"] is True
        assert info["expires_at"] is not None
        assert info["expires_in_seconds"] > 0
        assert info["expires_in_minutes"] > 0

    def test_get_info_without_token(self, tmp_path):
        """Test get_token_info without token."""
        cache_file = tmp_path / "nonexistent.json"

        manager = TokenManager(
            client_id=TEST_CLIENT_ID,
            client_secret=TEST_CLIENT_SECRET,
            cache_file=str(cache_file)
        )

        info = manager.get_token_info()

        assert info["has_token"] is False
        assert info["is_valid"] is False


class TestTokenManagerRefreshErrors:
    """Tests for token refresh error handling."""

    @responses.activate
    def test_refresh_failure_raises_exception(self, tmp_path):
        """Test that refresh failure raises exception."""
        cache_file = tmp_path / ".token_cache.json"

        responses.add(
            responses.POST,
            TEST_TOKEN_URL,
            json={"error": "invalid_client"},
            status=401
        )

        manager = TokenManager(
            client_id=TEST_CLIENT_ID,
            client_secret=TEST_CLIENT_SECRET,
            cache_file=str(cache_file)
        )

        with pytest.raises(Exception, match="Token refresh failed"):
            manager.get_access_token()

    @responses.activate
    def test_refresh_timeout(self, tmp_path):
        """Test handling of token refresh timeout."""
        cache_file = tmp_path / ".token_cache.json"

        responses.add(
            responses.POST,
            TEST_TOKEN_URL,
            body=Exception("Connection timeout")
        )

        manager = TokenManager(
            client_id=TEST_CLIENT_ID,
            client_secret=TEST_CLIENT_SECRET,
            cache_file=str(cache_file)
        )

        with pytest.raises(Exception):
            manager.get_access_token()
