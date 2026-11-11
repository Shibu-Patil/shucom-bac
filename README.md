# shucom-api

One file, no dependencies. Receives the website form and emails it to `MAIL_TO`
using Resend.

- `POST /api/contact` — send the enquiry
- `GET /health` — `{"ok":true,"mail":"resend"}` when ready

## Setup

1. Create a free account at <https://resend.com> using the same address as
   `MAIL_TO`.
2. Copy the API key.
3. Set both on Render (Environment):

```env
MAIL_TO=your-inbox@example.com
RESEND_API_KEY=re_...
```

That is all. No domain needed while `MAIL_FROM` is empty and the recipient is
your Resend account address. With a verified domain, also set
`MAIL_FROM="Subhashree Website <hello@yourdomain.com>"`.

## Run locally

```bash
cp .env.example .env   # fill MAIL_TO and RESEND_API_KEY
npm start
```
