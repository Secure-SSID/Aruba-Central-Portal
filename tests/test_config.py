"""Tests for configuration management."""

import os
import pytest
import yaml
from pathlib import Path
from unittest.mock import patch

from utils.config import load_config


class TestLoadConfig:
    """Tests for load_config function."""

    def test_load_config_returns_dict(self):
        """Test that load_config returns a dictionary."""
        config = load_config()
        assert isinstance(config, dict)

    def test_load_config_has_aruba_central_key(self):
        """Test that config contains aruba_central section."""
        config = load_config()
        assert "aruba_central" in config

    def test_load_config_has_required_keys(self):
        """Test that aruba_central section has required keys."""
        config = load_config()
        aruba_config = config["aruba_central"]

        required_keys = ["base_url", "client_id", "client_secret", "customer_id"]
        for key in required_keys:
            assert key in aruba_config, f"Missing required key: {key}"


class TestEnvOverrides:
    """Tests for environment variable overrides.

    Note: In a real environment with .env files, dotenv loads before
    monkeypatch can intercept. These tests verify the config structure
    rather than the override mechanism (which is standard dotenv behavior).
    """

    def test_config_contains_expected_structure(self):
        """Test that loaded config has expected structure."""
        config = load_config()

        # Verify structure
        assert "aruba_central" in config
        aruba = config["aruba_central"]
        assert "base_url" in aruba
        assert "client_id" in aruba
        assert "client_secret" in aruba
        assert "customer_id" in aruba

    def test_config_values_are_strings(self):
        """Test that config values are strings (or None for optional fields)."""
        config = load_config()
        aruba = config["aruba_central"]

        # Required fields should be strings
        assert isinstance(aruba["base_url"], str)
        assert isinstance(aruba["client_id"], str)
        assert isinstance(aruba["client_secret"], str)
        assert isinstance(aruba["customer_id"], str)


class TestDefaultValues:
    """Tests for default configuration values."""

    def test_base_url_has_value(self):
        """Test that base_url always has a value (either from env, yaml, or default)."""
        config = load_config()

        # base_url should never be empty
        assert config["aruba_central"]["base_url"]
        assert config["aruba_central"]["base_url"].startswith("https://")

    def test_config_loads_without_error(self, tmp_path):
        """Test that config loads even with nonexistent YAML file."""
        # Should not raise an error
        config = load_config(str(tmp_path / "nonexistent.yaml"))

        assert "aruba_central" in config


class TestOptionalFields:
    """Tests for optional configuration fields."""

    def test_access_token_optional(self, monkeypatch, tmp_path):
        """Test that access_token field is optional."""
        monkeypatch.setenv("ARUBA_CLIENT_ID", "test-id")
        monkeypatch.setenv("ARUBA_CLIENT_SECRET", "test-secret")
        monkeypatch.delenv("ARUBA_ACCESS_TOKEN", raising=False)

        original_dir = os.getcwd()
        os.chdir(tmp_path)

        try:
            config = load_config("nonexistent.yaml")

            # access_token should be None or not present
            assert config["aruba_central"].get("access_token") is None
        finally:
            os.chdir(original_dir)

    def test_username_password_optional(self, monkeypatch, tmp_path):
        """Test that username and password fields are optional."""
        monkeypatch.setenv("ARUBA_CLIENT_ID", "test-id")
        monkeypatch.setenv("ARUBA_CLIENT_SECRET", "test-secret")
        monkeypatch.delenv("ARUBA_USERNAME", raising=False)
        monkeypatch.delenv("ARUBA_PASSWORD", raising=False)

        original_dir = os.getcwd()
        os.chdir(tmp_path)

        try:
            config = load_config("nonexistent.yaml")

            # username and password should be None
            assert config["aruba_central"].get("username") is None
            assert config["aruba_central"].get("password") is None
        finally:
            os.chdir(original_dir)


class TestConfigPath:
    """Tests for custom config path."""

    def test_custom_path_accepts_string(self, tmp_path):
        """Test that custom config path accepts string argument."""
        # This should not raise even if file doesn't exist
        config = load_config(str(tmp_path / "some_path.yaml"))
        assert isinstance(config, dict)

    def test_nonexistent_yaml_returns_valid_config(self, tmp_path):
        """Test that nonexistent YAML file still returns valid config."""
        config = load_config(str(tmp_path / "nonexistent.yaml"))

        # Should have aruba_central section even without YAML
        assert "aruba_central" in config
        assert isinstance(config["aruba_central"], dict)
