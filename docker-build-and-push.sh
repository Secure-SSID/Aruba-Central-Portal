#!/bin/bash

# Docker Build and Push Script for GitHub Container Registry
# This script builds the Docker image and pushes it to GHCR

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Print functions
print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_header() {
    echo ""
    echo -e "${BLUE}================================================${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}================================================${NC}"
    echo ""
}

# Check if GitHub username is set
if [ -z "$GITHUB_USERNAME" ]; then
    print_error "GITHUB_USERNAME environment variable is not set"
    echo ""
    echo "Please set your GitHub username:"
    echo "  export GITHUB_USERNAME=your_username"
    echo ""
    echo "Or run this script with:"
    echo "  GITHUB_USERNAME=your_username ./docker-build-and-push.sh"
    echo ""
    exit 1
fi

# Configuration
REGISTRY="ghcr.io"
IMAGE_NAME="$GITHUB_USERNAME/aruba-central-portal"
FULL_IMAGE_NAME="$REGISTRY/$IMAGE_NAME"

# Get version from git tag or use 'dev'
if git describe --tags --exact-match 2>/dev/null; then
    VERSION=$(git describe --tags --exact-match)
    print_info "Building tagged version: $VERSION"
else
    VERSION="dev"
    print_warning "No git tag found, using version: $VERSION"
fi

# Get git commit SHA
GIT_SHA=$(git rev-parse --short HEAD 2>/dev/null || echo "unknown")

print_header "Docker Build and Push to GHCR"

print_info "Configuration:"
echo "  Registry:    $REGISTRY"
echo "  Image:       $IMAGE_NAME"
echo "  Version:     $VERSION"
echo "  Git SHA:     $GIT_SHA"
echo "  Full name:   $FULL_IMAGE_NAME"
echo ""

# Step 1: Check if Docker is running
print_info "Checking Docker..."
if ! docker info > /dev/null 2>&1; then
    print_error "Docker is not running. Please start Docker Desktop."
    exit 1
fi
print_success "Docker is running"

# Step 2: Build the image
print_header "Building Docker Image"

print_info "Building multi-platform image (amd64, arm64)..."
echo ""

# Check if buildx is available
if ! docker buildx version > /dev/null 2>&1; then
    print_error "Docker buildx is not available. Please update Docker Desktop."
    exit 1
fi

# Create builder if it doesn't exist
if ! docker buildx inspect multiplatform > /dev/null 2>&1; then
    print_info "Creating multiplatform builder..."
    docker buildx create --name multiplatform --use
fi

# Use existing builder
docker buildx use multiplatform

# Build the image
docker buildx build \
    --platform linux/amd64,linux/arm64 \
    --tag "$FULL_IMAGE_NAME:latest" \
    --tag "$FULL_IMAGE_NAME:$VERSION" \
    --tag "$FULL_IMAGE_NAME:sha-$GIT_SHA" \
    --build-arg BUILD_DATE=$(date -u +'%Y-%m-%dT%H:%M:%SZ') \
    --build-arg VCS_REF=$GIT_SHA \
    --build-arg VERSION=$VERSION \
    --load \
    .

print_success "Image built successfully"

# Step 3: Login to GHCR
print_header "Logging in to GitHub Container Registry"

if [ -n "$GITHUB_TOKEN" ]; then
    print_info "Using GITHUB_TOKEN from environment"
    echo "$GITHUB_TOKEN" | docker login $REGISTRY -u $GITHUB_USERNAME --password-stdin
else
    print_info "Please enter your GitHub Personal Access Token (PAT)"
    print_warning "Need a token? Create one at: https://github.com/settings/tokens"
    echo ""
    docker login $REGISTRY -u $GITHUB_USERNAME
fi

print_success "Logged in to $REGISTRY"

# Step 4: Push the image
print_header "Pushing Image to GHCR"

print_info "Pushing tags:"
echo "  - $FULL_IMAGE_NAME:latest"
echo "  - $FULL_IMAGE_NAME:$VERSION"
echo "  - $FULL_IMAGE_NAME:sha-$GIT_SHA"
echo ""

# Push with all platforms
docker buildx build \
    --platform linux/amd64,linux/arm64 \
    --tag "$FULL_IMAGE_NAME:latest" \
    --tag "$FULL_IMAGE_NAME:$VERSION" \
    --tag "$FULL_IMAGE_NAME:sha-$GIT_SHA" \
    --build-arg BUILD_DATE=$(date -u +'%Y-%m-%dT%H:%M:%SZ') \
    --build-arg VCS_REF=$GIT_SHA \
    --build-arg VERSION=$VERSION \
    --push \
    .

print_success "Images pushed successfully"

# Step 5: Verify
print_header "Verification"

print_info "Your images are now available at:"
echo ""
echo "  Latest:  docker pull $FULL_IMAGE_NAME:latest"
echo "  Version: docker pull $FULL_IMAGE_NAME:$VERSION"
echo "  SHA:     docker pull $FULL_IMAGE_NAME:sha-$GIT_SHA"
echo ""

print_info "View your package at:"
echo "  https://github.com/$GITHUB_USERNAME?tab=packages"
echo ""

# Step 6: Make package public (reminder)
print_header "Next Steps"

print_warning "If this is your first push, make the package public:"
echo ""
echo "  1. Go to: https://github.com/$GITHUB_USERNAME?tab=packages"
echo "  2. Click: aruba-central-portal"
echo "  3. Package Settings → Danger Zone → Change visibility → Public"
echo ""

print_info "Users can now pull your image with:"
echo ""
echo "  docker pull $FULL_IMAGE_NAME:latest"
echo ""

print_success "Build and push complete!"
