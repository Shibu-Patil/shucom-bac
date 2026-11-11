import 'dotenv/config'
import nodemailer from 'nodemailer'
import { renderEnquiry } from './templates.js'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const list = (value) =>
  String(value ?? '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)

const mailTo = list(process.env.MAIL_TO).filter((address) =>
  EMAIL_RE.test(address),
)
const mailFrom =
  (process.env.MAIL_FROM ?? '').trim() ||
  'Subhashree Website <onboarding@resend.dev>'

const resendKey = (process.env.RESEND_API_KEY ?? '').trim()
const smtpHost = (process.env.SMTP_HOST ?? '').trim()
const smtpUser = (process.env.SMTP_USER ?? '').trim()
const smtpPass = (process.env.SMTP_PASS ?? '').trim()
const smtpPort = Number(process.env.SMTP_PORT) || 465
const formsubmitTo =
  (process.env.FORMSUBMIT_TO ?? '').trim() || mailTo[0] || ''

// Resend if we have a key, else SMTP, else FormSubmit (no signup needed).
export const provider = resendKey
  ? 'resend'
  : smtpHost && smtpUser && smtpPass
    ? 'smtp'
    : formsubmitTo && EMAIL_RE.test(formsubmitTo)
      ? 'formsubmit'
      : 'none'

export const configured = provider !== 'none' && mailTo.length > 0

export async function sendEnquiry(data) {
  if (!configured) {
    throw new Error(
      'Mail is not configured. Set MAIL_TO plus RESEND_API_KEY, SMTP_* or FORMSUBMIT_TO.',
    )
  }

  const { subject, html, text } = renderEnquiry(data)

  if (provider === 'resend') {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: mailFrom,
        to: mailTo,
        subject,
        html,
        text,
        reply_to: data.email,
      }),
      signal: AbortSignal.timeout(20_000),
    })

    if (!response.ok) {
      const detail = await response.text().catch(() => '')
      throw new Error(`Resend failed (${response.status}): ${detail.slice(0, 300)}`)
    }
    return
  }

  if (provider === 'smtp') {
    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: process.env.SMTP_SECURE === 'true' || smtpPort === 465,
      auth: { user: smtpUser, pass: smtpPass },
      connectionTimeout: 10_000,
      socketTimeout: 20_000,
    })

    await transporter.sendMail({
      from: mailFrom,
      to: mailTo,
      replyTo: data.email,
      subject,
      html,
      text,
    })
    return
  }

  // FormSubmit: free relay, no account. First send triggers an activation
  // email to FORMSUBMIT_TO; after that one click, everything is delivered.
  const origin = (list(process.env.CORS_ORIGINS)[0] || 'https://shibu-patil.github.io').replace(/\/+$/, '')
  const response = await fetch(
    `https://formsubmit.co/ajax/${encodeURIComponent(formsubmitTo)}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Origin: origin,
        Referer: `${origin}/`,
      },
      body: JSON.stringify({
        _subject: subject,
        _template: 'table',
        _captcha: 'false',
        _replyto: data.email,
        name: data.name,
        email: data.email,
        phone: data.phone,
        service: data.service,
        message: data.message,
      }),
      signal: AbortSignal.timeout(20_000),
    },
  )

  const raw = await response.text().catch(() => '')
  let result = {}
  try {
    result = JSON.parse(raw)
  } catch {
    // plain-text answer
  }

  if (!(result.success === true || result.success === 'true')) {
    const detail = String(result.message ?? raw).slice(0, 300)
    throw new Error(`FormSubmit failed (${response.status}): ${detail}`)
  }
}
