import 'dotenv/config'
import nodemailer from 'nodemailer'
import { renderEnquiry } from './templates.js'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const trim = (value) => String(value ?? '').trim()
const toList = (value) =>
  trim(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)

const resendKey = trim(process.env.RESEND_API_KEY)
const smtpHost = trim(process.env.SMTP_HOST)
const smtpUser = trim(process.env.SMTP_USER)
const smtpPass = trim(process.env.SMTP_PASS)
const smtpPort = Number(process.env.SMTP_PORT) || 465
const smtpSecure =
  process.env.SMTP_SECURE !== undefined
    ? process.env.SMTP_SECURE === 'true'
    : smtpPort === 465

const dryRun = process.env.MAIL_DRY_RUN === 'true'

const mailTo = toList(process.env.MAIL_TO).filter((address) =>
  EMAIL_RE.test(address),
)
const rejectedRecipients = toList(process.env.MAIL_TO).filter(
  (address) => !EMAIL_RE.test(address),
)

// FormSubmit needs a single destination inbox; fall back to the first MAIL_TO.
const formsubmitTarget = trim(process.env.FORMSUBMIT_TO) || mailTo[0] || ''

const provider = dryRun
  ? 'dry-run'
  : resendKey
    ? 'resend'
    : smtpHost && smtpUser && smtpPass
      ? 'smtp'
      : formsubmitTarget && EMAIL_RE.test(formsubmitTarget)
        ? 'formsubmit'
        : 'none'

const defaultFrom =
  provider === 'smtp'
    ? smtpUser
    : 'Subhashree Website <onboarding@resend.dev>'

const mailFrom = trim(process.env.MAIL_FROM) || defaultFrom

const missingConfig = (() => {
  if (dryRun) return null
  if (provider === 'none') {
    return 'No mail provider configured. Set RESEND_API_KEY, the SMTP_* variables, or FORMSUBMIT_TO.'
  }
  if (!mailTo.length) {
    return 'MAIL_TO is missing or invalid. Set the inbox that should receive enquiries.'
  }
  return null
})()

export const mailTransport = {
  name: provider,
  configured: missingConfig === null,
  recipients: mailTo.length,
  reason: missingConfig,
  from: mailFrom,
}

export const recipientWarnings = rejectedRecipients.map(
  (address) => `Ignoring invalid MAIL_TO entry: ${address}`,
)

let smtpTransporter = null

function getSmtpTransporter() {
  if (!smtpTransporter) {
    smtpTransporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpSecure,
      auth: { user: smtpUser, pass: smtpPass },
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
    })
  }

  return smtpTransporter
}

function siteOrigin() {
  const configured = toList(process.env.CORS_ORIGINS)[0]
  return configured && /^https?:\/\//.test(configured)
    ? configured.replace(/\/+$/, '')
    : 'https://shibu-patil.github.io'
}

async function sendWithResend({ subject, html, text, replyTo }) {
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
      reply_to: replyTo,
    }),
    signal: AbortSignal.timeout(20_000),
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(
      `Resend rejected the message (${response.status}): ${detail.slice(0, 300)}`,
    )
  }
}

async function sendWithSmtp({ subject, html, text, replyTo }) {
  await getSmtpTransporter().sendMail({
    from: mailFrom,
    to: mailTo,
    replyTo,
    subject,
    html,
    text,
  })
}

async function sendWithFormSubmit({ subject, text, replyTo }, data) {
  const origin = siteOrigin()
  const response = await fetch(
    `https://formsubmit.co/ajax/${encodeURIComponent(formsubmitTarget)}`,
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
        _replyto: replyTo,
        name: data.name,
        email: data.email,
        phone: data.phone,
        service: data.service,
        message: data.message,
        _note: 'Sent from the Subhashree Communications website.',
      }),
      signal: AbortSignal.timeout(20_000),
    },
  )

  const raw = await response.text().catch(() => '')
  let result = {}
  try {
    result = JSON.parse(raw)
  } catch {
    // FormSubmit sometimes answers with plain text.
  }

  const delivered = result.success === true || result.success === 'true'

  if (!response.ok || !delivered) {
    const detail = trim(result.message) || raw.slice(0, 300) || 'no detail'

    if (/activation/i.test(detail)) {
      throw new Error(
        `FormSubmit is not activated yet. Open the activation email sent to ${formsubmitTarget}, click the link, then submit again.`,
      )
    }

    throw new Error(
      `FormSubmit rejected the message (${response.status}): ${detail}`,
    )
  }
}

export async function sendEnquiry(data) {
  if (!mailTransport.configured) {
    throw new Error(mailTransport.reason ?? 'Mail is not configured.')
  }

  const { subject, html, text } = renderEnquiry(data)
  const payload = { subject, html, text, replyTo: data.email }

  if (provider === 'dry-run') {
    console.log(
      `[mail:dry-run] would send "${subject}" to ${mailTo.join(', ') || '(no recipient)'}`,
    )
    return
  }

  if (provider === 'resend') {
    await sendWithResend(payload)
    return
  }

  if (provider === 'smtp') {
    await sendWithSmtp(payload)
    return
  }

  await sendWithFormSubmit(payload, data)
}
