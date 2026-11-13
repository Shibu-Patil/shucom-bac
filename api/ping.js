module.exports = (request, response) => {
  response.writeHead(200, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  })
  response.end(JSON.stringify({ ok: true, ping: 'pong', node: process.version }))
}
