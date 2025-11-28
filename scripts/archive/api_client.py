"""Aruba Central API client."""

import requests
import time
from typing import Dict, Any, Optional
import logging
from .token_cache import TokenCache

logger = logging.getLogger(__name__)


class ArubaClient:
    """Client for interacting with Aruba Central API."""

    def __init__(
        self,
        base_url: str,
        client_id: str,
        client_secret: str,
        customer_id: str,
        username: Optional[str] = None,
        password: Optional[str] = None,
    ):
        """Initialize the Aruba Central API client.

        Args:
            base_url: Base URL for Aruba Central API (e.g., https://apigw-prod2.central.arubanetworks.com)
            client_id: OAuth2 client ID
            client_secret: OAuth2 client secret
            customer_id: Aruba Central customer ID
            username: Username for authentication (optional)
            password: Password for authentication (optional)
        """
        self.base_url = base_url.rstrip("/")
        self.client_id = client_id
        self.client_secret = client_secret
        self.customer_id = customer_id
        self.username = username
        self.password = password
        self.access_token: Optional[str] = None
        self.refresh_token: Optional[str] = None
        self.session = requests.Session()
        self.token_cache = TokenCache()

        # Try to load cached tokens
        cached_tokens = self.token_cache.load_tokens()
        if cached_tokens:
            self.access_token = cached_tokens.get("access_token")
            self.refresh_token = cached_tokens.get("refresh_token")
            if self.access_token:
                self.session.headers.update({"Authorization": f"Bearer {self.access_token}"})
                logger.info("Loaded access token from cache")

    def authenticate(self) -> None:
        """Authenticate using OAuth2 authorization code flow (3-step process)."""
        if not self.username or not self.password:
            raise ValueError("Username and password are required for Aruba Central authentication")

        # Step 1: Login and get session
        login_url = f"{self.base_url}/oauth2/authorize/central/api/login"
        login_params = {"client_id": self.client_id}
        login_data = {
            "username": self.username,
            "password": self.password
        }

        login_response = requests.post(login_url, params=login_params, json=login_data)
        login_response.raise_for_status()

        # Extract CSRF token and session from cookies
        csrf_token = None
        session_cookie = None
        for cookie in login_response.cookies:
            if cookie.name == "csrftoken":
                csrf_token = cookie.value
            elif cookie.name == "session":
                session_cookie = cookie.value

        if not csrf_token or not session_cookie:
            raise Exception("Failed to obtain session cookies from login")

        # Step 2: Get authorization code
        auth_url = f"{self.base_url}/oauth2/authorize/central/api"
        auth_params = {
            "client_id": self.client_id,
            "response_type": "code",
            "scope": "all"
        }
        auth_headers = {
            "X-CSRF-Token": csrf_token,
            "Cookie": f"session={session_cookie}"
        }
        auth_data = {"customer_id": self.customer_id}

        auth_response = requests.post(auth_url, params=auth_params, headers=auth_headers, json=auth_data)
        auth_response.raise_for_status()
        auth_code = auth_response.json().get("auth_code")

        if not auth_code:
            raise Exception("Failed to obtain authorization code")

        # Step 3: Exchange authorization code for access token
        token_url = f"{self.base_url}/oauth2/token"
        token_data = {
            "client_id": self.client_id,
            "client_secret": self.client_secret,
            "grant_type": "authorization_code",
            "code": auth_code
        }

        token_response = requests.post(token_url, data=token_data)
        token_response.raise_for_status()
        token_json = token_response.json()

        self.access_token = token_json["access_token"]
        self.refresh_token = token_json.get("refresh_token")
        self.session.headers.update({"Authorization": f"Bearer {self.access_token}"})

        # Cache the tokens
        self.token_cache.save_tokens(
            self.access_token,
            self.refresh_token,
            token_json.get("expires_in", 7200)
        )

        logger.info("Successfully authenticated with Aruba Central")

    def refresh_access_token(self) -> None:
        """Refresh the access token using refresh token."""
        if not hasattr(self, 'refresh_token') or not self.refresh_token:
            # If no refresh token, do full authentication
            self.authenticate()
            return

        token_url = f"{self.base_url}/oauth2/token"
        token_data = {
            "client_id": self.client_id,
            "client_secret": self.client_secret,
            "grant_type": "refresh_token",
            "refresh_token": self.refresh_token
        }

        token_response = requests.post(token_url, data=token_data)
        token_response.raise_for_status()
        token_json = token_response.json()

        self.access_token = token_json["access_token"]
        self.refresh_token = token_json.get("refresh_token", self.refresh_token)
        self.session.headers.update({"Authorization": f"Bearer {self.access_token}"})

        # Cache the new tokens
        self.token_cache.save_tokens(
            self.access_token,
            self.refresh_token,
            token_json.get("expires_in", 7200)
        )

        logger.info("Successfully refreshed access token")

    def _request(
        self, method: str, endpoint: str, params: Optional[Dict] = None, json: Optional[Dict] = None,
        max_retries: int = 3, retry_on_rate_limit: bool = True
    ) -> Dict[str, Any]:
        """Make an authenticated API request with automatic retry on rate limiting.

        Args:
            method: HTTP method (GET, POST, PUT, DELETE)
            endpoint: API endpoint (without base URL)
            params: Query parameters
            json: JSON body for POST/PUT requests
            max_retries: Maximum number of retries for rate limit errors (default: 3)
            retry_on_rate_limit: Whether to retry on 429 rate limit errors (default: True)

        Returns:
            Response JSON data

        Raises:
            requests.HTTPError: If the request fails after all retries
        """
        if not self.access_token:
            self.authenticate()

        url = f"{self.base_url}/{endpoint.lstrip('/')}"

        # Retry logic for rate limiting
        retry_delay = 60  # Start with 1 minute
        for attempt in range(max_retries + 1):
            try:
                response = self.session.request(method, url, params=params, json=json)
                response.raise_for_status()
                return response.json()
            except requests.HTTPError as e:
                if e.response.status_code == 429 and retry_on_rate_limit and attempt < max_retries:
                    # Rate limit error - retry with exponential backoff
                    logger.warning(
                        f"Rate limit (429) hit on {method} {endpoint}. "
                        f"Waiting {retry_delay}s before retry {attempt + 1}/{max_retries}"
                    )
                    time.sleep(retry_delay)
                    retry_delay = min(int(retry_delay * 1.5), 300)  # Cap at 5 minutes
                elif e.response.status_code == 401:
                    # Token expired - try to refresh once
                    if attempt == 0:
                        logger.info("Token expired (401), attempting refresh...")
                        self.refresh_access_token()
                    else:
                        raise
                else:
                    # Other errors or max retries reached - re-raise
                    raise

    def get(self, endpoint: str, params: Optional[Dict] = None) -> Dict[str, Any]:
        """Make a GET request."""
        return self._request("GET", endpoint, params=params)

    def post(self, endpoint: str, json: Optional[Dict] = None) -> Dict[str, Any]:
        """Make a POST request."""
        return self._request("POST", endpoint, json=json)

    def put(self, endpoint: str, json: Optional[Dict] = None) -> Dict[str, Any]:
        """Make a PUT request."""
        return self._request("PUT", endpoint, json=json)

    def delete(self, endpoint: str) -> Dict[str, Any]:
        """Make a DELETE request."""
        return self._request("DELETE", endpoint)
