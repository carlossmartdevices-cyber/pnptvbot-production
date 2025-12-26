# Deployment (PM2)

This document explains how to deploy the application using the included `deploy-pm2.sh` script, how to set up PM2 to restart on boot, and a CI workflow template for automated deployments.

## Quick local -> server deploy

- From your workstation (streams the local script to the remote shell):

```bash
ssh root@72.60.29.80 'bash -s' < ./deploy-pm2.sh
```

- Or SSH in and run the script on the server:

```bash
ssh root@72.60.29.80
cd /path/to/app
sudo ./deploy-pm2.sh
```

The script will:
- Fetch the latest `origin/main` (or `BRANCH` env var)
- Install dependencies (uses `npm ci` when `package-lock.json` exists)
- Ensure `pm2` is installed and start/reload the app using `ecosystem.config.js`
- Save the PM2 process list and run `pm2 startup systemd` (when run as root)

Important:
- The script uses `git reset --hard origin/$BRANCH` — this will discard local changes.
- The script assumes `ecosystem.config.js` is present at the repository root.

## SSH key recommendation (recommended)

Create a key on your workstation:

```bash
ssh-keygen -t ed25519 -C "deploy@yourdomain" -f ~/.ssh/pnptv_deploy -N ""
ssh-copy-id -i ~/.ssh/pnptv_deploy.pub root@72.60.29.80
```

Use the private key when running the script remotely:

```bash
ssh -i ~/.ssh/pnptv_deploy root@72.60.29.80 'bash -s' < ./deploy-pm2.sh
```

## PM2 notes

- Verify status: `pm2 status`
- View logs: `pm2 logs pnptv-bot`
- After confirming key-based login works, consider disabling password authentication in `/etc/ssh/sshd_config`.

## GitHub Actions deploy workflow (template)

See `.github/workflows/deploy.yml` for a templated workflow that runs on manual dispatch and deploys via SSH using an action to load the SSH key.
