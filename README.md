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

Quick check:

```bash
curl http://localhost:8787/health
```

## Email providers

Use **one** of the two options.

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

The included `render.yaml` can also be used as a Blueprint.

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
- For best deliverability with Resend, add SPF, DKIM, and DMARC records for your
  domain.
- Render free services sleep after inactivity; the first request after a sleep
  can take a few seconds.
