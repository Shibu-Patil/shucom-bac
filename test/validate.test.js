import assert from 'node:assert/strict'
import test from 'node:test'
import { validateEnquiry } from '../validate.js'

const valid = {
  name: 'Asha Rao',
  email: 'Asha@Example.com ',
  phone: '+91 98765 43210',
  service: 'Outdoor advertising',
  message: 'We need a hoarding campaign in Bhubaneswar next month.',
}

test('accepts and normalises a valid enquiry', () => {
  const { data, errors } = validateEnquiry(valid)

  assert.equal(errors, null)
  assert.equal(data.email, 'asha@example.com')
  assert.equal(data.name, 'Asha Rao')
  assert.equal(data.service, 'Outdoor advertising')
})

test('defaults the service when it is missing', () => {
  const { data, errors } = validateEnquiry({ ...valid, service: '' })

  assert.equal(errors, null)
  assert.equal(data.service, 'Not specified')
})

test('rejects a malformed email', () => {
  const { errors } = validateEnquiry({ ...valid, email: 'not-an-email' })

  assert.match(errors.email, /valid email/i)
})

test('rejects a short message', () => {
  const { errors } = validateEnquiry({ ...valid, message: 'too short' })

  assert.match(errors.message, /at least 10/i)
})

test('rejects an over-long name', () => {
  const { errors } = validateEnquiry({ ...valid, name: 'a'.repeat(121) })

  assert.match(errors.name, /120 characters/i)
})

test('reports every invalid field at once', () => {
  const { errors } = validateEnquiry({ name: '', email: 'x', phone: '', message: '' })

  assert.deepEqual(Object.keys(errors).sort(), [
    'email',
    'message',
    'name',
    'phone',
  ])
})

test('strips CRLF from free-text fields', () => {
  const { data } = validateEnquiry({
    ...valid,
    message: 'Line one\r\nLine two, with enough characters.',
  })

  assert.ok(!data.message.includes('\r'))
})
