#!/bin/bash
# Deploy script for Fly.io
# Usage: bash deploy.sh

echo "================================"
echo "MCD-Agencia Deployment Script"
echo "================================"

# Check if fly is installed
if ! command -v fly &> /dev/null; then
    echo "❌ Error: flyctl is not installed"
    echo "Install from: https://fly.io/docs/hands-on/install-flyctl/"
    exit 1
fi

# Check if authenticated
if ! fly auth whoami &> /dev/null; then
    echo "❌ Error: Not authenticated with Fly.io"
    echo "Run: fly auth login"
    exit 1
fi

echo ""
echo "📦 Preparing deployment..."
echo ""

# Check git status
if [ -n "$(git status --porcelain)" ]; then
    echo "❌ Error: You have uncommitted changes"
    echo "Please commit or stash changes before deploying"
    exit 1
fi

echo "✓ Git status OK"

# Validate Django
echo "🔍 Checking Django..."
cd backend
python manage.py check
if [ $? -ne 0 ]; then
    echo "❌ Django check failed"
    exit 1
fi
cd ..

echo "✓ Django check OK"
echo ""

# Deploy
echo "🚀 Deploying to Fly.io..."
echo ""
fly deploy

if [ $? -eq 0 ]; then
    echo ""
    echo "================================"
    echo "✅ DEPLOYMENT SUCCESSFUL!"
    echo "================================"
    echo ""
    echo "The following actions were performed:"
    echo "  1. Backend deployed to mcd-agencia-api"
    echo "  2. Database migrations applied"
    echo "  3. Migration 0006 cleaned corrupted jobs"
    echo ""
    echo "📊 Check status at: https://fly.io/apps/mcd-agencia-api"
else
    echo ""
    echo "❌ DEPLOYMENT FAILED"
    exit 1
fi
