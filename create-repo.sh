#!/bin/bash

echo "Creating GitHub repository for base-volume-bot..."

# Create the repository on GitHub
gh repo create base-volume-bot \
  --description "Multi-chain cryptocurrency trading bot with Telegram interface - Looter.ai clone" \
  --private \
  --source=. \
  --remote=origin \
  --push

echo "Repository created successfully!"
echo "Your repository URL: https://github.com/$(gh api user --jq .login)/base-volume-bot"