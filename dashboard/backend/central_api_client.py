"""
Simplified Aruba Central API client for Bearer Token authentication.
Used for the new Central API that uses direct bearer tokens with automatic refresh.
"""

import requests
import logging
from typing import Dict, Any, Optional
from token_manager import TokenManager

logger = logging.getLogger(__name__)


class CentralAPIClient:
    """Client for interacting with new Aruba Central API using Bearer tokens."""

    def __init__(
        self,
        base_url: str,
        access_token: Optional[str] = None,
        token_manager: Optional[TokenManager] = None,
    ):
        """Initialize the Central API client.

        Args:
            base_url: Base URL for Central API (e.g., https://internal.api.central.arubanetworks.com)
            access_token: Bearer access token (optional if token_manager provided)
            token_manager: TokenManager instance for automatic token refresh
        """
        self.base_url = base_url.rstrip("/")
        self.token_manager = token_manager
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})

        if token_manager:
            # Get fresh token from manager
            access_token = token_manager.get_access_token()
            logger.info("Central API client initialized with token manager")
        elif access_token:
            logger.info("Central API client initialized with static bearer token")
        else:
            raise ValueError("Either access_token or token_manager must be provided")

        self._update_token(access_token)

    def _update_token(self, access_token: str) -> None:
        """Update the authorization header with a new token."""
        self.session.headers.update({
            "Authorization": f"Bearer {access_token}"
        })

    def _ensure_valid_token(self) -> None:
        """Ensure we have a valid token, refreshing if necessary."""
        if self.token_manager:
            access_token = self.token_manager.get_access_token()
            self._update_token(access_token)

    def get(self, endpoint: str, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Make a GET request to the API.

        Args:
            endpoint: API endpoint path (e.g., /network-monitoring/v1alpha1/aps)
            params: Optional query parameters

        Returns:
            Response JSON data

        Raises:
            requests.HTTPError: If the request fails
        """
        self._ensure_valid_token()
        url = f"{self.base_url}{endpoint}"
        logger.info(f"GET {url} with params: {params}")

        response = self.session.get(url, params=params)
        
        # Log response details for debugging
        logger.debug(f"Response status: {response.status_code}")
        logger.debug(f"Response headers: {dict(response.headers)}")
        logger.debug(f"Response content length: {len(response.content) if response.content else 0}")
        
        if response.status_code >= 400:
            logger.error(f"API Error {response.status_code}: {response.text[:500]}")
        
        response.raise_for_status()

        # Handle empty responses
        if not response.text or response.text.strip() == '':
            logger.warning(f"Empty response body from {url}")
            return {}
        
        try:
            json_data = response.json()
            if json_data is None:
                logger.warning(f"response.json() returned None for {url}")
                logger.warning(f"Response text was: {response.text[:200]}")
                return {}
            logger.debug(f"Parsed JSON data type: {type(json_data)}, keys: {list(json_data.keys()) if isinstance(json_data, dict) else 'not a dict'}")
            return json_data
        except ValueError as e:
            logger.error(f"Failed to parse JSON response from {url}: {e}")
            logger.error(f"Response text (first 500 chars): {response.text[:500]}")
            return {}

    def post(
        self,
        endpoint: str,
        data: Optional[Dict[str, Any]] = None,
        params: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Make a POST request to the API.

        Args:
            endpoint: API endpoint path
            data: Request body data
            params: Optional query parameters

        Returns:
            Response JSON data

        Raises:
            requests.HTTPError: If the request fails
        """
        self._ensure_valid_token()
        url = f"{self.base_url}{endpoint}"
        logger.debug(f"POST {url}")

        response = self.session.post(url, json=data, params=params)
        response.raise_for_status()

        return response.json()

    def put(
        self,
        endpoint: str,
        data: Optional[Dict[str, Any]] = None,
        params: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Make a PUT request to the API.

        Args:
            endpoint: API endpoint path
            data: Request body data
            params: Optional query parameters

        Returns:
            Response JSON data

        Raises:
            requests.HTTPError: If the request fails
        """
        self._ensure_valid_token()
        url = f"{self.base_url}{endpoint}"
        logger.debug(f"PUT {url}")

        response = self.session.put(url, json=data, params=params)
        response.raise_for_status()

        return response.json()

    def delete(
        self,
        endpoint: str,
        params: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Make a DELETE request to the API.

        Args:
            endpoint: API endpoint path
            params: Optional query parameters

        Returns:
            Response JSON data

        Raises:
            requests.HTTPError: If the request fails
        """
        self._ensure_valid_token()
        url = f"{self.base_url}{endpoint}"
        logger.debug(f"DELETE {url}")

        response = self.session.delete(url, params=params)
        response.raise_for_status()

        return response.json()
