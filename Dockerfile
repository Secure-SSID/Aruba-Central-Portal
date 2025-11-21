# Multi-stage Dockerfile for Aruba Central Portal

# Stage 1: Build React Frontend
FROM node:18-alpine AS frontend-builder

WORKDIR /app/frontend

# Copy frontend package files
COPY dashboard/frontend/package*.json ./
RUN npm ci

# Copy frontend source
COPY dashboard/frontend/ ./

# Build frontend
RUN npm run build

# Stage 2: Python Backend Builder
FROM python:3.11-slim AS backend-builder

WORKDIR /app

# Install system dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements files
COPY requirements.txt ./
COPY dashboard/backend/requirements.txt /app/dashboard/backend/requirements.txt

# Create virtual environment and install dependencies
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Install Python dependencies
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt && \
    pip install --no-cache-dir -r /app/dashboard/backend/requirements.txt

# Stage 3: Production
FROM python:3.11-slim

WORKDIR /app

# Copy virtual environment from backend builder
COPY --from=backend-builder /opt/venv /opt/venv

# Set environment variables
ENV PATH="/opt/venv/bin:$PATH"
ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app
ENV FLASK_APP=/app/dashboard/backend/app.py
ENV TOKEN_CACHE_DIR=/app/data

# Copy application code
COPY . /app/

# Copy built frontend from frontend builder
COPY --from=frontend-builder /app/frontend/build /app/dashboard/frontend/build

# Copy entrypoint script with executable permissions
COPY --chmod=755 docker-entrypoint.sh /docker-entrypoint.sh

# Fix permissions for all directories and files
RUN find /app -type d -exec chmod 755 {} \; && \
    find /app -type f -exec chmod 644 {} \; && \
    find /app -type f -name "*.sh" -exec chmod 755 {} \; && \
    find /app -type f -name "*.py" -exec chmod 755 {} \; && \
    mkdir -p /app/data && chmod 777 /app/data

# Expose port
EXPOSE 1344

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD python -c "import requests; requests.get('http://localhost:1344/api/health', timeout=5)"

# Set working directory and run entrypoint
WORKDIR /app
ENTRYPOINT ["/docker-entrypoint.sh"]
