"""Tests for configuration management."""

import pytest
from utils.config import load_config


def test_load_config():
    """Test loading configuration."""
    config = load_config()
    assert "aruba_central" in config
    assert "base_url" in config["aruba_central"]
