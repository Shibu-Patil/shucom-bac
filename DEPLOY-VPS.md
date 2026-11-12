# Deploy on your own server

Requirements: a Linux VPS with a **domain or subdomain** pointing at it, ports
80/443 open, and Node 20+.

> The website is served over HTTPS (GitHub Pages), so this API **must also be
> HTTPS**. A plain `http://IP:8787` will be blocked by the browser as mixed
> content. Caddy below handles the certificate automatically.

## 1. Install Node and Caddy

Ubuntu/Debian:

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs git caddy
node -v   # must be v20 or newer
```

## 2. Get the code

```bash
sudo mkdir -p /srv && cd /srv
sudo git clone https://github.com/Shibu-Patil/shucom-bac.git shucom-api
cd shucom-api
sudo npm ci --omit=dev
```

## 3. Configure

```bash
sudo nano /srv/shucom-api/.env
```

```env
MAIL_TO=patilshibu@gmail.com
SMTP_USER=patilshibu@gmail.com
SMTP_PASS=your16charapppassword
CORS_ORIGINS=https://shibu-patil.github.io
```

## 4. Keep it running (systemd)

```bash
sudo nano /etc/systemd/system/shucom-api.service
```

```ini
[Unit]
Description=shucom-api
After=network.target

[Service]
WorkingDirectory=/srv/shucom-api
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=3
EnvironmentFile=/srv/shucom-api/.env
User=www-data
Group=www-data

[Install]
WantedBy=multi-user.target
```

```bash
sudo chown -R www-data:www-data /srv/shucom-api
sudo systemctl daemon-reload
sudo systemctl enable --now shucom-api
sudo systemctl status shucom-api
```

## 5. HTTPS with Caddy

Replace `api.example.com` with your subdomain (its DNS A record must point at
this server):

```bash
sudo nano /etc/caddy/Caddyfile
```

```
api.example.com {
    reverse_proxy 127.0.0.1:8787
}
```

```bash
sudo systemctl reload caddy
```

## 6. Verify

```bash
curl https://api.example.com/health
# {"ok":true,"mail":"smtp","hasUser":true,"hasPass":true,"hasTo":true}

curl -X POST https://api.example.com/api/contact \
  -H 'Content-Type: application/json' \
  -H 'Origin: https://shibu-patil.github.io' \
  -d '{"name":"Test","email":"test@example.com","phone":"9876543210","service":"Test","message":"Live server check from the VPS."}'
# {"ok":true}
```

## 7. Point the website at it

Tell the site owner the URL, or set the GitHub Actions variable
`VITE_CONTACT_API_URL=https://api.example.com` and re-run the deploy workflow.

## Logs

```bash
sudo journalctl -u shucom-api -f
```
