import 'dotenv/config'
import nodemailer from 'nodemailer'
import { renderEnquiry } from './templates.js'

const resendKey = (process.env.RESEND_API_KEY ?? '').trim()
const smtpHost = (process.env.SMTP_HOST ?? '').trim()
const smtpUser = (process.env.SMTP_USER ?? '').trim()
const smtpPass = (process.env.SMTP_PASS ?? '').trim()
const smtpPort = Number(process.env.SMTP_PORT) || 465
const smtpSecure =
  process.env.SMTP_SECURE !== undefined
    ? process.env.SMTP_SECURE === 'true'
    : smtpPort === 465

const provider = resendKey
  ? 'resend'
  : smtpHost && smtpUser && smtpPass
    ? 'smtp'
    : 'none'

const dryRun = process.env.MAIL_DRY_RUN === 'true'

const mailTo = (process.env.MAIL_TO ?? '')
  .split(',')
  .map((address) => address.trim())
  .filter(Boolean)

const defaultFrom =
  provider === 'smtp'
    ? smtpUser
    : 'Subhashree Website <onboarding@resend.dev>'

const mailFrom = (process.env.MAIL_FROM ?? '').trim() || defaultFrom

export const mailTransport = {
  name: dryRun ? 'dry-run' : provider,
  configured: dryRun || (provider !== 'none' && mailTo.length > 0),
}

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

export async function sendEnquiry(data) {
  if (!mailTransport.configured) {
    throw new Error(
      'Mail is not configured. Set MAIL_TO plus either RESEND_API_KEY or the SMTP_* variables.',
    )
  }

  const { subject, html, text } = renderEnquiry(data)
  const payload = { subject, html, text, replyTo: data.email }

  if (dryRun) {
    console.log(`[mail:dry-run] would send "${subject}" to ${mailTo.join(', ')}`)
    return
  }

  if (provider === 'resend') {
    await sendWithResend(payload)
  } else {
    await sendWithSmtp(payload)
  }
}
