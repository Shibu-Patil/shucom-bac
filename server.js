import { createServer } from 'node:http'
import { existsSync, readFileSync } from 'node:fs'

// Tiny .env loader for local runs. On Render the real env vars are used.
const envFile = new URL('./.env', import.meta.url)
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, 'utf8').split('\n')) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/)
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2].replace(/^["']|["']$/g, '')
    }
  }
}

const PORT = Number(process.env.PORT) || 8787
const MAIL_TO = (process.env.MAIL_TO ?? '').trim()
const RESEND_API_KEY = (process.env.RESEND_API_KEY ?? '').trim()

const ALLOWED_ORIGINS = (
  process.env.CORS_ORIGINS ??
  'https://shibu-patil.github.io,http://localhost:5173,http://127.0.0.1:5173'
)
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)

const SITE_ORIGIN = (ALLOWED_ORIGINS[0] ?? 'https://shibu-patil.github.io').replace(/\/+$/, '')
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const MAIL_PROVIDER = RESEND_API_KEY ? 'resend' : MAIL_TO ? 'formsubmit' : 'none'

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
    company: clean(body.company),
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

const sendWithResend = async (data) => {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: process.env.MAIL_FROM || 'Subhashree Website <onboarding@resend.dev>',
      to: [MAIL_TO],
      reply_to: data.email,
      subject: `New website enquiry — ${data.service} — ${data.name}`,
      text: enquiryText(data),
    }),
    signal: AbortSignal.timeout(20_000),
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(`Resend failed (${response.status}): ${detail.slice(0, 200)}`)
  }
}

const sendWithFormSubmit = async (data) => {
  const response = await fetch(
    `https://formsubmit.co/ajax/${encodeURIComponent(MAIL_TO)}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        Origin: SITE_ORIGIN,
        Referer: `${SITE_ORIGIN}/`,
      },
      body: JSON.stringify({
        _subject: `New website enquiry — ${data.service} — ${data.name}`,
        _template: 'table',
        _captcha: 'false',
        _replyto: data.email,
        Name: data.name,
        Email: data.email,
        Phone: data.phone,
        Service: data.service,
        Message: data.message,
      }),
      signal: AbortSignal.timeout(20_000),
    },
  )

  const raw = await response.text().catch(() => '')
  let result = {}
  try {
    result = JSON.parse(raw)
  } catch {
    // FormSubmit sometimes replies with plain text.
  }

  const ok = result.success === true || result.success === 'true'

  if (!ok) {
    const detail = String(result.message ?? raw).slice(0, 200)
    if (/activation/i.test(detail)) {
      throw new Error(
        `FormSubmit needs one-time activation. Open the activation email sent to ${MAIL_TO} and click the link.`,
      )
    }
    throw new Error(`FormSubmit failed (${response.status}): ${detail}`)
  }
}

const enquiryText = (data) =>
  [
    'NEW WEBSITE ENQUIRY',
    '',
    `Name: ${data.name}`,
    `Email: ${data.email}`,
    `Phone: ${data.phone}`,
    `Service: ${data.service}`,
    '',
    'Message:',
    data.message,
  ].join('\n')

const sendEnquiry = (data) =>
  RESEND_API_KEY ? sendWithResend(data) : sendWithFormSubmit(data)

// Simple in-memory rate limit: 5 submissions per IP per 15 minutes.
const hits = new Map()
const limited = (ip) => {
  const now = Date.now()
  const entry = hits.get(ip) ?? { count: 0, reset: now + 900_000 }
  if (now > entry.reset) {
    entry.count = 0
    entry.reset = now + 900_000
  }
  entry.count += 1
  hits.set(ip, entry)
  return entry.count > 5
}

const server = createServer(async (request, response) => {
  const origin = request.headers.origin
  const allowed = !origin || ALLOWED_ORIGINS.includes(origin) || /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)

  if (origin && allowed) {
    response.setHeader('Access-Control-Allow-Origin', origin)
    response.setHeader('Vary', 'Origin')
  }

  if (request.method === 'OPTIONS') {
    response.writeHead(204, {
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    })
    response.end()
    return
  }

  if (request.method === 'GET' && request.url === '/health') {
    json(response, 200, { ok: true, mail: MAIL_PROVIDER })
    return
  }

  if (request.method !== 'POST' || request.url !== '/api/contact') {
    json(response, 404, { ok: false, error: 'Not found.' })
    return
  }

  if (!allowed) {
    json(response, 403, { ok: false, error: 'Origin not allowed.' })
    return
  }

  const ip = String(request.headers['x-forwarded-for'] ?? request.socket.remoteAddress ?? '').split(',')[0].trim()

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

  if (MAIL_PROVIDER === 'none') {
    console.error('[contact] MAIL_TO is not set')
    json(response, 500, { ok: false, error: 'Mail is not configured.' })
    return
  }

  try {
    await sendEnquiry(data)
    console.log(`[contact] sent enquiry from ${data.email}`)
    json(response, 200, { ok: true })
  } catch (sendError) {
    console.error('[contact] failed:', sendError.message)
    json(response, 502, { ok: false, error: 'Message could not be sent. Please email us directly.' })
  }
})

server.listen(PORT, '0.0.0.0', () => {
  console.log(`shucom-api on ${PORT} — mail: ${MAIL_PROVIDER}`)
})
