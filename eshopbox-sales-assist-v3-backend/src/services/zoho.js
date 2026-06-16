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
  'id', 'Deal_Name', 'Stage', 'Owner', 'Layout', 'Created_Time',
  'Modified_Time', 'Deal_Grade', 'SA_Forecast_Probability',
  'Account_Name', 'How_many_orders_do_you_ship_in_a_month',
  'SA_Pain_Points', 'SA_Solution_Interest', 'SA_Brand_Type',
  'SA_Logged', 'Demo_Date', 'SA_Followup_Meeting_Date',
  'SA_Pricing_Raised', 'SA_F2F_Count', 'Lost_Reason',
  'SA_OMS', 'SA_Shopping_Cart', 'SA_Current_Warehousing',
  'SA_Current_Shipping', 'SA_Demo_Format', 'SA_Segment',
  'Contact_Name', 'Amount', 'On_Hold_Reason', 'Pipeline', 'Lead_Source'
].join(',');

const DEALS_2_LAYOUT_ID = '6483035000025962021';

const VALID_STAGES = [
  'Upcoming Demo', 'Demo Done', 'Proposal Sent',
  'Account Setup in Progress', 'Awaiting First Shipment',
  'First Shipment Done', 'Active', 'Follow up Meeting Done',
  'On Hold', 'Won/Payment Received', 'Lost/Dropped'
]

export async function getDeals(env) {
  const cached = await env.TOKEN_CACHE.get('v3_deals_cache')
  if (cached) return { data: JSON.parse(cached) }

  const deals = []
  let page = 1
  const token = await getAccessToken(env)
  while (page <= 200) {
    const res = await fetch(
      `https://www.zohoapis.in/crm/v2.1/Deals?fields=${DEAL_FIELDS}&per_page=200&page=${page}&sort_by=Modified_Time&sort_order=desc`,
      { headers: { Authorization: `Zoho-oauthtoken ${token}` } }
    ).then(r => r.json())
    if (!res?.data?.length) break
    const filtered = res.data.filter(d =>
      d.Layout?.id === DEALS_2_LAYOUT_ID &&
      (d.Pipeline === 'Mid-market' || d.Pipeline === 'Enterprise 2.0') &&
      VALID_STAGES.includes(d.Stage)
    )
    deals.push(...filtered)
    if (!res.info?.more_records) break
    page++
  }

  await env.TOKEN_CACHE.put('v3_deals_cache', JSON.stringify(deals), { expirationTtl: 7200 })
  return { data: deals }
}

export async function getAllDeals(env) {
  const deals = []
  let page = 1
  const token = await getAccessToken(env)
  while (true) {
    const res = await fetch(
      `https://www.zohoapis.in/crm/v2.1/Deals?fields=${DEAL_FIELDS}&per_page=200&page=${page}&sort_by=Modified_Time&sort_order=desc`,
      { headers: { Authorization: `Zoho-oauthtoken ${token}` } }
    ).then(r => r.json())
    if (!res?.data?.length) break
    const filtered = res.data.filter(d =>
      d.Layout?.id === DEALS_2_LAYOUT_ID &&
      (d.Pipeline === 'Mid-market' || d.Pipeline === 'Enterprise 2.0') &&
      VALID_STAGES.includes(d.Stage)
    )
    deals.push(...filtered)
    if (!res.info?.more_records) break
    page++
  }

  await env.TOKEN_CACHE.put('v3_deals_cache', JSON.stringify(deals), { expirationTtl: 7200 })
  return { data: deals }
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
  const res = await fetch('https://www.zohoapis.in/crm/v2.1/Tasks', {
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
  const res = await fetch('https://www.zohoapis.in/crm/v8/settings/emails/actions/from_addresses', {
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
  const res = await fetch(`https://www.zohoapis.in/crm/v8/Deals/${dealId}/__email_drafts`, {
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
  const res = await fetch(`https://www.zohoapis.in/crm/v2.1/Tasks/${taskId}`, {
    headers: {
      Authorization: `Zoho-oauthtoken ${token}`,
      'Content-Type': 'application/json',
    },
  });
  return res.json();
}

export async function getDealSentEmails(env, dealId, userAccessToken) {
  const token = userAccessToken || await getAccessToken(env);
  const res = await fetch(`https://www.zohoapis.in/crm/v8/Deals/${dealId}/Emails?type=sent_from_crm`, {
    headers: {
      Authorization: `Zoho-oauthtoken ${token}`,
      'Content-Type': 'application/json',
    },
  });
  return res.json();
}

export async function getEmailContent(env, dealId, messageId, userAccessToken) {
  const token = userAccessToken || await getAccessToken(env);
  const res = await fetch(`https://www.zohoapis.in/crm/v8/Deals/${dealId}/Emails/${messageId}`, {
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

// ── Lead helpers ──────────────────────────────────────────

const LEAD_FIELDS = [
  'id', 'First_Name', 'Last_Name', 'Full_Name', 'Email', 'Phone', 'Company',
  'Lead_Type', 'Lead_Source', 'Lead_Status', 'Owner', 'Created_Time',
  'Modified_Time', 'Last_Activity_Time', 'How_many_orders_do_you_ship_in_a_month',
  'Monthly_Order_Volume', 'Order_Volume', 'UTM_Source', 'UTM_Medium',
  'UTM_Campaign', 'UTM_Content', '$converted', 'Signup', 'Original_Lead_Source',
  'Disqualified_reason', 'Bad_Timing_Reason', 'Description'
].join(',')

const LEADS_CACHE_KEY = 'v3_leads_cache'

export async function getLeads(env) {
  // Check cache first (15 min TTL)
  try {
    const cached = await env.TOKEN_CACHE.get(LEADS_CACHE_KEY)
    if (cached) return { data: JSON.parse(cached) }
  } catch {}

  const leads = []
  let page = 1
  const token = await getAccessToken(env)
  while (page <= 50) {
    const res = await fetch(
      `https://www.zohoapis.in/crm/v2.1/Leads?fields=${LEAD_FIELDS}&per_page=100&page=${page}&sort_by=Created_Time&sort_order=desc`,
      { headers: { Authorization: `Zoho-oauthtoken ${token}` } }
    ).then(r => r.json())
    if (!res?.data?.length) break
    leads.push(...res.data)
    if (!res.info?.more_records) break
    page++
  }

  // Cache for 15 minutes
  try {
    await env.TOKEN_CACHE.put(LEADS_CACHE_KEY, JSON.stringify(leads), { expirationTtl: 7200 })
  } catch {}

  return { data: leads }
}

export async function getLead(env, leadId) {
  return zohoAPI(env, 'GET', `/Leads/${leadId}`)
}

export async function updateLead(env, leadId, data) {
  return zohoAPI(env, 'PUT', `/Leads/${leadId}`, { data: [data] })
}

export async function getLeadActivities(env, leadId) {
  return zohoAPI(env, 'GET', `/Leads/${leadId}/Activities_Events`)
}

export async function createLeadActivity(env, leadId, activityData) {
  const endpoint = activityData.type === 'Call' ? '/Calls' :
                   activityData.type === 'Meeting' ? '/Events' : '/Tasks'
  const payload = activityData.type === 'Call' ? {
    Subject: activityData.subject,
    Description: activityData.description || '',
    Call_Duration: activityData.duration || '00:05',
    Call_Type: 'Outbound',
    Call_Start_Time: new Date().toISOString(),
    Who_Id: { id: leadId, module: 'Leads' },
    '$se_module': 'Leads'
  } : activityData.type === 'Task' ? {
    Subject: activityData.subject,
    Description: activityData.description || '',
    Due_Date: activityData.due_date || new Date().toISOString().split('T')[0],
    Status: 'Not Started',
    Priority: 'Normal',
    Who_Id: { id: leadId, module: 'Leads' },
    '$se_module': 'Leads'
  } : {
    Event_Title: activityData.subject,
    Description: activityData.description || '',
    Start_DateTime: new Date().toISOString(),
    End_DateTime: new Date(Date.now() + 3600000).toISOString(),
    Who_Id: { id: leadId, module: 'Leads' },
    '$se_module': 'Leads'
  }
  return zohoAPI(env, 'POST', endpoint, { data: [payload] })
}

export async function getLeadNotes(env, leadId) {
  return zohoAPI(env, 'GET', `/Leads/${leadId}/Notes`)
}

export async function createLeadNote(env, leadId, noteContent) {
  return zohoAPI(env, 'POST', `/Notes`, {
    data: [{
      Note_Title: 'Note',
      Note_Content: noteContent,
      Parent_Id: leadId,
      '$se_module': 'Leads'
    }]
  })
}

// ── Task helpers ──────────────────────────────────────────

export async function getTasks(env, filters = {}) {
  if (filters.deal_id) {
    return zohoAPI(env, 'GET', `/Deals/${filters.deal_id}/Tasks?fields=id,Subject,Status,Priority,Due_Date,Description,Who_Id,What_Id,Owner,Created_Time,Modified_Time&per_page=100`)
  }
  return zohoAPI(env, 'GET', '/Tasks?fields=id,Subject,Status,Priority,Due_Date,Description,Who_Id,What_Id,Owner,Created_Time,Modified_Time&per_page=100&sort_by=Due_Date&sort_order=asc')
}

export async function createGenericTask(env, taskData) {
  const payload = {
    Subject: taskData.subject,
    Status: 'Not Started',
    Priority: taskData.priority || 'Normal',
    Due_Date: taskData.due_date || new Date().toISOString().split('T')[0],
    Description: taskData.description || '',
    '$se_module': taskData.deal_id ? 'Deals' : undefined,
    What_Id: taskData.deal_id ? { id: taskData.deal_id, module: 'Deals' } : undefined,
  }
  Object.keys(payload).forEach(k => payload[k] === undefined && delete payload[k])
  return zohoAPI(env, 'POST', '/Tasks', { data: [payload] })
}

export async function updateTaskStatus(env, taskId, status) {
  return zohoAPI(env, 'PUT', `/Tasks/${taskId}`, { data: [{ Status: status }] })
}