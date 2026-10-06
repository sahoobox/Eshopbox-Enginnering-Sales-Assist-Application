const ZEPTOMAIL_URL = 'https://cpaas.zoho.com/v1.1/email';

export async function sendZeptoMailEmail(env, { to, subject, htmlBody, textBody }) {
  const key = (env.ZEPTOMAIL_TOKEN || '').trim().replace(/^Zoho-enczapikey\s+/i, '');
  const fromEmail = (env.ZEPTOMAIL_FROM_EMAIL || '').trim();
  if (!key || !fromEmail) throw new Error('ZeptoMail is not configured');

  let res;
  try {
    res = await fetch(ZEPTOMAIL_URL, {
      method: 'POST',
      headers: {
        Authorization: `Zoho-enczapikey ${key}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: { address: fromEmail, name: 'Eshopbox Sales Assist' },
        to: [{ email_address: { address: to } }],
        subject,
        htmlbody: htmlBody,
        ...(textBody && { textbody: textBody }),
      }),
    });
  } catch {
    throw new Error('ZeptoMail request failed');
  }
  // Deliberately do not read or log the response body.
  if (!res.ok) throw new Error(`ZeptoMail send failed (HTTP ${res.status})`);
  return true;
}
