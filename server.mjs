import { createServer } from 'node:http'
import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'

// Local .env support. On Vercel the real env vars are injected.
const envFile = new URL('./.env', import.meta.url)
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, 'utf8').split('\n')) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/)
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2].replace(/^["']|["']$/g, '')
    }
  }
}

const require = createRequire(import.meta.url)
const handler = require('./api/index.js')

const PORT = Number(process.env.PORT) || 8787

createServer((request, response) => {
  const path = (request.url ?? '').split('?')[0]

  if (path === '/health' || path === '/api/contact') {
    handler(request, response)
    return
  }

  response.writeHead(404, { 'Content-Type': 'application/json' })
  response.end(JSON.stringify({ ok: false, error: 'Not found.' }))
}).listen(PORT, '0.0.0.0', () => {
  console.log(`shucom-api on ${PORT}`)
})
