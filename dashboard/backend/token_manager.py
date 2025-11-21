"""
Token Manager for HPE Aruba Central API
Handles automatic token refresh using client credentials
"""

import requests
import logging
import time
import json
from pathlib import Path
from typing import Optional, Dict, Any
from datetime import datetime, timedelta
import os

logger = logging.getLogger(__name__)


class TokenManager:
    """Manages OAuth2 tokens for HPE Aruba Central API."""

    def __init__(
        self,
        client_id: str,
        client_secret: str,
        token_url: str = "https://sso.common.cloud.hpe.com/as/token.oauth2",
        cache_file: str = ".token_cache_central.json",
    ):
        """Initialize the token manager.

        Args:
            client_id: OAuth2 client ID
            client_secret: OAuth2 client secret
            token_url: Token endpoint URL
            cache_file: Path to token cache file
        """
        self.client_id = client_id
        self.client_secret = client_secret
        self.token_url = token_url
        # Resolve cache location, prefer TOKEN_CACHE_DIR if provided (e.g., /app/data)
        token_cache_dir = os.environ.get("TOKEN_CACHE_DIR")
        if token_cache_dir:
            try:
                Path(token_cache_dir).mkdir(parents=True, exist_ok=True)
                self.cache_file = Path(token_cache_dir) / Path(cache_file).name
            except Exception:
                # Fall back to current working directory
                self.cache_file = Path(cache_file)
        else:
            self.cache_file = Path(cache_file)
        self.access_token: Optional[str] = None
        self.token_expires_at: Optional[float] = None

        # Try to load cached token
        self._load_cached_token()

    def _load_cached_token(self) -> None:
        """Load token from cache file if it exists and is valid."""
        if not self.cache_file.exists():
            logger.debug("No token cache file found")
            return

        try:
            with open(self.cache_file, "r") as f:
                cache_data = json.load(f)

            self.access_token = cache_data.get("access_token")
            self.token_expires_at = cache_data.get("expires_at")

            # Check if token is still valid (with 5 minute buffer)
            if self.token_expires_at and time.time() < (self.token_expires_at - 300):
                logger.info("Loaded valid token from cache")
            else:
                logger.info("Cached token is expired")
                self.access_token = None
                self.token_expires_at = None

        except Exception as e:
            logger.warning(f"Failed to load token cache: {e}")
            self.access_token = None
            self.token_expires_at = None

    def _save_token_to_cache(self) -> None:
        """Save current token to cache file."""
        try:
            cache_data = {
                "access_token": self.access_token,
                "expires_at": self.token_expires_at,
                "cached_at": time.time(),
            }

            with open(self.cache_file, "w") as f:
                json.dump(cache_data, f, indent=2)

            logger.debug("Token saved to cache")

        except Exception as e:
            logger.warning(f"Failed to save token to cache: {e}")

    def get_access_token(self, force_refresh: bool = False) -> str:
        """Get a valid access token, refreshing if necessary.

        Args:
            force_refresh: Force token refresh even if cached token is valid

        Returns:
            Valid access token

        Raises:
            Exception: If token refresh fails
        """
        # Check if we need to refresh
        needs_refresh = (
            force_refresh
            or not self.access_token
            or not self.token_expires_at
            or time.time() >= (self.token_expires_at - 300)  # 5 minute buffer
        )

        if needs_refresh:
            self._refresh_token()

        return self.access_token

    def _refresh_token(self) -> None:
        """Refresh the access token using client credentials flow."""
        logger.info("Refreshing access token...")

        try:
            response = requests.post(
                self.token_url,
                data={
                    "grant_type": "client_credentials",
                    "client_id": self.client_id,
                    "client_secret": self.client_secret,
                },
                headers={"Content-Type": "application/x-www-form-urlencoded"},
                timeout=30,
            )

            response.raise_for_status()
            token_data = response.json()

            self.access_token = token_data["access_token"]
            expires_in = token_data.get("expires_in", 7200)  # Default 2 hours
            self.token_expires_at = time.time() + expires_in

            # Save to cache
            self._save_token_to_cache()

            expires_at_str = datetime.fromtimestamp(self.token_expires_at).strftime(
                "%Y-%m-%d %H:%M:%S"
            )
            logger.info(f"Token refreshed successfully. Expires at: {expires_at_str}")

        except requests.exceptions.RequestException as e:
            logger.error(f"Failed to refresh token: {e}")
            raise Exception(f"Token refresh failed: {e}")

    def is_token_valid(self) -> bool:
        """Check if current token is valid.

        Returns:
            True if token is valid, False otherwise
        """
        if not self.access_token or not self.token_expires_at:
            return False

        # Check with 5 minute buffer
        return time.time() < (self.token_expires_at - 300)

    def get_token_info(self) -> Dict[str, Any]:
        """Get information about the current token.

        Returns:
            Dictionary with token information
        """
        if not self.access_token:
            return {
                "has_token": False,
                "is_valid": False,
            }

        time_until_expiry = None
        expires_at_str = None

        if self.token_expires_at:
            time_until_expiry = max(0, self.token_expires_at - time.time())
            expires_at_str = datetime.fromtimestamp(self.token_expires_at).strftime(
                "%Y-%m-%d %H:%M:%S"
            )

        return {
            "has_token": True,
            "is_valid": self.is_token_valid(),
            "expires_at": expires_at_str,
            "expires_in_seconds": int(time_until_expiry) if time_until_expiry else 0,
            "expires_in_minutes": (
                int(time_until_expiry / 60) if time_until_expiry else 0
            ),
        }
