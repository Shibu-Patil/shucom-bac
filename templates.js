const escapeHtml = (value = '') =>
  String(value).replace(
    /[&<>"']/g,
    (char) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[char],
  )

const safeSubject = (value = '') => String(value).replace(/[\r\n]+/g, ' ').trim()

const detailRow = (label, value, href) => {
  if (!value) return ''
  const content = href
    ? `<a href="${escapeHtml(href)}" style="color:#ff5a1f;text-decoration:none;">${escapeHtml(value)}</a>`
    : escapeHtml(value)

  return `
    <tr>
      <td style="padding:10px 0;border-bottom:1px solid #e8edf8;color:#7a859b;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;vertical-align:top;width:118px;">${escapeHtml(label)}</td>
      <td style="padding:10px 0;border-bottom:1px solid #e8edf8;color:#0a1733;font-size:15px;line-height:1.5;">${content}</td>
    </tr>`
}

export function renderEnquiry(data) {
  const received = new Date().toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    dateStyle: 'medium',
    timeStyle: 'short',
  })

  const subject = safeSubject(
    `New website enquiry — ${data.service || 'General'} — ${data.name}`,
  )

  const message = escapeHtml(data.message).replace(/\n/g, '<br />')

  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#eef2fb;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">
      New enquiry from ${escapeHtml(data.name)} (${escapeHtml(data.service)})
    </div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef2fb;padding:28px 14px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:620px;background:#ffffff;border:1px solid #dfe6f5;border-radius:18px;overflow:hidden;font-family:'Segoe UI',Arial,sans-serif;">
            <tr>
              <td style="background:linear-gradient(120deg,#081327 0%,#102450 55%,#173a78 100%);padding:28px 30px;color:#fdf7eb;">
                <div style="font-size:11px;font-weight:700;letter-spacing:.22em;text-transform:uppercase;color:#ffb27a;">Subhashree Communications</div>
                <div style="margin-top:10px;font-size:26px;line-height:1.1;font-weight:700;">New website enquiry</div>
                <div style="margin-top:8px;font-size:13px;color:#b9c8e8;">${escapeHtml(received)} IST</div>
              </td>
            </tr>
            <tr>
              <td style="padding:26px 30px;">
                <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                  ${detailRow('Name', data.name)}
                  ${detailRow('Email', data.email, `mailto:${data.email}`)}
                  ${detailRow('Phone', data.phone, `tel:${data.phone.replace(/[^\d+]/g, '')}`)}
                  ${detailRow('Service', data.service)}
                </table>

                <div style="margin-top:24px;padding:18px 20px;background:#f7f9ff;border-left:3px solid #ff5a1f;border-radius:0 12px 12px 0;">
                  <div style="font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#7a859b;margin-bottom:8px;">Message</div>
                  <div style="font-size:15px;line-height:1.65;color:#0a1733;white-space:normal;">${message}</div>
                </div>

                <p style="margin:22px 0 0;font-size:13px;line-height:1.6;color:#7a859b;">
                  Reply directly to this email to answer ${escapeHtml(data.name)}.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 30px;background:#f7f9ff;border-top:1px solid #e8edf8;color:#8b96ad;font-size:11px;line-height:1.5;">
                Sent from the Subhashree Communications website.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`

  const text = [
    'NEW WEBSITE ENQUIRY',
    'Subhashree Communications',
    `Received: ${received} IST`,
    '',
    `Name: ${data.name}`,
    `Email: ${data.email}`,
    `Phone: ${data.phone}`,
    `Service: ${data.service}`,
    '',
    'Message:',
    data.message,
    '',
    'Reply directly to this email to answer the enquiry.',
  ].join('\n')

  return { subject, html, text }
}
