# shucom-api

Receives the website form and emails it to `MAIL_TO` through **your own Gmail
account**. No email service, no API key.

- `POST /api/contact` — send the enquiry
- `GET /health` — `{"ok":true,"mail":"smtp"}` when ready

## Gmail setup

1. Google Account → Security → enable **2-Step Verification**.
2. Security → **App passwords** → create one for "Mail".
3. Copy the 16-character password (remove the spaces).

```env
MAIL_TO=patilshibu@gmail.com
SMTP_USER=patilshibu@gmail.com
SMTP_PASS=abcdefghijklmnop
CORS_ORIGINS=https://shibu-patil.github.io
```

## Deploy on Vercel (free, allows SMTP)

1. <https://vercel.com> → sign in with GitHub.
2. **Add New → Project** → import `shucom-bac`.
3. Framework preset: **Other**. Leave build/output empty.
4. **Environment Variables** → add the four values above.
5. **Deploy** → you get `https://shucom-bac.vercel.app`.

Check:

```bash
curl https://shucom-bac.vercel.app/health
# {"ok":true,"mail":"smtp","hasUser":true,"hasPass":true,"hasTo":true}
```

## Run locally

```bash
cp .env.example .env   # fill SMTP values
npm install
npm start              # http://localhost:8787
```

## Other hosts

Any host that allows outbound SMTP works. See `DEPLOY-VPS.md` for a plain
server with systemd + Caddy.
