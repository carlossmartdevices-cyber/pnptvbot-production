# PM2 Startup / systemd

This file contains guidance for making PM2 restart processes after a reboot using systemd.

1. After starting your app with PM2, run:

```bash
pm2 save
pm2 startup systemd -u root --hp /root
```

2. The `pm2 startup` command prints one or more commands to run (it may instruct to run `sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u root --hp /root`). Run the exact command it prints.

3. Example of a systemd unit that `pm2 startup` might generate (for reference only):

```
[Unit]
Description=PM2 process manager
Documentation=https://pm2.keymetrics.io/

[Service]
User=root
LimitNOFILE=infinity
LimitNPROC=infinity
LimitCORE=infinity
Environment=PATH=/usr/bin:/usr/local/bin
Environment=PM2_HOME=/root/.pm2
PIDFile=/root/.pm2/pm2.pid
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
```

4. Verify on reboot: `systemctl status pm2-root` (service name may include user).
