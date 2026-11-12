# shucom-api

Receives the website form and emails it to `MAIL_TO` through **your own Gmail
account**. No email service, no API key, no signup.

- `POST /api/contact` — send the enquiry
- `GET /health` — `{"ok":true,"mail":"smtp"}` when ready

## Setup

1. Google Account → Security → enable **2-Step Verification**.
2. Security → **App passwords** → create one for "Mail".
3. Copy the 16-character password (remove the spaces).

Set:

```env
MAIL_TO=patilshibu@gmail.com
SMTP_USER=patilshibu@gmail.com
SMTP_PASS=abcdefghijklmnop
```

## Important: hosting

Gmail SMTP uses ports 465/587. **Render's free plan blocks those ports**, so
sending will time out there. It works on:

- a paid Render instance (any paid plan), or
- any VPS / host that allows outbound SMTP.

## Run locally

```bash
cp .env.example .env
npm install
npm start
```

Runs on `http://localhost:8787`.
