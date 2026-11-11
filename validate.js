const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

const clean = (value) =>
  String(value ?? '')
    .replace(/\r\n/g, '\n')
    .trim()

export function validateEnquiry(body = {}) {
  const data = {
    name: clean(body.name),
    email: clean(body.email).toLowerCase(),
    phone: clean(body.phone),
    service: clean(body.service) || 'Not specified',
    message: clean(body.message),
    company: clean(body.company),
  }

  const errors = {}

  if (data.name.length < 2) {
    errors.name = 'Please enter your name.'
  } else if (data.name.length > 120) {
    errors.name = 'Name must be 120 characters or fewer.'
  }

  if (!EMAIL_RE.test(data.email)) {
    errors.email = 'Please enter a valid email address.'
  } else if (data.email.length > 200) {
    errors.email = 'Email address is too long.'
  }

  if (data.phone.length < 6) {
    errors.phone = 'Please enter a phone number.'
  } else if (data.phone.length > 40) {
    errors.phone = 'Phone number is too long.'
  }

  if (data.service.length > 100) {
    errors.service = 'Service choice is too long.'
  }

  if (data.message.length < 10) {
    errors.message = 'Please add a little more detail (at least 10 characters).'
  } else if (data.message.length > 5000) {
    errors.message = 'Message must be 5,000 characters or fewer.'
  }

  return {
    data,
    errors: Object.keys(errors).length ? errors : null,
  }
}
