import { createServer } from 'node:http'
import { contact, health } from './app.js'

const PORT = Number(process.env.PORT) || 8787

const server = createServer((request, response) => {
  const path = (request.url ?? '').split('?')[0]

  if (path === '/health') {
    health(request, response)
    return
  }

  if (path === '/api/contact') {
    contact(request, response)
    return
  }

  response.writeHead(404, { 'Content-Type': 'application/json' })
  response.end(JSON.stringify({ ok: false, error: 'Not found.' }))
})

server.listen(PORT, '0.0.0.0', () => {
  console.log(`shucom-api on ${PORT}`)
})
