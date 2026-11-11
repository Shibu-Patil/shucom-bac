import 'dotenv/config'
import cors from 'cors'
import express from 'express'
import rateLimit from 'express-rate-limit'
import helmet from 'helmet'
import {
  mailTransport,
  recipientWarnings,
  sendEnquiry,
} from './mailer.js'
import { validateEnquiry } from './validate.js'

const app = express()
const PORT = Number(process.env.PORT) || 8787
const HOST = process.env.HOST || '0.0.0.0'

const allowedOrigins = (
  process.env.CORS_ORIGINS ??
  'https://shibu-patil.github.io,http://localhost:5173,http://127.0.0.1:5173'
)
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean)

const isLocalDevOrigin = (origin) =>
  /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)

app.set('trust proxy', 1)
app.disable('x-powered-by')
app.use(helmet())
app.use(express.json({ limit: '32kb' }))
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin) || isLocalDevOrigin(origin)) {
        callback(null, true)
        return
      }
      callback(null, false)
    },
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type'],
    maxAge: 86_400,
  }),
)

const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    ok: false,
    error: 'Too many messages from this address. Please try again in a few minutes.',
  },
})

app.get('/', (_request, response) => {
  response.json({
    ok: true,
    service: 'shucom-api',
    endpoints: {
      health: 'GET /health',
      contact: 'POST /api/contact',
    },
  })
})

app.get('/health', (_request, response) => {
  response.json({
    ok: true,
    service: 'shucom-api',
    mail: {
      provider: mailTransport.name,
      configured: mailTransport.configured,
      recipients: mailTransport.recipients,
    },
    timestamp: new Date().toISOString(),
  })
})

app.post('/api/contact', contactLimiter, async (request, response) => {
  const body = request.body ?? {}

  // Honeypot field: real browsers leave this empty.
  if (String(body.company ?? '').trim()) {
    response.json({ ok: true })
    return
  }

  const { data, errors } = validateEnquiry(body)

  if (errors) {
    response.status(422).json({
      ok: false,
      error: 'Please check the form and try again.',
      errors,
    })
    return
  }

  try {
    await sendEnquiry(data)
    console.log(`[contact] delivered enquiry from ${data.email}`)
    response.json({ ok: true })
  } catch (error) {
    console.error('[contact] send failed:', error.message)
    response.status(502).json({
      ok: false,
      error:
        'We could not send your message right now. Please email us directly and we will get back to you.',
    })
  }
})

app.use((_request, response) => {
  response.status(404).json({ ok: false, error: 'Not found.' })
})

app.use((error, _request, response, _next) => {
  if (error?.type === 'entity.parse.failed') {
    response.status(400).json({ ok: false, error: 'Invalid JSON body.' })
    return
  }

  console.error('[server] unhandled error:', error)
  response.status(500).json({ ok: false, error: 'Unexpected server error.' })
})

const server = app.listen(PORT, HOST, () => {
  console.log(`shucom-api listening on ${HOST}:${PORT}`)
  console.log(
    `mail provider: ${mailTransport.name} (${
      mailTransport.configured ? 'configured' : 'NOT configured'
    })`,
  )

  for (const warning of recipientWarnings) {
    console.warn(`[config] ${warning}`)
  }

  if (!mailTransport.configured) {
    console.warn(`[config] ${mailTransport.reason}`)
    console.warn(
      '[config] Enquiries will fail with HTTP 502 until this is fixed. See README.md.',
    )
  }
})

const shutdown = (signal) => {
  console.log(`[server] ${signal} received, closing listener`)
  server.close(() => process.exit(0))
  setTimeout(() => process.exit(0), 10_000).unref()
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))

process.on('unhandledRejection', (reason) => {
  console.error('[server] unhandled rejection:', reason)
})
