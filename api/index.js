import nodemailer from 'nodemailer'

const MAIL_TO = (process.env.MAIL_TO ?? '').trim()
const SMTP_HOST = (process.env.SMTP_HOST ?? 'smtp.gmail.com').trim()
const SMTP_PORT = Number(process.env.SMTP_PORT) || 465
const SMTP_USER = (process.env.SMTP_USER ?? '').trim()
const SMTP_PASS = (process.env.SMTP_PASS ?? '').replace(/\s+/g, '')

const MAIL_READY = Boolean(SMTP_USER && SMTP_PASS && MAIL_TO)

const ALLOWED_ORIGINS = (
  process.env.CORS_ORIGINS ??
  'https://shibu-patil.github.io,http://localhost:5173,http://127.0.0.1:5173'
)
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

const json = (response, status, body) => {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' })
  response.end(JSON.stringify(body))
}

const readBody = (request) =>
  new Promise((resolve, reject) => {
    let body = ''
    request.on('data', (chunk) => {
      body += chunk
      if (body.length > 32_000) {
        reject(new Error('Body too large'))
        request.destroy()
      }
    })
    request.on('end', () => resolve(body))
    request.on('error', reject)
  })

const clean = (value) =>
  String(value ?? '')
    .replace(/\r\n/g, '\n')
    .trim()

const validate = (body) => {
  const data = {
    name: clean(body.name),
    email: clean(body.email).toLowerCase(),
    phone: clean(body.phone),
    service: clean(body.service) || 'Not specified',
    message: clean(body.message),
  }

  if (data.name.length < 2) return { error: 'Please enter your name.' }
  if (!EMAIL_RE.test(data.email)) return { error: 'Please enter a valid email address.' }
  if (data.phone.length < 6) return { error: 'Please enter a phone number.' }
  if (data.message.length < 10) {
    return { error: 'Please add a little more detail (at least 10 characters).' }
  }
  if (data.message.length > 5000) return { error: 'Message is too long.' }

  return { data }
}

const sendEmail = (data) => {
  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_PORT === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  })

  return transporter.sendMail({
    from: `Subhashree Website <${SMTP_USER}>`,
    to: MAIL_TO,
    replyTo: data.email,
    subject: `New website enquiry — ${data.service} — ${data.name}`,
    text: [
      'NEW WEBSITE ENQUIRY',
      '',
      `Name: ${data.name}`,
      `Email: ${data.email}`,
      `Phone: ${data.phone}`,
      `Service: ${data.service}`,
      '',
      'Message:',
      data.message,
    ].join('\n'),
  })
}

// Simple in-memory rate limit: 10 submissions per IP per 15 minutes.
const RATE_LIMIT = 10
const RATE_WINDOW_MS = 15 * 60 * 1000

const hits = new Map()
const limited = (ip) => {
  const now = Date.now()

  if (hits.size > 5_000) {
    for (const [key, entry] of hits) {
      if (now > entry.reset) hits.delete(key)
    }
  }

  const entry = hits.get(ip) ?? { count: 0, reset: now + RATE_WINDOW_MS }
  if (now > entry.reset) {
    entry.count = 0
    entry.reset = now + RATE_WINDOW_MS
  }
  entry.count += 1
  hits.set(ip, entry)
  return entry.count > RATE_LIMIT
}

const health = (response) => {
  json(response, 200, {
    ok: true,
    mail: MAIL_READY ? 'smtp' : 'not configured',
    hasUser: Boolean(SMTP_USER),
    hasPass: Boolean(SMTP_PASS),
    hasTo: Boolean(MAIL_TO),
  })
}

const contact = async (request, response) => {
  const origin = request.headers.origin
  const allowed =
    !origin ||
    ALLOWED_ORIGINS.includes(origin) ||
    /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)

  if (origin && allowed) {
    response.setHeader('Access-Control-Allow-Origin', origin)
    response.setHeader('Vary', 'Origin')
  }

  if (request.method === 'OPTIONS') {
    response.writeHead(204, {
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    })
    response.end()
    return
  }

  if (request.method !== 'POST') {
    json(response, 405, { ok: false, error: 'Use POST.' })
    return
  }

  if (!allowed) {
    json(response, 403, { ok: false, error: 'Origin not allowed.' })
    return
  }

  const ip = String(request.headers['x-forwarded-for'] ?? request.socket?.remoteAddress ?? '')
    .split(',')[0]
    .trim()

  if (limited(ip)) {
    json(response, 429, { ok: false, error: 'Too many messages. Please try again later.' })
    return
  }

  let body
  try {
    body = JSON.parse((await readBody(request)) || '{}')
  } catch {
    json(response, 400, { ok: false, error: 'Invalid request.' })
    return
  }

  // Honeypot: bots fill this, humans never see it.
  if (String(body.company ?? '').trim()) {
    json(response, 200, { ok: true })
    return
  }

  const { data, error } = validate(body)

  if (error) {
    json(response, 422, { ok: false, error })
    return
  }

  if (!MAIL_READY) {
    console.error('[contact] SMTP_USER, SMTP_PASS or MAIL_TO is missing')
    json(response, 503, { ok: false, error: 'Mail is not configured yet.' })
    return
  }

  try {
    await sendEmail(data)
    console.log(`[contact] sent enquiry from ${data.email}`)
    json(response, 200, { ok: true })
  } catch (sendError) {
    console.error('[contact] failed:', sendError.message)
    json(response, 502, { ok: false, error: 'Message could not be sent. Please email us directly.' })
  }
}

// One entrypoint: GET -> health, POST/OPTIONS -> contact.
export default async function handler(request, response) {
  try {
    if (request.method === 'GET' || request.method === 'HEAD') {
      health(response)
      return
    }

    await contact(request, response)
  } catch (error) {
    console.error('[function] crashed:', error)
    if (!response.headersSent) {
      json(response, 500, { ok: false, error: 'Unexpected error.' })
    }
  }
}
