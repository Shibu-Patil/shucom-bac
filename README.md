# shucom-api

Contact form backend for the Subhashree Communications website. Receives form
submissions from the static site and delivers them by email.

- `POST /api/contact` — validate and send an enquiry
- `GET /health` — service and mail configuration status
- Rate limited to 5 submissions per IP per 15 minutes
- Honeypot spam protection
- CORS locked to the website origin

## Local setup

```bash
npm install
cp .env.example .env
# fill in MAIL_TO and one provider below
npm run dev
```

The API runs on `http://localhost:8787`.

To test locally without sending real mail, add `MAIL_DRY_RUN=true` and any
`MAIL_TO` value — submissions are logged instead of emailed.

Quick checks:

```bash
npm test                      # validation unit tests
curl http://localhost:8787/health
```

`/health` reports which provider was detected, whether it is configured, and
how many recipient inboxes are valid:

```json
{
  "ok": true,
  "mail": { "provider": "resend", "configured": true, "recipients": 1 }
}
```

## Email providers

Set **one** provider. Detection order is: Resend → SMTP → FormSubmit.

### Option A — Resend (recommended with a domain)

1. Create an account at <https://resend.com>.
2. Verify your sending domain (or use their test sender).
3. Set:

```env
RESEND_API_KEY=re_...
MAIL_TO=hello@yourdomain.com
MAIL_FROM=Subhashree Website <hello@yourdomain.com>
```

For a quick test without a domain, leave `MAIL_FROM` empty and Resend will use
`onboarding@resend.dev`. That test sender can only deliver to the email address
on your Resend account.

### Option B — SMTP (Gmail app password)

1. Enable 2-Step Verification on the Google account.
2. Create an App Password (Google Account → Security → App passwords).
3. Set:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_SECURE=true
SMTP_USER=yourgmail@gmail.com
SMTP_PASS=the-16-character-app-password
MAIL_TO=where-enquiries-should-arrive@example.com
```

For Brevo, Zoho, or another provider, use that provider's SMTP host, port, and
credentials instead.

> **Render free plan blocks outbound ports 25, 465, and 587**, so SMTP times out
> there. Use Resend or FormSubmit on the free plan; SMTP needs a paid instance or
> another host.

### Option C — FormSubmit (no signup)

Delivers through <https://formsubmit.co>, useful when you do not have a domain or
an API key yet.

```env
MAIL_TO=where-enquiries-should-arrive@example.com
FORMSUBMIT_TO=where-enquiries-should-arrive@example.com
```

The **first** submission makes FormSubmit send an `Activate Form` email to that
address. Click the link once; every submission after that is delivered and
replies go straight to the visitor. `MAIL_FROM` is ignored in this mode.

If activation is still pending, `/api/contact` answers `502` and the server log
says exactly that, so you can tell the difference between "not activated" and
"provider down".

## Deploy on Render

1. Push this folder to its own GitHub repository.
2. In Render: **New → Web Service**, connect the repo.
3. Runtime: **Node**
   - Build command: `npm ci`
   - Start command: `npm start`
   - Health check path: `/health`
4. Add the environment variables from `.env.example`.
5. Deploy, then copy the service URL, for example:
   `https://shucom-api.onrender.com`

The included `render.yaml` can also be used as a Blueprint. It sets
`NODE_VERSION=20`, `MAIL_DRY_RUN=false`, and marks the secrets as `sync: false`
so Render prompts for them on first deploy.

Production checklist:

- [ ] `MAIL_TO` is set to the real inbox
- [ ] exactly one provider is configured (`RESEND_API_KEY`, the SMTP trio, or
      `FORMSUBMIT_TO`)
- [ ] `MAIL_DRY_RUN` is **not** `true`
- [ ] `CORS_ORIGINS` contains the exact site origin (scheme + host, no path)
- [ ] `/health` returns `"configured": true`
- [ ] one real submission arrives in the inbox

## Connect the website

In the website's GitHub repository:

**Settings → Secrets and variables → Actions → Variables → New repository variable**

- Name: `VITE_CONTACT_API_URL`
- Value: `https://your-service.onrender.com`

The deploy workflow passes that value into the Vite build. For local testing,
add the same line to the website's `.env`:

```env
VITE_CONTACT_API_URL=http://localhost:8787
```

If the variable is empty, the form falls back to opening the visitor's email
app — it will not send through the API.

## API contract

Request:

```json
{
  "name": "Asha Rao",
  "email": "asha@example.com",
  "phone": "+91 98765 43210",
  "service": "Outdoor advertising",
  "message": "We need a hoarding campaign in Bhubaneswar next month.",
  "company": ""
}
```

Success:

```json
{ "ok": true }
```

Validation error (`422`):

```json
{
  "ok": false,
  "error": "Please check the form and try again.",
  "errors": { "email": "Please enter a valid email address." }
}
```

Mail failure (`502`):

```json
{
  "ok": false,
  "error": "We could not send your message right now. Please email us directly and we will get back to you."
}
```

## Notes

- Never put SMTP or Resend credentials in the website build — they belong only
  in Render environment variables.
- `MAIL_DRY_RUN=true` makes the API answer `200` while only logging the enquiry.
  It never sends real mail, so it must stay off in production.
- FormSubmit is a free relay: fine to start with, but move to Resend with a
  verified domain once you have one for better deliverability and no third-party
  dependency.
- For best deliverability with Resend, add SPF, DKIM, and DMARC records for your
  domain.
- Render free services sleep after ~15 minutes of inactivity; the first request
  afterwards can take 30–60 seconds. The website waits up to 75 seconds before
  showing an error.
