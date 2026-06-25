// Gmail API sending via Google Service Account
// with Domain-Wide Delegation

// Generate JWT for service account
async function generateServiceAccountToken(env, userEmail) {
  let serviceAccount;
  try {
    serviceAccount = JSON.parse(env.GOOGLE_SERVICE_ACCOUNT_JSON);
  } catch (e) {
    throw new Error('Failed to parse service account JSON: ' +
      e.message + ' | First 100 chars: ' +
      env.GOOGLE_SERVICE_ACCOUNT_JSON?.slice(0, 100));
  }

  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: serviceAccount.client_email,
    sub: userEmail, // impersonate this user
    scope: 'https://www.googleapis.com/auth/gmail.send',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600
  };

  // Base64url encode
  const b64 = (obj) => btoa(JSON.stringify(obj))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

  const signingInput = `${b64(header)}.${b64(payload)}`;

  // Import the private key
  const privateKey = serviceAccount.private_key;
  const pemBody = privateKey
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\n/g, '');

  const keyData = Uint8Array.from(atob(pemBody), c => c.charCodeAt(0));

  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    keyData,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    cryptoKey,
    new TextEncoder().encode(signingInput)
  );

  const b64sig = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

  const jwt = `${signingInput}.${b64sig}`;

  // Exchange JWT for access token
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt
    })
  });

  const tokenData = await tokenRes.json();
  if (!tokenData.access_token) {
    throw new Error('Failed to get Gmail access token: ' +
      JSON.stringify(tokenData));
  }

  return tokenData.access_token;
}

// Build RFC 2822 email message
function buildEmailMessage({ from, fromName, to, subject,
  htmlBody, inReplyTo, references, messageId }) {

  const mid = messageId ||
    `<${Date.now()}.${Math.random().toString(36).slice(2)}@eshopbox.com>`;

  let message = [
    `From: ${fromName} <${from}>`,
    `To: ${to}`,
    `Cc: sales@eshopbox.com`,
    `Subject: =?UTF-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`,
    `Content-Type: text/html; charset=utf-8`,
    `MIME-Version: 1.0`,
    `Message-ID: ${mid}`,
  ];

  if (inReplyTo) {
    message.push(`In-Reply-To: ${inReplyTo}`);
    message.push(`References: ${references || inReplyTo}`);
  }

  message.push('');
  message.push(htmlBody);

  // UTF-8 safe base64url encoding
  const rawString = message.join('\r\n');
  const utf8Bytes = new TextEncoder().encode(rawString);
  let binaryString = '';
  for (let i = 0; i < utf8Bytes.length; i++) {
    binaryString += String.fromCharCode(utf8Bytes[i]);
  }
  const raw = btoa(binaryString)
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

  return { raw, messageId: mid };
}

// Create a Gmail draft using a pre-obtained personal OAuth access token
export async function createGmailDraft(accessToken, { fromEmail, fromName, toEmail, subject, htmlBody, inReplyTo, references, threadId }) {
  console.log('createGmailDraft START', { fromEmail, toEmail, subject: subject?.slice(0, 50), htmlBodyLength: htmlBody?.length })
  console.log('createGmailDraft threadId:', threadId)
  try {
    const { raw, messageId } = buildEmailMessage({
      from: fromEmail,
      fromName,
      to: toEmail,
      subject,
      htmlBody,
      inReplyTo,
      references
    });

    const messageBody = { raw };
    if (threadId) messageBody.threadId = threadId;
    console.log('messageBody keys:', Object.keys(messageBody), 'has threadId:', !!messageBody.threadId)

    console.log('createGmailDraft about to fetch, raw length:', messageBody.raw?.length)
    console.log('raw message preview:', messageBody.raw?.slice(0, 200))
    const res = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/drafts`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ message: messageBody })
      }
    );
    console.log('createGmailDraft fetch done, status:', res.status)

    const data = await res.json();

    if (!res.ok || data.error) {
      throw new Error('Gmail draft creation failed: ' + JSON.stringify(data));
    }

    return {
      draftId: data.id,
      messageId,
      gmailMessageId: data.message?.id
    };
  } catch (err) {
    console.error('createGmailDraft CRASH:', err.message, err.stack?.slice(0, 200))
    throw err
  }
}

export async function checkDraftSent(
  accessToken, fromEmail, draftId,
  gmailMessageId, threadId = null,
  draftCreatedAt = null
) {
  try {
    // STEP 1 — Check if draft still exists
    // If draft exists → not sent yet
    // This is 100% reliable — no false positives
    const draftRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/${fromEmail}/drafts/${draftId}?format=minimal`,
      { headers: { 'Authorization': `Bearer ${accessToken}` } }
    )

    if (draftRes.ok) {
      return { sent: false }
    }

    // STEP 2 — Draft is gone (404)
    // Need threadId to check if it was sent
    if (!threadId) {
      // No threadId stored — can't determine
      // Rep must use Mark as Sent button
      console.log('checkDraftSent: draft gone but no threadId — cannot determine sent status')
      return { sent: false }
    }

    // STEP 3 — Check thread for SENT message
    // after draft was created
    const threadRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/${fromEmail}/threads/${threadId}?format=metadata&metadataHeaders=Subject,Date`,
      { headers: { 'Authorization': `Bearer ${accessToken}` } }
    )

    if (!threadRes.ok) {
      console.log('checkDraftSent: thread fetch failed', threadRes.status)
      return { sent: false }
    }

    const threadData = await threadRes.json()
    const messages = threadData.messages || []

    // Convert draft creation time to ms
    // Subtract 60s buffer for clock skew
    const draftCreatedMs = draftCreatedAt
      ? new Date(draftCreatedAt).getTime() - 60000
      : 0

    for (const msg of messages) {
      const labels = msg.labelIds || []
      const internalDate = parseInt(msg.internalDate || '0')

      // Must have SENT label
      if (!labels.includes('SENT')) continue
      // Must not be trash
      if (labels.includes('TRASH')) continue
      // Must be DRAFT label free (not still a draft)
      if (labels.includes('DRAFT')) continue
      // Must be sent AFTER draft was created
      if (draftCreatedAt && internalDate < draftCreatedMs) {
        console.log('checkDraftSent: found SENT message but before draft creation — skipping (old email)')
        continue
      }

      // Found valid sent message
      console.log('checkDraftSent: confirmed sent via thread message', msg.id)
      return { sent: true }
    }

    // Draft gone but no sent message found
    // → draft was deleted without sending
    console.log('checkDraftSent: draft gone, no sent message found — likely deleted')
    return { sent: false, draftDeleted: true }

  } catch (err) {
    console.error('checkDraftSent error:', err.message)
    return { sent: false }
  }
}

export async function getRealMessageId(accessToken, fromEmail, draftId, gmailMessageId) {
  // Try to get the real sent Message-ID from the thread
  // First try via the draft's thread
  const draftRes = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/${fromEmail}/drafts/${draftId}?format=minimal`,
    { headers: { 'Authorization': `Bearer ${accessToken}` } }
  );

  let threadId = null;

  if (draftRes.ok) {
    const draftData = await draftRes.json();
    threadId = draftData.message?.threadId;
  } else if (gmailMessageId) {
    // Draft is gone, get threadId from the message
    const msgRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/${fromEmail}/messages/${gmailMessageId}?format=minimal`,
      { headers: { 'Authorization': `Bearer ${accessToken}` } }
    );
    if (msgRes.ok) {
      const msgData = await msgRes.json();
      threadId = msgData.threadId;
    }
  }

  if (!threadId) return null;

  // Get all messages in thread and find the SENT one
  const threadRes = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/${fromEmail}/threads/${threadId}?format=metadata&metadataHeaders=Message-ID`,
    { headers: { 'Authorization': `Bearer ${accessToken}` } }
  );

  if (!threadRes.ok) return null;

  const threadData = await threadRes.json();
  const messages = threadData.messages || [];

  // Find the sent message (has SENT label)
  for (const msg of messages) {
    const labels = msg.labelIds || [];
    if (labels.includes('SENT') && !labels.includes('TRASH')) {
      // Get its real Message-ID header
      const headers = msg.payload?.headers || [];
      const midHeader = headers.find(h =>
        h.name === 'Message-ID' || h.name === 'Message-Id'
      );
      if (midHeader?.value) {
        return { messageId: midHeader.value, threadId: msg.threadId || null };
      }
    }
  }

  return null;
}

// Send email via Gmail API using a pre-obtained personal OAuth access token
export async function sendGmailEmailWithToken(accessToken, {
  fromEmail, fromName, toEmail, subject,
  htmlBody, inReplyTo, references
}) {
  const { raw, messageId } = buildEmailMessage({
    from: fromEmail,
    fromName,
    to: toEmail,
    subject,
    htmlBody,
    inReplyTo,
    references
  });

  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/${fromEmail}/messages/send`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ raw })
    }
  );

  const data = await res.json();

  if (!res.ok || data.error) {
    throw new Error('Gmail send failed: ' + JSON.stringify(data));
  }

  return {
    success: true,
    gmailMessageId: data.id,
    messageId
  };
}

// Send email via Gmail API
export async function sendGmailEmail(env, {
  fromEmail, fromName, toEmail, subject,
  htmlBody, inReplyTo, references
}) {
  // Get access token impersonating the rep
  const accessToken = await generateServiceAccountToken(env, fromEmail);

  const { raw, messageId } = buildEmailMessage({
    from: fromEmail,
    fromName,
    to: toEmail,
    subject,
    htmlBody,
    inReplyTo,
    references
  });

  // Send via Gmail API
  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/${fromEmail}/messages/send`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ raw })
    }
  );

  const data = await res.json();

  if (!res.ok || data.error) {
    throw new Error('Gmail send failed: ' + JSON.stringify(data));
  }

  return {
    success: true,
    gmailMessageId: data.id,
    messageId // the RFC 2822 Message-ID for threading
  };
}
