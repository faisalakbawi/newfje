#!/bin/bash

echo "🚀 Uploading base-volume-bot to newfje repository..."
echo ""

# Check if authenticated
if ! gh auth status &>/dev/null; then
    echo "❌ Not authenticated with GitHub. Please authenticate first:"
    echo "   gh auth login --web"
    echo ""
    echo "Run this script again after authentication."
    exit 1
fi

echo "✅ GitHub authentication verified"

# Remove any existing remote (just in case)
git remote remove origin 2>/dev/null || true

# Add the newfje repository as remote
echo "📡 Setting up remote repository..."
git remote add origin https://github.com/faisalakbawi/newfje.git

# Ensure we're on main branch
git branch -M main

# Push to GitHub using GitHub CLI authentication
echo "⬆️  Pushing code to GitHub..."
gh repo set-default faisalakbawi/newfje
git push -u origin main

echo ""
echo "🎉 SUCCESS! Your base-volume-bot has been uploaded to:"
echo "   https://github.com/faisalakbawi/newfje"
echo ""