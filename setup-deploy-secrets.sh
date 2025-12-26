#!/usr/bin/env bash
set -euo pipefail

# setup-deploy-secrets.sh
# Sets up GitHub repository secrets for the deploy workflow.
# Requires: gh CLI installed and authenticated
# Usage: ./setup-deploy-secrets.sh

REPO="carlossmartdevices-cyber/pnptvbot-production"

echo "=== GitHub Actions Deploy Secrets Setup ==="
echo "Repository: $REPO"
echo ""

# Check gh CLI
if ! command -v gh >/dev/null 2>&1; then
  echo "ERROR: 'gh' CLI not found. Install from https://cli.github.com"
  exit 1
fi

# Verify auth
if ! gh auth status >/dev/null 2>&1; then
  echo "ERROR: Not authenticated with gh. Run: gh auth login"
  exit 1
fi

# Collect inputs
echo "Enter deployment details:"
echo ""

read -p "REMOTE_USER (default: root): " REMOTE_USER
REMOTE_USER="${REMOTE_USER:-root}"

read -p "REMOTE_HOST (e.g., 72.60.29.80): " REMOTE_HOST
if [ -z "$REMOTE_HOST" ]; then
  echo "ERROR: REMOTE_HOST cannot be empty"
  exit 1
fi

read -p "REMOTE_APP_DIR (e.g., /var/www/pnptvbot): " REMOTE_APP_DIR
if [ -z "$REMOTE_APP_DIR" ]; then
  echo "ERROR: REMOTE_APP_DIR cannot be empty"
  exit 1
fi

read -p "Path to SSH private key (e.g., ~/.ssh/id_ed25519): " SSH_KEY_PATH
SSH_KEY_PATH="${SSH_KEY_PATH/#\~/$HOME}"
if [ ! -f "$SSH_KEY_PATH" ]; then
  echo "ERROR: SSH key not found at $SSH_KEY_PATH"
  exit 1
fi

SSH_PRIVATE_KEY=$(cat "$SSH_KEY_PATH")

# Set secrets
echo ""
echo "Setting secrets..."
gh secret set REMOTE_USER --body "$REMOTE_USER" --repo "$REPO"
gh secret set REMOTE_HOST --body "$REMOTE_HOST" --repo "$REPO"
gh secret set REMOTE_APP_DIR --body "$REMOTE_APP_DIR" --repo "$REPO"
gh secret set SSH_PRIVATE_KEY --body "$SSH_PRIVATE_KEY" --repo "$REPO"

echo ""
echo "✓ Secrets set successfully!"
echo ""
echo "Next steps:"
echo "1. Go to: https://github.com/$REPO/actions/workflows/deploy.yml"
echo "2. Click 'Run workflow' and select the branch to deploy"
echo "3. Monitor the deployment in real-time"
echo ""
