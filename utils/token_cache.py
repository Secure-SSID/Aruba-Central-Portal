"""Token caching utilities to avoid rate limits."""

import json
import time
from pathlib import Path
from typing import Optional, Dict


class TokenCache:
    """Manages caching of access and refresh tokens."""

    def __init__(self, cache_file: str = ".token_cache_legacy.json"):
        """Initialize token cache.

        Args:
            cache_file: Path to cache file (should be in .gitignore)
        """
        self.cache_file = Path(cache_file)

    def save_tokens(self, access_token: str, refresh_token: Optional[str] = None, expires_in: int = 7200) -> None:
        """Save tokens to cache file.

        Args:
            access_token: Access token
            refresh_token: Refresh token (optional)
            expires_in: Token expiry time in seconds (default 7200 = 2 hours)
        """
        cache_data = {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "expires_at": time.time() + expires_in - 300  # 5 min buffer
        }

        with open(self.cache_file, "w") as f:
            json.dump(cache_data, f)

    def load_tokens(self) -> Optional[Dict[str, str]]:
        """Load tokens from cache if valid.

        Returns:
            Dictionary with access_token and refresh_token, or None if expired/missing
        """
        if not self.cache_file.exists():
            return None

        try:
            with open(self.cache_file, "r") as f:
                cache_data = json.load(f)

            # Check if token is still valid
            if cache_data.get("expires_at", 0) > time.time():
                return {
                    "access_token": cache_data.get("access_token"),
                    "refresh_token": cache_data.get("refresh_token")
                }
        except (json.JSONDecodeError, IOError):
            pass

        return None

    def clear(self) -> None:
        """Clear the token cache."""
        if self.cache_file.exists():
            self.cache_file.unlink()
