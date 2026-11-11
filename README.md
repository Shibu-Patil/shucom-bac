# shucom-api

Tiny contact form server. Takes the website form and emails it to you.

- `POST /api/contact` — send an enquiry
- `GET /health` — shows whether mail is ready

## Run locally

```bash
npm install
cp .env.example .env   # set MAIL_TO
npm start
```

Runs on `http://localhost:8787`.

## Sending

Default is **FormSubmit**, which needs no account. The first message sends an
`Activate Form` email to `MAIL_TO` — click that link once, and every enquiry
after it lands in the inbox with replies going to the visitor.

If you later get a Resend key, add `RESEND_API_KEY` on Render and it switches
to Resend automatically (better deliverability, no third party).

SMTP is also supported via the `SMTP_*` variables, but Render's free plan blocks
outbound ports 25/465/587, so it will time out there.

## Deploy on Render

Create a Web Service from this repo:

- Build: `npm ci`
- Start: `npm start`
- Health check: `/health`
- Env: `MAIL_TO=your-inbox@example.com`

`MAIL_TO` is the only thing you must set.

## Connect the website

In the website repo, the workflow already falls back to
`https://shucom-bac.onrender.com`. To use a different URL, add an Actions
repository variable named `VITE_CONTACT_API_URL`.
