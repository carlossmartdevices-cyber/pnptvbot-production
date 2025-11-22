#!/bin/bash
# Deploy lifetime80 landing page to nginx

echo "Deploying lifetime80 landing page..."

# Backup current config
echo "1. Backing up current nginx config..."
sudo cp /etc/nginx/sites-enabled/pnptv-bot /etc/nginx/sites-enabled/pnptv-bot.backup.$(date +%Y%m%d_%H%M%S)

# Copy updated config
echo "2. Copying updated nginx config..."
sudo cp /root/pnptvbot-production/nginx-config-updated.conf /etc/nginx/sites-enabled/pnptv-bot

# Test nginx configuration
echo "3. Testing nginx configuration..."
sudo nginx -t

if [ $? -eq 0 ]; then
    echo "✓ Nginx configuration is valid"

    # Reload nginx
    echo "4. Reloading nginx..."
    sudo systemctl reload nginx

    if [ $? -eq 0 ]; then
        echo "✓ Nginx reloaded successfully"
        echo ""
        echo "=========================================="
        echo "Deployment complete!"
        echo "=========================================="
        echo ""
        echo "Your landing page is now available at:"
        echo "  https://pnptv.app/lifetime80"
        echo ""
        echo "Test it with:"
        echo "  curl -I https://pnptv.app/lifetime80"
        echo ""
    else
        echo "✗ Failed to reload nginx"
        echo "Restoring backup..."
        sudo cp /etc/nginx/sites-enabled/pnptv-bot.backup.* /etc/nginx/sites-enabled/pnptv-bot
        exit 1
    fi
else
    echo "✗ Nginx configuration test failed"
    echo "Not applying changes"
    exit 1
fi
