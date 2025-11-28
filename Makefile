.PHONY: help install install-dev test test-cov lint format type-check clean pre-commit

VENV := ./venv
PYTHON := $(VENV)/bin/python
PIP := $(VENV)/bin/pip

help:
	@echo "Available commands:"
	@echo "  make install      - Install production dependencies"
	@echo "  make install-dev  - Install development dependencies"
	@echo "  make test         - Run tests"
	@echo "  make test-cov     - Run tests with coverage report"
	@echo "  make lint         - Run linter (ruff)"
	@echo "  make format       - Format code with black"
	@echo "  make type-check   - Run type checker (mypy)"
	@echo "  make pre-commit   - Install pre-commit hooks"
	@echo "  make clean        - Clean up cache files"
	@echo "  make all          - Run format, lint, type-check, and test"

install:
	$(PIP) install -r requirements.txt

install-dev: install
	$(PIP) install -r requirements-dev.txt

test:
	$(PYTHON) -m pytest tests/ -v

test-cov:
	$(PYTHON) -m pytest tests/ -v --cov=utils --cov-report=term-missing --cov-report=html

lint:
	$(PYTHON) -m ruff check utils/ tests/ scripts/

format:
	$(PYTHON) -m black utils/ tests/ scripts/

format-check:
	$(PYTHON) -m black --check utils/ tests/ scripts/

type-check:
	$(PYTHON) -m mypy utils/ --ignore-missing-imports

pre-commit:
	$(PIP) install pre-commit
	$(VENV)/bin/pre-commit install

clean:
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name .pytest_cache -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name .mypy_cache -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name htmlcov -exec rm -rf {} + 2>/dev/null || true
	find . -type f -name "*.pyc" -delete 2>/dev/null || true
	find . -type f -name ".coverage" -delete 2>/dev/null || true
	find . -type f -name "coverage.xml" -delete 2>/dev/null || true

all: format lint type-check test
