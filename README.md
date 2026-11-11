# shucom-api

One file, no dependencies: receives the website form and emails it to `MAIL_TO`.

- `POST /api/contact` — send the enquiry
- `GET /health` — shows the mail provider

## Run

```bash
cp .env.example .env   # set MAIL_TO
npm start
```

Runs on `http://localhost:8787`.

## Sending

By default it uses [FormSubmit](https://formsubmit.co), which needs no account.
The first message sends an `Activate Form` email to `MAIL_TO`; click that link
once and every enquiry after it lands in the inbox, with replies going to the
visitor.

If you add a `RESEND_API_KEY`, it uses Resend instead.

## Deploy on Render

New → Blueprint → pick this repo. Set `MAIL_TO` when prompted. Nothing else.
