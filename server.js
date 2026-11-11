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
const MAIL_FROM =
  (process.env.MAIL_FROM ?? '').trim() ||
  'Subhashree Website <onboarding@resend.dev>'

const ALLOWED_ORIGINS = (
  process.env.CORS_ORIGINS ??
  'https://shibu-patil.github.io,http://localhost:5173,http://127.0.0.1:5173'
)
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const MAIL_READY = Boolean(RESEND_API_KEY && MAIL_TO)

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

const sendEmail = async (data) => {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: MAIL_FROM,
      to: [MAIL_TO],
      reply_to: data.email,
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
    }),
    signal: AbortSignal.timeout(20_000),
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(`Resend failed (${response.status}): ${detail.slice(0, 200)}`)
  }
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

const server = createServer(async (request, response) => {
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
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    })
    response.end()
    return
  }

  if (request.method === 'GET' && request.url === '/health') {
    json(response, 200, {
      ok: true,
      mail: MAIL_READY ? 'resend' : 'not configured',
      hasKey: Boolean(RESEND_API_KEY),
      hasTo: Boolean(MAIL_TO),
    })
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

  const ip = String(request.headers['x-forwarded-for'] ?? request.socket.remoteAddress ?? '')
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
    console.error('[contact] RESEND_API_KEY or MAIL_TO is missing')
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
})

server.listen(PORT, '0.0.0.0', () => {
  console.log(`shucom-api on ${PORT} — mail: ${MAIL_READY ? 'resend' : 'NOT configured'}`)
  if (!MAIL_READY) {
    console.log(
      `[config] RESEND_API_KEY: ${RESEND_API_KEY ? 'set' : 'MISSING'} | MAIL_TO: ${MAIL_TO || 'MISSING'}`,
    )
  }
})
