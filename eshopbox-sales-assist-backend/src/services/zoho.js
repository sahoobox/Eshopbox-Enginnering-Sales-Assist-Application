const TOKEN_KEY = 'zoho_access_token';

export async function getAccessToken(env) {
  try {
    const cached = await env.TOKEN_CACHE.get(TOKEN_KEY);
    if (cached) return cached;
  } catch {}

  const res = await fetch(`${env.ZOHO_ACCOUNTS_URL}/oauth/v2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: env.ZOHO_REFRESH_TOKEN,
      client_id: env.ZOHO_CLIENT_ID,
      client_secret: env.ZOHO_CLIENT_SECRET,
      grant_type: 'refresh_token',
    }),
  });

  const data = await res.json();
  if (!data.access_token) {
    throw new Error(`Zoho token refresh failed: ${JSON.stringify(data)}`);
  }

  await env.TOKEN_CACHE.put(TOKEN_KEY, data.access_token, { expirationTtl: 3300 });
  return data.access_token;
}

export async function getAccessTokenForUser(env, userRefreshToken) {
  const res = await fetch(`${env.ZOHO_ACCOUNTS_URL}/oauth/v2/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      refresh_token: userRefreshToken,
      client_id: env.ZOHO_CLIENT_ID,
      client_secret: env.ZOHO_CLIENT_SECRET,
      grant_type: 'refresh_token',
    }),
  });
  const tokenData = await res.json();
  if (!tokenData.access_token) {
    console.error('User token refresh failed:', JSON.stringify(tokenData));
    const err = new Error('ZOHO_TOKEN_EXPIRED');
    err.code = 'ZOHO_TOKEN_EXPIRED';
    err.zohoError = tokenData;
    throw err;
  }
  return tokenData.access_token;
}

export async function zohoAPI(env, method, path, body = null) {
  const token = await getAccessToken(env);
  const options = {
    method,
    headers: {
      Authorization: `Zoho-oauthtoken ${token}`,
      'Content-Type': 'application/json',
    },
  };
  if (body) options.body = JSON.stringify(body);
  const res = await fetch(`${env.ZOHO_API_BASE}${path}`, options);
  const data = await res.json();
  return data;
}

const DEAL_FIELDS = [
  'id', 'Deal_Name', 'Stage', 'Owner', 'Pipeline', 'Created_Time',
  'Modified_Time', 'Deal_Grade', 'SA_Forecast_Probability', 'SA_Segment',
  'SA_Solution_Interest', 'SA_Brand_Type', 'SA_Pain_Points', 'SA_OMS',
  'SA_Shopping_Cart', 'SA_Current_Shipping', 'SA_Current_Warehousing',
  'SA_Followup_Meeting_Date', 'SA_Pricing_Raised', 'SA_Demo_Format',
  'SA_F2F_Count', 'SA_Logged', 'Lost_Reason', 'Demo_Date', 'Contact_Name',
  'Account_Name', 'Description'
].join(',');

export async function getDeals(env) {
  const allDeals = [];
  let page = 1;

  const fields = [
    'id', 'Deal_Name', 'Stage', 'Owner', 'Pipeline', 'Created_Time',
    'Modified_Time', 'Deal_Grade', 'SA_Forecast_Probability', 'SA_Segment',
    'SA_Solution_Interest', 'SA_Brand_Type', 'SA_Pain_Points', 'SA_OMS',
    'SA_Shopping_Cart', 'SA_Current_Shipping', 'SA_Current_Warehousing',
    'SA_Followup_Meeting_Date', 'SA_Pricing_Raised', 'SA_Demo_Format',
    'SA_F2F_Count', 'SA_Logged', 'Lost_Reason', 'Demo_Date', 'Contact_Name',
    'Account_Name', 'Description', 'How_many_orders_do_you_ship_in_a_month'
  ].join(',');

  while (true) {
    const path = `/Deals?fields=${fields}&per_page=200&page=${page}&sort_by=Created_Time&sort_order=desc&criteria=(Created_Time:greater_than:2026-01-01T00:00:00%2B00:00)`;
    const res = await zohoAPI(env, 'GET', path);

    if (!res?.data?.length) break;

    allDeals.push(...res.data);

    if (!res.info?.more_records) break;
    page++;
    if (page > 15) break;
  }

  return { data: allDeals };
}

export async function searchDeals(env, query) {
  const path = `/Deals/search?word=${encodeURIComponent(query)}&fields=${DEAL_FIELDS}&per_page=10`;
  return zohoAPI(env, 'GET', path);
}

export async function getDeal(env, dealId) {
  return zohoAPI(env, 'GET', `/Deals/${dealId}?fields=${DEAL_FIELDS}`);
}

export async function createDeal(env, dealData) {
  return zohoAPI(env, 'POST', '/Deals', { data: [dealData] });
}

export async function updateDeal(env, dealId, dealData) {
  return zohoAPI(env, 'PUT', `/Deals/${dealId}`, { data: [dealData] });
}

export async function getDealTasks(env, dealId) {
  return zohoAPI(env, 'GET', `/Tasks/search?criteria=(What_Id:equals:${dealId})`);
}

export async function createTask(env, dealId, taskData) {
  const token = await getAccessToken(env);
  const res = await fetch('https://www.zohoapis.com/crm/v2/Tasks', {
    method: 'POST',
    headers: {
      Authorization: `Zoho-oauthtoken ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      data: [{
        Subject: taskData.Subject,
        Due_Date: taskData.Due_Date,
        Status: taskData.Status,
        Priority: taskData.Priority,
        Description: taskData.Description,
        What_Id: dealId,
        '$se_module': 'Deals',
        ...(taskData.Owner ? { Owner: taskData.Owner } : {}),
      }]
    }),
  });
  return res.json();
}

export async function getDealActivities(env, dealId) {
  return zohoAPI(env, 'GET', `/Deals/${dealId}/Activities_Events`);
}

function plainTextToHtml(text) {
  const blocks = (text || '').split('\n\n');
  const htmlBlocks = blocks.map(block => {
    const lines = block.split('\n');
    const result = [];
    let i = 0;
    while (i < lines.length) {
      const line = lines[i];
      if (line.startsWith('• ')) {
        const listItems = [];
        while (i < lines.length && lines[i].startsWith('• ')) {
          listItems.push(`<li>${lines[i].slice(2)}</li>`);
          i++;
        }
        result.push(`<ul>${listItems.join('')}</ul>`);
      } else if (line.endsWith(':') && line.length < 60) {
        result.push(`<p><strong>${line}</strong></p>`);
        i++;
      } else {
        result.push(`<p>${line}</p>`);
        i++;
      }
    }
    return result.join('');
  });
  return `<div style="font-family: sans-serif; font-size: 14px; line-height: 1.6;">${htmlBlocks.join('')}</div>`;
}

export async function getAllowedFromAddresses(env, userAccessToken) {
  const token = userAccessToken || await getAccessToken(env);
  const res = await fetch('https://www.zohoapis.com/crm/v8/settings/emails/actions/from_addresses', {
    headers: {
      Authorization: `Zoho-oauthtoken ${token}`,
      'Content-Type': 'application/json',
    },
  });
  return res.json();
}

export async function createDealEmailDraft(env, dealId, subject, body, emailType, toEmail, fromAddress, userAccessToken) {
  let htmlBody = plainTextToHtml(body);
  const trackingTag = `<span style="display:none;font-size:0;line-height:0;height:0;width:0;overflow:hidden" data-sa="${emailType}_${dealId}"></span>`;
  htmlBody = htmlBody.replace(/<\/div>$/, trackingTag + '</div>');
  const token = userAccessToken || await getAccessToken(env);
  const from = fromAddress?.email || '';
  console.log('draft payload:', JSON.stringify({ __email_drafts: [{ from, to: [{ user_name: '', email: toEmail || '' }], subject, content: htmlBody, rich_text: true }] }));
  const res = await fetch(`https://www.zohoapis.com/crm/v8/Deals/${dealId}/__email_drafts`, {
    method: 'POST',
    headers: {
      Authorization: `Zoho-oauthtoken ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      __email_drafts: [{
        from,
        to: [{ user_name: '', email: toEmail || '' }],
        subject,
        content: htmlBody,
        rich_text: true,
      }]
    }),
  });
  return res.json();
}

export async function getTask(env, taskId) {
  const token = await getAccessToken(env);
  const res = await fetch(`https://www.zohoapis.com/crm/v2/Tasks/${taskId}`, {
    headers: {
      Authorization: `Zoho-oauthtoken ${token}`,
      'Content-Type': 'application/json',
    },
  });
  return res.json();
}

export async function getDealSentEmails(env, dealId, userAccessToken) {
  const token = userAccessToken || await getAccessToken(env);
  const res = await fetch(`https://www.zohoapis.com/crm/v8/Deals/${dealId}/Emails?type=sent_from_crm`, {
    headers: {
      Authorization: `Zoho-oauthtoken ${token}`,
      'Content-Type': 'application/json',
    },
  });
  return res.json();
}

export async function getEmailContent(env, dealId, messageId, userAccessToken) {
  const token = userAccessToken || await getAccessToken(env);
  const res = await fetch(`https://www.zohoapis.com/crm/v8/Deals/${dealId}/Emails/${messageId}`, {
    headers: {
      Authorization: `Zoho-oauthtoken ${token}`,
      'Content-Type': 'application/json',
    },
  });
  return res.json();
}

export async function sendDealEmail(env, dealId, subject, body, cc = '') {
  const ccList = cc
    ? cc.split(',').map(e => e.trim()).filter(Boolean).map(e => ({ user_name: '', email: e }))
    : [];

  return zohoAPI(env, 'POST', `/Deals/${dealId}/actions/send_mail`, {
    data: [{
      from: { user_name: '', email: '' },
      to: [{ user_name: '', email: '' }],
      ...(ccList.length > 0 && { cc: ccList }),
      subject,
      content: body,
      mail_format: 'html',
    }]
  });
}