#!/bin/bash
# Script to generate secure random secrets for .env file

echo "=========================================="
echo "  PNPtv Bot - Secret Key Generator"
echo "=========================================="
echo ""

echo "Generating secure random secrets..."
echo ""

echo "1. JWT_SECRET (for JSON Web Tokens):"
JWT_SECRET=$(openssl rand -base64 32)
echo "   JWT_SECRET=$JWT_SECRET"
echo ""

echo "2. ENCRYPTION_KEY (for data encryption):"
ENCRYPTION_KEY=$(openssl rand -base64 32)
echo "   ENCRYPTION_KEY=$ENCRYPTION_KEY"
echo ""

echo "3. DB_PASSWORD (for PostgreSQL):"
DB_PASSWORD=$(openssl rand -base64 24 | tr -d "=+/" | cut -c1-20)
echo "   DB_PASSWORD=$DB_PASSWORD"
echo ""

echo "4. DAIMO_WEBHOOK_SECRET (for Daimo webhooks):"
DAIMO_WEBHOOK_SECRET=$(openssl rand -hex 32)
echo "   DAIMO_WEBHOOK_SECRET=$DAIMO_WEBHOOK_SECRET"
echo ""

echo "=========================================="
echo "  Copy these values to your .env file"
echo "=========================================="
echo ""
echo "SECURITY NOTICE:"
echo "- Store these secrets securely"
echo "- Never commit .env to version control"
echo "- Use different secrets for dev/staging/production"
echo "- Rotate secrets periodically"
echo ""

# Optionally write to a file
read -p "Save to secrets.txt? (y/n) " -n 1 -r
echo ""

if [[ $REPLY =~ ^[Yy]$ ]]; then
    cat > secrets.txt <<EOF
# Generated secrets for PNPtv Bot - $(date)
# WARNING: Keep this file secure and delete after copying to .env

JWT_SECRET=$JWT_SECRET
ENCRYPTION_KEY=$ENCRYPTION_KEY
DB_PASSWORD=$DB_PASSWORD
DAIMO_WEBHOOK_SECRET=$DAIMO_WEBHOOK_SECRET

# Add these to your .env file and then DELETE this file!
EOF
    echo "✓ Secrets saved to secrets.txt"
    echo "⚠️  Remember to DELETE secrets.txt after copying to .env!"
else
    echo "Secrets not saved to file."
fi
