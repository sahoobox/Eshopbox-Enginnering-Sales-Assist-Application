import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { requireAuth } from './middleware/auth.js';
import { sign, verify } from './middleware/jwt.js';
import { getUserByEmail, createUser, createInvite, getInviteByToken, markInviteAccepted, getAllUsers, deactivateUser, updateUserRole, getPendingInvites } from './db/users.js';
import { calculateGrade, scoreToGrade } from './services/grading.js';
import { zohoAPI, createDeal, createTask, getDeals, getAllDeals, getDeal, getDealTasks, getDealActivities, updateDeal, searchDeals, sendDealEmail, createDealEmailDraft, getAllowedFromAddresses, getAccessTokenForUser, getAccessToken, getDealSentEmails, getEmailContent, getTask, getLeads, getAllLeads, getLead, updateLead, getLeadActivities, createLeadActivity, getLeadNotes, createLeadNote, getTasks, createGenericTask, updateTaskStatus, getDealNotes, createZohoEvent, createZohoCall, getDealMeetings, getDealCalls } from './services/zoho.js';
import { generateEmailDrafts, generateReengagement, generateDealAnalysis, generateDealSummary } from './services/claude.js';
import getAttentionFlags, { getAttentionLevel } from './services/attentionRules.js';
import { logTimelineEvent } from './services/timeline.js';
import { logLeadTimelineEvent } from './services/leadTimeline.js';
import { sendGmailEmail, sendGmailEmailWithToken, createGmailDraft, checkDraftSent, getRealMessageId } from './services/gmail.js';

const app = new Hono();

app.use('*', cors({
  origin: [
    'https://eshopbox-sales-assist.pages.dev',
    'https://eshopbox-sales-assist-v3.pages.dev',
    'https://salesassist.eshopbox.com',
    'http://localhost:5173',
  ],
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'x-view-as-email', 'x-app-version'],
}));

app.get('/', (c) => c.json({ status: 'ok', app: 'Eshopbox Sales Assist Backend' }));
app.get('/test', (c) => c.json({ test: 'working' }));

app.get('/api/debug/pipeline-counts', async (c) => {
  try {
    const cached = await c.env.TOKEN_CACHE.get('v3_deals_cache')
    if (!cached) return c.json({ error: 'No cache — run /api/deals?refresh=true first' })
    const deals = JSON.parse(cached)
    const counts = {}
    deals.forEach(d => {
      const key = d.pipeline || 'empty'
      counts[key] = (counts[key] || 0) + 1
    })
    return c.json({ counts, total: deals.length })
  } catch(err) {
    return c.json({ error: err.message })
  }
})

app.get('/api/debug', async (c) => {
  try {
    const res = await zohoAPI(c.env, 'GET', '/Deals?per_page=200&page=1')
    return c.json({
      count: res?.data?.length,
      total: res?.info?.count,
      more: res?.info?.more_records,
      first: res?.data?.[0]?.Deal_Name,
      last: res?.data?.[res?.data?.length-1]?.Deal_Name,
    })
  } catch (err) {
    return c.json({ error: err.message })
  }
})

app.get('/api/debug/leads', requireAuth, async (c) => {
  const user = c.get('user')
  if (user.email !== 'satyanarayan.sahoo@eshopbox.com') return c.json({ error: 'Forbidden' }, 403)

  const token = await getAccessToken(c.env)
  const res = await fetch(
    'https://www.zohoapis.com/crm/v2.1/Leads?fields=id,Full_Name,Lead_Type,Lead_Status,Owner&per_page=3&sort_by=Created_Time&sort_order=desc',
    { headers: { Authorization: `Zoho-oauthtoken ${token}` } }
  ).then(r => r.json())

  return c.json(res)
})

app.get('/api/debug/pipelines', requireAuth, async (c) => {
  const res = await zohoAPI(c.env, 'GET', '/settings/pipeline?layout_id=6483035000025962021')
  return c.json(res)
})

app.delete('/api/cache', requireAuth, async (c) => {
  await c.env.TOKEN_CACHE.delete('v3_deals_cache')
  await c.env.TOKEN_CACHE.delete('zoho_access_token')
  await c.env.TOKEN_CACHE.delete('v3_leads_cache')
  return c.json({ ok: true })
})



async function hashPassword(password) {
  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' }, keyMaterial, 256);
  return JSON.stringify({ salt: Array.from(salt), hash: Array.from(new Uint8Array(bits)) });
}

function generateInviteEmailHTML(inviteLink, inviterName, role) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><style>
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#F7F6F2;margin:0;padding:40px 20px}
  .card{background:#fff;border-radius:12px;padding:36px 32px;max-width:480px;margin:0 auto;border:1px solid #E5E3DC}
  .dot{width:8px;height:8px;border-radius:50%;background:#E8441A;display:inline-block;vertical-align:middle;margin-right:6px}
  .brand{font-size:12px;font-weight:700;letter-spacing:.08em;color:#1A1A1A;vertical-align:middle}
  h1{font-size:22px;font-weight:700;color:#1A1A1A;margin:20px 0 8px}
  p{font-size:14px;color:#6B6B6B;line-height:1.6;margin:0 0 16px}
  .btn{display:inline-block;padding:12px 28px;background:#E8441A;color:#fff;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px;margin:8px 0 20px}
  .link-box{background:#F7F6F2;border-radius:8px;padding:10px 14px;font-size:12px;color:#1A1A1A;word-break:break-all;margin-bottom:20px}
  .footer{font-size:12px;color:#9B9B9B;border-top:1px solid #E5E3DC;padding-top:16px;margin-top:4px}
</style></head>
<body>
  <div class="card">
    <div><span class="dot"></span><span class="brand">SALES ASSIST</span></div>
    <h1>You've been invited!</h1>
    <p>${inviterName} has invited you to join Eshopbox Sales Assist as <strong>${role}</strong>.</p>
    <p>Click the button below to set up your account. This link expires in 7 days.</p>
    <a href="${inviteLink}" class="btn">Accept invite →</a>
    <p style="font-size:12px;color:#9B9B9B;margin-bottom:6px">Or copy this link:</p>
    <div class="link-box">${inviteLink}</div>
    <div class="footer">Eshopbox Sales Team · This email was sent because someone invited you to Sales Assist.</div>
  </div>
</body>
</html>`;
}

async function verifyPassword(password, stored) {
  const encoder = new TextEncoder();
  const { salt, hash } = JSON.parse(stored);
  const keyMaterial = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: new Uint8Array(salt), iterations: 100000, hash: 'SHA-256' }, keyMaterial, 256);
  return JSON.stringify(Array.from(new Uint8Array(bits))) === JSON.stringify(hash);
}


const DEAL_FIELDS = [
  'id', 'Deal_Name', 'Stage', 'Owner', 'Pipeline', 'Created_Time',
  'Modified_Time', 'Deal_Grade', 'SA_Forecast_Probability', 'SA_Segment',
  'SA_Solution_Interest', 'SA_Brand_Type', 'SA_Pain_Points', 'SA_OMS',
  'SA_Shopping_Cart', 'SA_Current_Shipping', 'SA_Current_Warehousing',
  'SA_Followup_Meeting_Date', 'SA_Pricing_Raised', 'SA_Demo_Format',
  'SA_F2F_Count', 'SA_Logged', 'Lost_Reason', 'Demo_Date', 'Contact_Name',
  'Account_Name', 'Description', 'How_many_orders_do_you_ship_in_a_month',
].join(',');

const SHIPPING_PAINS_MAP = {
  s1: 'High shipping cost',
  s2: 'Poor on-time delivery / SLA',
  s3: 'High RTO / return rate',
  s4: 'Limited carrier reach / pin code coverage',
  s5: 'No shipment visibility for customers',
  s6: 'No insurance / loss coverage',
};

const WAREHOUSING_PAINS_MAP = {
  w1: 'High warehousing / fulfillment cost',
  w2: 'Single warehouse — slow delivery and high cost',
  w3: 'Split inventory — DTC vs marketplace',
  w4: 'Manual operations / no WMS',
  w5: 'No real-time inventory visibility',
  w6: 'Scaling to new regions',
  w7: 'Returns processing and QC',
};

const MIDMARKET_STAGES = ['Upcoming Demo','Demo Done','Proposal Sent','Account Setup in Progress','Awaiting First Shipment','First Shipment Done','Active','On Hold','Won/Payment Received','Lost/Dropped'];
const ENTERPRISE_STAGES = ['Upcoming Demo','Demo Done','Proposal Sent','Follow up Meeting Done','Demo Approved','On Hold','Won/Payment Received','Lost/Dropped'];
const ALL_VALID_STAGES = [...new Set([...MIDMARKET_STAGES, ...ENTERPRISE_STAGES])];

const MDE_EMAILS = [
  'sriya.komal@eshopbox.com',
  'mriganki.srivastava@eshopbox.com',
  'shubham.kumar@eshopbox.com',
  'raghwendra.kumar@eshopbox.com',
  'sneha.gupta@eshopbox.com',
  'chetna.lakhmani@eshopbox.com',
  'arihant.sharma@eshopbox.com',
  'ajeet.kumar@eshopbox.com',
  'sunil.sethi@eshopbox.com',
  'umang.seth@eshopbox.com',
]
const AE_EMAILS = [
  'taufeeq.ahmad@eshopbox.com',
  'afzal.maknoo@eshopbox.com',
  'gautam@eshopbox.com',
  'jeevan.more@eshopbox.com',
]
async function getMDEEmails(db) {
  try {
    const rows = await db.prepare(
      "SELECT email FROM users WHERE role = 'mde' AND is_active = 1"
    ).all()
    return (rows.results || []).map(r => r.email)
  } catch {
    return MDE_EMAILS
  }
}
async function getAEEmails(db) {
  try {
    const rows = await db.prepare(
      "SELECT email FROM users WHERE role = 'ae' AND is_active = 1"
    ).all()
    return (rows.results || []).map(r => r.email)
  } catch {
    return AE_EMAILS
  }
}

function mapZohoDeal(d) {
  return {
    id: d.id,
    dealName: d.Deal_Name,
    brandName: d.Deal_Name?.split(' — ')[0] || d.Deal_Name,
    stage: d.Stage,
    stageAligned: ALL_VALID_STAGES.includes(d.Stage),
    pipeline: d.Pipeline || '',
    repName: d.Owner?.name || 'Unknown',
    repEmail: d.Owner?.email || '',
grade: (() => {
  const raw = d.SA_Forecast_Probability || 0;
  const s = raw > 20 ? Math.round((raw / 100) * 22) : raw;
  if (s >= 14) return 'A';
  if (s >= 9) return 'B';
  if (s >= 5) return 'C';
  return 'D';
})(),
score: (() => {
  const raw = d.SA_Forecast_Probability || 0;
  // If stored as percentage (>20), convert back to score
  return raw > 20 ? Math.round((raw / 100) * 22) : raw;
})(),    segment: d.SA_Segment || '',
    orderVolume: d.How_many_orders_do_you_ship_in_a_month ||'',
    solutionInterest: d.SA_Solution_Interest || '',
    painPoints: d.SA_Pain_Points || '',
    followupMeetingDate: d.SA_Followup_Meeting_Date || null,
    pricingRaised: d.SA_Pricing_Raised || false,
    f2fCount: d.SA_F2F_Count || 0,
    saLogged: d.SA_Logged || false,
    leadSource: d.Lead_Source || '',
    contactId: d.Contact_Name?.id || null,
    contactName: d.Contact_Name?.name || d.Contact_Name || '',
    accountName: d.Account_Name?.name || d.Account_Name || '',
    lostReason: d.Lost_Reason || '',
    city: d.City || '',
    supportNeeded: d.How_can_Eshopbox_support_your_business || '',
    productType: Array.isArray(d.What_type_of_products_do_you_sell)
      ? d.What_type_of_products_do_you_sell.join(', ')
      : d.What_type_of_products_do_you_sell || '',
    demoDate: d.Demo_Date || d.Created_Time?.split('T')[0] || '',
    stageChangedOn: d.Modified_Time?.split('T')[0] || '',
    createdAt: d.Created_Time || '',
    tasks: [],
    activities: [],
    f2fMeetings: [],
  };
}

// ─── SCORE BREAKDOWN HELPER ────────────────────────────
function buildScoreBreakdown(f) {
  const items = [];

  const painEarned = f.pain_clarity === 'clear' ? 3 : f.pain_clarity === 'vague' ? 1 : 0;
  items.push({ category: 'pain_clarity', label: 'Pain clarity', earned: painEarned, max: 3,
    description: f.pain_clarity === 'clear' ? 'Prospect clearly named their pain' :
      f.pain_clarity === 'vague' ? 'Pain implied but not fully articulated' : 'Pain not articulated' });

  const dmEarned = f.dm_present === 'yes' ? 3 : f.dm_present === 'champion' ? 1 : 0;
  items.push({ category: 'dm_present', label: 'Decision maker present', earned: dmEarned, max: 3,
    description: f.dm_present === 'yes' ? 'Decision maker was in the meeting' :
      f.dm_present === 'champion' ? 'Champion only — DM not present' : 'DM presence unknown' });

  const budgetEarned = f.budget_signal === 'confirmed' ? 2 : f.budget_signal === 'implied' ? 1 : 0;
  items.push({ category: 'budget_signal', label: 'Budget signal', earned: budgetEarned, max: 2,
    description: f.budget_signal === 'confirmed' ? 'Specific budget confirmed in conversation' :
      f.budget_signal === 'implied' ? 'Budget implied but not explicitly confirmed' : 'Budget not discussed' });

  const timelineEarned = f.purchase_timeline === 'month' ? 3 : f.purchase_timeline === 'quarter' ? 2 : f.purchase_timeline === '6m' ? 1 : 0;
  items.push({ category: 'purchase_timeline', label: 'Purchase timeline', earned: timelineEarned, max: 3,
    description: f.purchase_timeline === 'month' ? 'Buying this month — hot deal' :
      f.purchase_timeline === 'quarter' ? 'Buying this quarter' :
      f.purchase_timeline === '6m' ? '6+ months out — longer cycle' : 'Timeline unknown or exploring' });

  const engEarned = f.engagement_level === 'high' ? 2 : f.engagement_level === 'medium' ? 1 : 0;
  items.push({ category: 'engagement_level', label: 'Engagement level', earned: engEarned, max: 2,
    description: f.engagement_level === 'high' ? 'Asked detailed questions — highly engaged' :
      f.engagement_level === 'medium' ? 'Engaged but relatively passive' : 'Low engagement — mostly listening' });

  if (f.brand_type === 'enterprise') {
    const champEarned = f.champion_strength === 'strong' ? 2 : f.champion_strength === 'weak' ? 1 : 0;
    items.push({ category: 'champion_strength', label: 'Champion strength', earned: champEarned, max: 2,
      description: f.champion_strength === 'strong' ? 'Strong champion — asked for internal materials' :
        f.champion_strength === 'weak' ? 'Weak champion — passive supporter' : 'No internal champion identified' });
  } else {
    const procEarned = f.procurement_involved === 'no' ? 2 : f.procurement_involved === 'likely' ? 1 : 0;
    items.push({ category: 'procurement_involved', label: 'Procurement complexity', earned: procEarned, max: 2,
      description: f.procurement_involved === 'no' ? 'No procurement — direct buying decision' :
        f.procurement_involved === 'likely' ? 'Procurement likely involved — adds friction' : 'Procurement status unknown' });
  }

  const nextEarned = f.next_step === 'booked' ? 2 : f.next_step === 'vague' ? 1 : 0;
  items.push({ category: 'next_step', label: 'Next step', earned: nextEarned, max: 2,
    description: f.next_step === 'booked' ? 'Specific next action agreed and booked' :
      f.next_step === 'vague' ? 'Vague agreement to follow up' : 'No next step agreed' });

  let formatEarned = 0;
  let formatDesc = 'Virtual demo — no format bonus points';
  if (f.demo_format === 'inperson') {
    if (f.meeting_location === 'warehouse') { formatEarned = 3; formatDesc = 'Warehouse visit — highest engagement signal'; }
    else { formatEarned = 2; formatDesc = 'In-person meeting — strong engagement signal'; }
  }
  items.push({ category: 'demo_format', label: 'Demo format', earned: formatEarned, max: 3, description: formatDesc });

  return items;
}

// ─── AUTH ROUTES ───────────────────────────────────────
app.post('/auth/login', async (c) => {
  try {
    const { email, password } = await c.req.json();
    if (!email || !password) return c.json({ error: 'Email and password required' }, 400);
    if (!email.endsWith('@eshopbox.com')) return c.json({ error: 'Access restricted to @eshopbox.com accounts' }, 403);
    const user = await getUserByEmail(c.env.DB, email);
    if (!user) return c.json({ error: 'Invalid email or password' }, 401);
    if (!user.password_hash) return c.json({ error: 'Account not activated. Check your invite email.' }, 401);
    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) return c.json({ error: 'Invalid email or password' }, 401);
    const token = await sign({ id: user.id, email: user.email, name: user.name, role: user.role }, c.env.JWT_SECRET);
    return c.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
  } catch (err) {
    return c.json({ error: 'Login failed', details: err.message }, 500);
  }
});

app.post('/auth/invite', requireAuth, async (c) => {
  try {
    const user = c.get('user');
    if (user?.role !== 'admin' && user?.role !== 'lead-midmarket' && user?.role !== 'lead-enterprise') return c.json({ error: 'Only admins and sales leads can invite' }, 403);
    const { email, role } = await c.req.json();
    if (!email.endsWith('@eshopbox.com')) return c.json({ error: 'Only @eshopbox.com emails allowed' }, 400);
    const existing = await getUserByEmail(c.env.DB, email);
    if (existing) {
      if (existing.is_active === 1) {
        const pendingInvite = await c.env.DB.prepare(
          'SELECT id FROM invites WHERE email = ? AND accepted = 0'
        ).bind(email).first();
        if (pendingInvite) {
          return c.json({ error: 'This person has already joined the team. Refresh the team list to see their account.' }, 400);
        }
        return c.json({ error: 'A team member with this email already exists.' }, 400);
      }
      // is_active = 0 — inactive user, will be cleaned up below, continue
    }

    const softDeleted = await c.env.DB.prepare(
      'SELECT id, email FROM users WHERE email = ? AND is_active = 0'
    ).bind(email).first();

    await c.env.DB.prepare('DELETE FROM invites WHERE email = ?').bind(email).run();
    if (!softDeleted) {
      await c.env.DB.prepare('DELETE FROM users WHERE email = ? AND is_active = 0').bind(email).run();
    }

    const leadAllowed = ['mde', 'ae'];
    const adminAllowed = ['mde', 'ae', 'admin', 'lead-midmarket', 'lead-enterprise'];
    const assignedRole = user?.role === 'admin'
      ? (adminAllowed.includes(role) ? role : 'mde')
      : (leadAllowed.includes(role) ? role : 'mde');

    const token = crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    await createInvite(c.env.DB, { id: crypto.randomUUID(), email, role: assignedRole, invited_by: user.email, token, expires_at: expiresAt });
    const inviteLink = `${c.env.FRONTEND_URL}/accept-invite?token=${token}`;
    return c.json({ success: true, inviteLink });
  } catch (err) {
    return c.json({ error: 'Failed to create invite', details: err.message }, 500);
  }
});

app.post('/auth/accept-invite', async (c) => {
  try {
    const { token, password, name } = await c.req.json();
    if (!token || !password || !name) return c.json({ error: 'Token, name and password required' }, 400);
    if (password.length < 8) return c.json({ error: 'Password must be at least 8 characters' }, 400);
    const invite = await getInviteByToken(c.env.DB, token);
    if (!invite) return c.json({ error: 'This invite link has already been used or has expired' }, 400);
    if (new Date(invite.expires_at) < new Date()) return c.json({ error: 'This invite link has expired. Please ask your admin for a new invite' }, 400);
    const passwordHash = await hashPassword(password);
    const existingUser = await c.env.DB.prepare('SELECT id, is_active FROM users WHERE email = ?').bind(invite.email).first();
    if (existingUser && existingUser.is_active === 1) return c.json({ error: 'An account with this email already exists. Please login instead' }, 400);

    const softDeleted = await c.env.DB.prepare(
      'SELECT id FROM users WHERE email = ? AND is_active = 0'
    ).bind(invite.email).first();

    if (softDeleted) {
      await c.env.DB.prepare(
        `UPDATE users SET is_active = 1, password_hash = ?, name = ?, role = ? WHERE id = ?`
      ).bind(passwordHash, name, invite.role, softDeleted.id).run();
    } else {
      await createUser(c.env.DB, { id: crypto.randomUUID(), email: invite.email, name, role: invite.role, password_hash: passwordHash, invited_by: invite.invited_by });
    }
    await markInviteAccepted(c.env.DB, token);
    const user = await getUserByEmail(c.env.DB, invite.email);
    const jwtToken = await sign({ id: user.id, email: user.email, name: user.name, role: user.role }, c.env.JWT_SECRET);
    return c.json({ success: true, token: jwtToken, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
  } catch (err) {
    return c.json({ error: 'Failed to accept invite', details: err.message }, 500);
  }
});

app.get('/auth/me', requireAuth, async (c) => {
  return c.json({ success: true, user: c.get('user') });
});

app.get('/auth/team', requireAuth, async (c) => {
  try {
    const allUsers = await c.env.DB.prepare(
      'SELECT id, email, name, role, created_at, is_active FROM users ORDER BY is_active DESC, created_at DESC'
    ).all();
    const invites = await getPendingInvites(c.env.DB);
    return c.json({ users: allUsers.results, pendingInvites: invites });
  } catch (err) {
    return c.json({ error: 'Failed to fetch team', details: err.message }, 500);
  }
});

app.put('/auth/team/:id/role', requireAuth, async (c) => {
  try {
    const user = c.get('user');
    if (user?.role !== 'admin') return c.json({ error: 'Admins only' }, 403);
    const { role } = await c.req.json();
    await updateUserRole(c.env.DB, c.req.param('id'), role);
    return c.json({ success: true });
  } catch (err) {
    return c.json({ error: 'Failed to update role', details: err.message }, 500);
  }
});

app.put('/auth/team/:id/reactivate', requireAuth, async (c) => {
  try {
    const user = c.get('user');
    if (user?.role !== 'admin') return c.json({ error: 'Admins only' }, 403);
    await c.env.DB.prepare('UPDATE users SET is_active = 1 WHERE id = ?').bind(c.req.param('id')).run();
    return c.json({ success: true });
  } catch (err) {
    return c.json({ error: 'Failed to reactivate member', details: err.message }, 500);
  }
});

app.delete('/auth/team/:id', requireAuth, async (c) => {
  try {
    const user = c.get('user');
    if (user?.role !== 'admin') return c.json({ error: 'Admins only' }, 403);
    const id = c.req.param('id');
    const userRow = await c.env.DB.prepare('SELECT email FROM users WHERE id = ?').bind(id).first();
    const inviteRow = await c.env.DB.prepare('SELECT email FROM invites WHERE id = ?').bind(id).first();
    const email = userRow?.email || inviteRow?.email;
    await c.env.DB.prepare('DELETE FROM invites WHERE id = ?').bind(id).run();
    if (email) await c.env.DB.prepare('DELETE FROM invites WHERE email = ?').bind(email).run();
    if (userRow) await c.env.DB.prepare('UPDATE users SET is_active = 0 WHERE id = ?').bind(id).run();
    return c.json({ success: true });
  } catch (err) {
    return c.json({ error: 'Failed to remove member', details: err.message }, 500);
  }
});

app.post('/api/admin/force-logout', requireAuth, async (c) => {
  const user = c.get('user')
  if (user?.role !== 'admin') return c.json({ error: 'Admins only' }, 403)
  const timestamp = Date.now().toString()
  await c.env.TOKEN_CACHE.put('force_logout_after', timestamp)
  return c.json({ success: true, message: 'All sessions invalidated', timestamp })
})

app.post('/api/admin/impersonate', requireAuth, async (c) => {
  try {
    const user = c.get('user')
    if (user?.email !== 'satyanarayan.sahoo@eshopbox.com')
      return c.json({ error: 'Forbidden' }, 403)
    const { email } = await c.req.json()
    const targetUser = await getUserByEmail(c.env.DB, email)
    if (!targetUser) return c.json({ error: 'User not found' }, 404)
    if (!targetUser.is_active) return c.json({ error: 'User is inactive' }, 404)
    const token = await sign(
      {
        id: targetUser.id,
        email: targetUser.email,
        name: targetUser.name,
        role: targetUser.role,
        impersonatedBy: user.email
      },
      c.env.JWT_SECRET
    )
    return c.json({
      success: true,
      token,
      user: {
        id: targetUser.id,
        email: targetUser.email,
        name: targetUser.name,
        role: targetUser.role
      }
    })
  } catch (err) {
    return c.json({ error: err.message }, 500)
  }
})

app.post('/auth/zoho/connect', requireAuth, async (c) => {
  try {
    const user = c.get('user');
    const { code } = await c.req.json();
    if (!code) return c.json({ error: 'Authorization code required' }, 400);

    const redirectUri = `${c.env.FRONTEND_URL}/zoho-callback`;
    const res = await fetch('https://accounts.zoho.com/oauth/v2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: c.env.ZOHO_CLIENT_ID,
        client_secret: c.env.ZOHO_CLIENT_SECRET,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });
    const data = await res.json();

    if (!data.refresh_token) {
      return c.json({ error: 'Zoho OAuth failed', details: data }, 400);
    }

    await c.env.DB.prepare(
      'UPDATE users SET zoho_refresh_token = ? WHERE id = ?'
    ).bind(data.refresh_token, user.id).run();

    return c.json({ success: true, email: data.email || user.email });
  } catch (err) {
    return c.json({ error: 'Failed to connect Zoho', details: err.message }, 500);
  }
});

app.get('/auth/zoho/status', requireAuth, async (c) => {
  try {
    const user = c.get('user');
    const row = await c.env.DB.prepare(
      'SELECT zoho_refresh_token FROM users WHERE id = ?'
    ).bind(user.id).first();
    return c.json({ connected: !!row?.zoho_refresh_token });
  } catch (err) {
    return c.json({ error: 'Failed to check Zoho status', details: err.message }, 500);
  }
});

app.get('/auth/zoho/config', requireAuth, async (c) => {
  return c.json({
    clientId: c.env.ZOHO_CLIENT_ID,
    redirectUri: `${c.env.FRONTEND_URL}/zoho-callback`,
  });
});

app.post('/auth/forgot-password', async (c) => {
  try {
    const { email } = await c.req.json();
    if (!email?.endsWith('@eshopbox.com')) return c.json({ success: true });
    const user = await getUserByEmail(c.env.DB, email);
    if (!user) return c.json({ success: true });
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    await c.env.DB.prepare(
      'DELETE FROM password_reset_otps WHERE email = ? AND used = 0'
    ).bind(email).run();
    await c.env.DB.prepare(
      'INSERT INTO password_reset_otps (id, email, otp, expires_at) VALUES (?, ?, ?, ?)'
    ).bind(crypto.randomUUID(), email, otp, Date.now() + 10 * 60 * 1000).run();
    try {
      const accessToken = await getSenderAccessToken(c.env);
      await sendGmailEmailWithToken(accessToken, {
        fromEmail: 'nitiksha@eshopbox.com',
        fromName: 'Eshopbox Sales Assist',
        toEmail: email,
        subject: 'Your password reset OTP',
        htmlBody: `
          <div style="font-family: Inter, sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
            <h2 style="font-size: 20px; color: #1D1D1D; margin-bottom: 8px;">Reset your password</h2>
            <p style="color: #4A4A46; font-size: 14px; margin-bottom: 24px;">
              Use the OTP below to reset your Sales Assist password.
              It expires in 10 minutes.
            </p>
            <div style="background: #F4F2EC; border-radius: 8px; padding: 24px; text-align: center; margin-bottom: 24px;">
              <span style="font-size: 36px; font-weight: 700; letter-spacing: 8px; color: #F95253;">${otp}</span>
            </div>
            <p style="color: #8A8A85; font-size: 12px;">
              If you didn't request this, ignore this email.
              Your password will not change.
            </p>
          </div>
        `,
      });
    } catch (e) {
      console.error('OTP email send failed:', e.message);
    }
    return c.json({ success: true });
  } catch (err) {
    return c.json({ success: true });
  }
});

app.post('/auth/verify-otp', async (c) => {
  try {
    const { email, otp } = await c.req.json();
    const row = await c.env.DB.prepare(
      'SELECT * FROM password_reset_otps WHERE email = ? AND otp = ? AND used = 0'
    ).bind(email, otp).first();
    if (!row) return c.json({ error: 'Invalid OTP' }, 400);
    if (row.expires_at < Date.now()) return c.json({ error: 'OTP expired' }, 400);
    return c.json({ success: true, resetToken: `${otp}_${email}_${Date.now()}` });
  } catch (err) {
    return c.json({ error: 'Verification failed', details: err.message }, 500);
  }
});

app.post('/auth/reset-password', async (c) => {
  try {
    const { email, otp, password } = await c.req.json();
    const row = await c.env.DB.prepare(
      'SELECT * FROM password_reset_otps WHERE email = ? AND otp = ? AND used = 0'
    ).bind(email, otp).first();
    if (!row) return c.json({ error: 'Invalid OTP' }, 400);
    if (row.expires_at < Date.now()) return c.json({ error: 'OTP expired' }, 400);
    if (!password || password.length < 8) return c.json({ error: 'Password must be at least 8 characters' }, 400);
    const user = await c.env.DB.prepare(
      'SELECT password_hash FROM users WHERE email = ?'
    ).bind(email).first();
    if (user?.password_hash) {
      const isSame = await verifyPassword(password, user.password_hash);
      if (isSame) return c.json({ error: 'Please enter a different password from your current one' }, 400);
    }
    const passwordHash = await hashPassword(password);
    await c.env.DB.prepare(
      'UPDATE users SET password_hash = ? WHERE email = ?'
    ).bind(passwordHash, email).run();
    await c.env.DB.prepare(
      'UPDATE password_reset_otps SET used = 1 WHERE email = ? AND otp = ?'
    ).bind(email, otp).run();
    return c.json({ success: true });
  } catch (err) {
    return c.json({ error: 'Reset failed', details: err.message }, 500);
  }
});

app.get('/api/users/all', requireAuth, async (c) => {
  try {
    const user = c.get('user');
    if (user.email !== 'satyanarayan.sahoo@eshopbox.com') {
      return c.json({ error: 'Forbidden' }, 403);
    }
    const rows = await c.env.DB.prepare(
      'SELECT id, name, email, role, is_active FROM users ORDER BY name ASC'
    ).all();
    return c.json({ users: rows.results || [] });
  } catch (err) {
    return c.json({ error: 'Failed to fetch users', details: err.message }, 500);
  }
});

// ─── DEALS ROUTES ───────────────────────────────────────
app.get('/api/deals', requireAuth, async (c) => {
  try {
    const user = c.get('user')

    let effectiveUser = user
    console.log('effectiveUser:', JSON.stringify(effectiveUser))

    const forceRefresh = c.req.query('refresh') === 'true'
    if (forceRefresh) await c.env.TOKEN_CACHE.delete('v3_deals_cache')

    const { data: rawDeals } = await getDeals(c.env)

    const [dynamicMDEEmails, dynamicAEEmails] = await Promise.all([
      getMDEEmails(c.env.DB),
      getAEEmails(c.env.DB)
    ])

    // Map to deal objects
    let deals = rawDeals.map(d => mapZohoDeal(d))

    // Role-based filtering
    const userRole = effectiveUser.role
    const isAdminOrLead = userRole === 'admin' || userRole === 'lead-midmarket' || userRole === 'lead-enterprise'

    if (!isAdminOrLead) {
      const isMDE = dynamicMDEEmails.includes(effectiveUser.email)
      const isAE = dynamicAEEmails.includes(effectiveUser.email)

      if (isMDE) {
        deals = deals.filter(d =>
          d.repEmail === effectiveUser.email &&
          d.pipeline === 'Mid-market'
        )
      } else if (isAE) {
        deals = deals.filter(d =>
          d.repEmail === effectiveUser.email &&
          d.pipeline === 'Enterprise 2.0'
        )
      } else {
        deals = deals.filter(d => d.repEmail === effectiveUser.email)
      }
    }

    console.log('DEALS DEBUG:', {
      email: effectiveUser.email,
      role: effectiveUser.role,
      isAdminOrLead,
      isAE: dynamicAEEmails.includes(effectiveUser.email),
      dealsCount: deals.length,
      samplePipelines: [...new Set(deals.slice(0,5).map(d => d.pipeline))]
    })

    // D1 lookups in chunks of 500
    const chunkArray = (arr, size) => Array.from(
      { length: Math.ceil(arr.length / size) },
      (_, i) => arr.slice(i * size, i * size + size)
    )
    const allIds = deals.map(d => d.id)
    const saLoggedIds = deals.filter(d => d.saLogged).map(d => d.id)
    const allIdChunks = chunkArray(allIds, 500)
    const saLoggedIdChunks = chunkArray(saLoggedIds, 500)

    const [summaryResults, emailResults] = await Promise.all([
      allIdChunks.length > 0 ? Promise.all(allIdChunks.map(chunk => {
        const ids = chunk.map(id => `'${id}'`).join(',')
        return c.env.DB.prepare(`SELECT deal_id, deal_summary FROM deal_form_data WHERE deal_id IN (${ids})`).all()
      })) : [],
      saLoggedIds.length > 0 ? Promise.all(saLoggedIdChunks.map(chunk => {
        const ids = chunk.map(id => `'${id}'`).join(',')
        return c.env.DB.prepare(`SELECT deal_id, email_type, status, scheduled_for FROM deal_emails WHERE deal_id IN (${ids})`).all()
      })) : []
    ])

    const summaryMap = {}
    const emailMap = {}
    summaryResults.flat().forEach(r => r.results?.forEach(row => {
      if (row.deal_summary) summaryMap[row.deal_id] = row.deal_summary
    }))
    emailResults.flat().forEach(r => r.results?.forEach(row => {
      if (!emailMap[row.deal_id]) emailMap[row.deal_id] = {}
      emailMap[row.deal_id][row.email_type] = { status: row.status, scheduledFor: row.scheduled_for }
    }))

    // Fetch active SA team member emails for r_no_sa_member flag
    const teamRows = await c.env.DB.prepare('SELECT email FROM users WHERE is_active = 1').all()
    const teamEmails = new Set((teamRows.results || []).map(r => r.email.toLowerCase()))

    // Attach D1 data and flags
    deals = deals.map(d => {
      const dealWithData = {
        ...d,
        dealSummary: summaryMap[d.id] || null,
        emailStatuses: emailMap[d.id] || {},
      }
      const flags = getAttentionFlags(dealWithData)
      if (d.repEmail && !teamEmails.has(d.repEmail.toLowerCase())) {
        flags.push({
          severity: 'warning',
          title: 'Rep not in Sales Assist',
          desc: `${d.repName} is not a member of the Sales Assist team. This deal won't appear in their dashboard.`,
          rule: 'r_no_sa_member',
        })
      }
      return {
        ...dealWithData,
        flags,
        attentionLevel: getAttentionLevel(flags),
      }
    })

    return c.json({ deals, total: deals.length })
  } catch (err) {
    console.error('GET /api/deals error:', err)
    return c.json({ error: 'Failed to fetch deals', details: err.message }, 500)
  }
})

app.get('/api/deals/search', requireAuth, async (c) => {
  try {
    const query = c.req.query('q');
    if (!query || query.length < 2) return c.json({ deals: [] });
    const res = await searchDeals(c.env, query);
    if (!res?.data) return c.json({ deals: [] });
    const deals = res.data.map(d => ({
      id: d.id,
      dealName: d.Deal_Name,
      brandName: d.Deal_Name?.split(' — ')[0] || d.Deal_Name,
      stage: d.Stage,
      repName: d.Owner?.name || '',
      repEmail: d.Owner?.email || '',
      contactName: d.Contact_Name || '',
      solutionInterest: d.SA_Solution_Interest || '',
      painPoints: d.SA_Pain_Points || '',
      demoDate: d.Demo_Date || '',
    }));
    return c.json({ deals });
  } catch (err) {
    return c.json({ error: 'Search failed', details: err.message }, 500);
  }
});

app.get('/api/deals/:id', requireAuth, async (c) => {
  const dealId = c.req.param('id');
  try {
    const user = c.get('user');
    let effectiveUser = user;
    if (user.email === 'satyanarayan.sahoo@eshopbox.com') {
      const viewAsEmail = c.req.header('x-view-as-email');
      if (viewAsEmail) {
        const viewAsUser = await c.env.DB.prepare(
          'SELECT id, email, name, role FROM users WHERE email = ?'
        ).bind(viewAsEmail).first();
        if (viewAsUser) effectiveUser = viewAsUser;
      }
    }
    const [dealRes, tasksRes, activitiesRes, notesRes, meetingsRes, callsRes] = await Promise.all([
      getDeal(c.env, dealId),
      getDealTasks(c.env, dealId),
      getDealActivities(c.env, dealId),
      getDealNotes(c.env, dealId),
      getDealMeetings(c.env, dealId),
      getDealCalls(c.env, dealId),
    ]);
    const tasks = tasksRes?.data || [];
    const activities = activitiesRes?.data || [];
    if (!dealRes?.data?.[0]) return c.json({ error: 'Deal not found' }, 404);
const deal = mapZohoDeal(dealRes.data[0]);
deal.tasks = tasks;

const contactId = dealRes.data[0].Contact_Name?.id
let contactData = null
if (contactId) {
  const contactRes = await zohoAPI(c.env, 'GET', `/Contacts/${contactId}?fields=Email,Phone,First_Name,Last_Name`)
  contactData = contactRes?.data?.[0] || null
}
deal.contactEmail = contactData?.Email || ''
deal.contactPhone = contactData?.Phone || ''

// Fetch email statuses and deal summary from D1 in parallel
const [emailRows, formRow] = await Promise.all([
  c.env.DB.prepare(
    'SELECT email_type, status, scheduled_for, sent_at FROM deal_emails WHERE deal_id = ?'
  ).bind(dealId).all(),
  c.env.DB.prepare(
    'SELECT * FROM deal_form_data WHERE deal_id = ?'
  ).bind(dealId).first(),
]);
deal.emailStatuses = {};
(emailRows.results || []).forEach(e => {
  deal.emailStatuses[e.email_type] = {
    status: e.status,
    scheduledFor: e.scheduled_for,
    sentAt: e.sent_at,
  };
});

if (formRow) {
  deal.demoInfo = {
    prospectName: formRow.prospect_name || '',
    prospectEmail: formRow.prospect_email || '',
    brandName: formRow.brand_name || '',
    orderVolume: formRow.order_volume || deal.orderVolume,
    solutionInterest: formRow.solution_interest || deal.solutionInterest,
    demoFormat: formRow.demo_format || '',
    meetingLocation: formRow.meeting_location || '',
    dmPresent: formRow.dm_present || '',
    brandType: formRow.brand_type || '',
    oms: formRow.oms || '',
    shoppingCart: formRow.shopping_cart || '',
    shippingSetup: formRow.shipping_setup || '',
    warehousingSetup: formRow.warehousing_setup || '',
    shippingPains: JSON.parse(formRow.shipping_pains || '[]'),
    warehousingPains: JSON.parse(formRow.warehousing_pains || '[]'),
    painClarity: formRow.pain_clarity || '',
    engagementLevel: formRow.engagement_level || '',
    budgetSignal: formRow.budget_signal || '',
    purchaseTimeline: formRow.purchase_timeline || '',
    championStrength: formRow.champion_strength || '',
    nextStep: formRow.next_step || '',
    followupMeetingDate: formRow.followup_meeting_date || '',
    pricingRaised: formRow.pricing_raised || '',
    featuresShown: JSON.parse(formRow.features_shown || '[]'),
    repNotes: formRow.rep_notes || '',
    objections: formRow.objections || '',
    competitorMentioned: formRow.competitor_mentioned || '',
    urgencyDriver: formRow.urgency_driver || '',
    transcript: formRow.transcript || '',
    aiAnalysis: formRow.ai_analysis || '',
    grade: formRow.grade || deal.grade,
    score: formRow.score || deal.score,
    createdAt: formRow.created_at || '',
  }
  deal.dealSummary = formRow.deal_summary || null
}

let dealSummary = formRow?.deal_summary || null;
console.log('[dealSummary] dealId:', dealId, '| formRow:', JSON.stringify(formRow), '| dealSummary after null check:', dealSummary);
if (!dealSummary && deal.saLogged) {
  console.log('[dealSummary] entering saLogged generation block');
  const fullFormRow = await c.env.DB.prepare(
    'SELECT * FROM deal_form_data WHERE deal_id = ?'
  ).bind(dealId).first();
  if (fullFormRow) {
    fullFormRow.shipping_pains = JSON.parse(fullFormRow.shipping_pains || '[]');
    fullFormRow.warehousing_pains = JSON.parse(fullFormRow.warehousing_pains || '[]');
    fullFormRow.features_shown = JSON.parse(fullFormRow.features_shown || '[]');
    dealSummary = await generateDealSummary(c.env, fullFormRow);
    if (dealSummary) {
      await c.env.DB.prepare(
        'UPDATE deal_form_data SET deal_summary = ?, updated_at = ? WHERE deal_id = ?'
      ).bind(dealSummary, new Date().toISOString(), dealId).run();
    }
  }
}
if (!dealSummary) {
  console.log('[dealSummary] entering fallback generation block (saLogged:', deal.saLogged, ')');
  const painLabels = (deal.painPoints || '').split(',').map(p => {
    const k = p.trim();
    return SHIPPING_PAINS_MAP[k] || WAREHOUSING_PAINS_MAP[k] || k;
  }).filter(Boolean).join(', ');
  deal.painPointsReadable = painLabels;
  dealSummary = await generateDealSummary(c.env, deal);
  if (dealSummary) {
    const now = new Date().toISOString();
    await c.env.DB.prepare(
      'INSERT OR IGNORE INTO deal_form_data (deal_id, zoho_id, deal_summary, created_at, updated_at) VALUES (?, ?, ?, ?, ?)'
    ).bind(dealId, dealId, dealSummary, now, now).run();
  }
}

deal.activities = activities.map(a => ({
      id: a.id,
      type: a.Activity_Type || 'Note',
      date: a.Created_Time,
      description: a.Description || a.Subject || '',
    }));
    deal.notes = (notesRes?.data || []).map(n => ({
      id: n.id,
      type: 'Note',
      date: n.Created_Time,
      description: n.Note_Content || n.Note_Title || '',
      createdBy: n.Created_By?.name || '',
    }));
    deal.meetings = (meetingsRes?.data || []).map(m => ({
      id: m.id, title: m.Event_Title || '', venue: m.Venue || '',
      from: m.Start_DateTime, to: m.End_DateTime, description: m.Description || '',
      status: m.Status || '', createdBy: m.Created_By?.name || '',
    }));
    deal.f2fMeetings = (deal.meetings || []).filter(m =>
      m.venue === 'In-office' ||
      m.venue === 'Client location'
    )
    deal.calls = (callsRes?.data || []).map(cl => ({
      id: cl.id, subject: cl.Subject || '', purpose: cl.Call_Purpose || '',
      agenda: cl.Call_Agenda || '', result: cl.Call_Result || '',
      timing: cl.Call_Start_Time, status: cl.Call_Status || '',
      outboundStatus: cl.Outbound_Call_Status || '',
      description: cl.Description || '', createdBy: cl.Created_By?.name || '',
    }));
    if ((effectiveUser.role === 'mde' || effectiveUser.role === 'ae') && deal.repEmail !== effectiveUser.email) return c.json({ error: 'Access denied' }, 403);
    const flags = getAttentionFlags(deal);
    const attentionLevel = getAttentionLevel(flags);
    console.log('[dealSummary] returning dealSummary for', dealId, ':', dealSummary);
    return c.json({ ...deal, flags, attentionLevel, dealSummary });
  } catch (e) {
    console.error('Deal fetch crashed:', e.message, e.stack)
    return c.json({ error: 'Failed to fetch deal', details: e.message }, 500)
  }
});

app.post('/api/deals/sync', requireAuth, async (c) => {
  try {
    const user = c.get('user');
    const formData = await c.req.json();

    // Check if already logged
    let existingDeal;
    try {
      existingDeal = await getDeal(c.env, formData.zohoId);
    } catch (e) {
      console.error('Zoho getDeal failed:', e.message);
      return c.json({
        error: 'Could not reach Zoho CRM. Please check your connection and try again.',
        retryable: true,
      }, 503);
    }

    if (!existingDeal?.data?.[0]) {
      return c.json({
        error: 'Deal not found in Zoho CRM. Make sure the Deal ID is correct.',
        retryable: false,
      }, 404);
    }

    if (existingDeal.data[0].SA_Logged === true) {
      // Check D1 — if record exists the deal is fully logged; if not, Zoho was marked but D1 save failed (half-logged)
      const existingD1 = await c.env.DB.prepare(
        'SELECT deal_id FROM deal_form_data WHERE deal_id = ?'
      ).bind(formData.zohoId).first();
      if (existingD1) {
        return c.json({ error: 'Demo already logged for this deal.' }, 400);
      }
      console.log('Half-logged deal detected, allowing resubmission:', formData.zohoId);
    }
    
    // zohoId is the existing deal ID the rep looked up
    if (!formData.zohoId) throw new Error('No Zoho Deal ID provided');
    
    const { score, grade, probability, segment } = calculateGrade(formData);
    const dealId = formData.zohoId;
    const demoDate = new Date();
    const addDays = (date, days) => new Date(date.getTime() + days * 86400000).toISOString().split('T')[0];

    // Save form data to D1 first — before any Zoho or Claude calls so data is never lost on downstream failure
    const now2 = new Date().toISOString();
    await c.env.DB.prepare(`
  INSERT INTO deal_form_data (
    deal_id, zoho_id, prospect_name, prospect_email, brand_name, order_volume,
    product_category, solution_interest, demo_format, meeting_location, dm_present,
    brand_type, procurement_involved, champion_strength, oms, shopping_cart,
    shipping_setup, warehousing_setup, shipping_pains, warehousing_pains,
    shipping_pain_other, warehousing_pain_other, pain_clarity, engagement_level,
    objections, competitor_mentioned, budget_signal, purchase_timeline, next_step,
    followup_meeting_date, urgency_driver, pricing_raised, features_shown,
    rep_notes, rep_name, rep_email, grade, score, transcript, deal_summary, ai_analysis,
    created_at, updated_at
  ) VALUES (
    ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
    ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
  )
  ON CONFLICT(deal_id) DO UPDATE SET
    prospect_name = excluded.prospect_name,
    prospect_email = excluded.prospect_email,
    brand_name = excluded.brand_name,
    order_volume = excluded.order_volume,
    product_category = excluded.product_category,
    solution_interest = excluded.solution_interest,
    demo_format = excluded.demo_format,
    meeting_location = excluded.meeting_location,
    dm_present = excluded.dm_present,
    brand_type = excluded.brand_type,
    procurement_involved = excluded.procurement_involved,
    champion_strength = excluded.champion_strength,
    oms = excluded.oms,
    shopping_cart = excluded.shopping_cart,
    shipping_setup = excluded.shipping_setup,
    warehousing_setup = excluded.warehousing_setup,
    shipping_pains = excluded.shipping_pains,
    warehousing_pains = excluded.warehousing_pains,
    shipping_pain_other = excluded.shipping_pain_other,
    warehousing_pain_other = excluded.warehousing_pain_other,
    pain_clarity = excluded.pain_clarity,
    engagement_level = excluded.engagement_level,
    objections = excluded.objections,
    competitor_mentioned = excluded.competitor_mentioned,
    budget_signal = excluded.budget_signal,
    purchase_timeline = excluded.purchase_timeline,
    next_step = excluded.next_step,
    followup_meeting_date = excluded.followup_meeting_date,
    urgency_driver = excluded.urgency_driver,
    pricing_raised = excluded.pricing_raised,
    features_shown = excluded.features_shown,
    rep_notes = excluded.rep_notes,
    rep_name = excluded.rep_name,
    rep_email = excluded.rep_email,
    grade = excluded.grade,
    score = excluded.score,
    transcript = excluded.transcript,
    updated_at = excluded.updated_at
`).bind(
  formData.zohoId, formData.zohoId,
  formData.prospectName || '', formData.prospectEmail || '',
  formData.brandName || '', formData.orderVolume || '',
  formData.productCategory || '', formData.solutionInterest || '',
  formData.demoFormat || '', formData.meetingLocation || '',
  formData.dmPresent || '', formData.brandType || '',
  formData.procurementInvolved || '', formData.championStrength || '',
  formData.oms || '', formData.shoppingCart || '',
  formData.shippingSetup || '', formData.warehousingSetup || '',
  JSON.stringify(formData.shippingPains || []),
  JSON.stringify(formData.warehousingPains || []),
  formData.shippingPainOther || '', formData.warehousingPainOther || '',
  formData.painClarity || '', formData.engagementLevel || '',
  formData.objections || '', formData.competitorMentioned || '',
  formData.budgetSignal || '', formData.purchaseTimeline || '',
  formData.nextStep || '', formData.followupMeetingDate || '',
  formData.urgencyDriver || '', formData.pricingRaisedInDemo || '',
  JSON.stringify(formData.featuresShown || []),
  formData.repNotes || '', user.name || '', user.email || '',
  grade, score,
  formData.transcript || '',
  null, null,
  now2, now2
).run();

const currentStage = existingDeal.data[0].Stage;
const stagesBeforeDemo = ['Upcoming Demo'];
const shouldUpdateStage = stagesBeforeDemo.includes(currentStage);

const dealPayload = {
  ...(shouldUpdateStage && { Stage: 'Demo Done' }),
  Deal_Grade: grade,
  SA_Forecast_Probability: score,
      SA_Segment: formData.orderVolume || segment,
      SA_Solution_Interest: formData.solutionInterest,
      SA_Brand_Type: formData.brandType,
      SA_Pain_Points: [...(formData.shippingPains || []), ...(formData.warehousingPains || [])].join(', '),
      SA_OMS: formData.oms || '',
      SA_Shopping_Cart: formData.shoppingCart || '',
      SA_Current_Shipping: formData.shippingSetup || '',
      SA_Current_Warehousing: formData.warehousingSetup || '',
      SA_Followup_Meeting_Date: formData.followupMeetingDate || null,
      SA_Pricing_Raised: formData.pricingRaisedInDemo === 'yes',
      SA_Demo_Format: formData.demoFormat || 'virtual',
      SA_F2F_Count: formData.demoFormat === 'inperson' ? 1 : 0,
      SA_Logged: true,
      Demo_Date: new Date().toISOString().split('T')[0],
    };

    let zohoUpdateSuccess = false;
    try {
      await updateDeal(c.env, formData.zohoId, dealPayload);
      zohoUpdateSuccess = true;
    } catch (e) {
      console.error('Zoho updateDeal failed:', e.message);
      // Non-blocking — D1 already saved, deal is logged locally
    }

const dealOwner = existingDeal?.data?.[0]?.Owner;

try {
  await Promise.all([
    createTask(c.env, dealId, {
      Subject: 'Meeting — Follow-up proposal walkthrough',
      Due_Date: addDays(demoDate, 7),
      Status: 'Not Started',
      Priority: 'High',
      Description: 'Schedule and conduct the follow-up meeting with the prospect.',
      Owner: dealOwner ? { id: dealOwner.id } : undefined,
    }),
  ]);
} catch (e) {
  console.error('Meeting task creation failed:', e.message);
}

    try {
      await c.env.TOKEN_CACHE.delete('deals_cache');
    } catch (e) {
      console.error('KV cache clear failed:', e.message);
    }

    await logTimelineEvent(c.env, dealId, {
      eventType: 'demo_logged',
      description: `Demo logged — Grade ${grade}`,
      actorName: user.name,
      actorEmail: user.email,
      metadata: { grade, score }
    })
    return c.json({ success: true, dealId, grade, score, zohoSynced: zohoUpdateSuccess });
  } catch (err) {
    return c.json({ error: 'Sync failed', details: err.message }, 500);
  }
});

app.post('/api/deals/:id/mark-proposal-sent', requireAuth, async (c) => {
  try {
    const dealId = c.req.param('id');
    const user = c.get('user');
    const now = new Date().toISOString();
    const existing = await c.env.DB.prepare(
      'SELECT id FROM deal_emails WHERE deal_id = ? AND email_type = ?'
    ).bind(dealId, 'day2').first();
    if (existing) {
      await c.env.DB.prepare(
        `UPDATE deal_emails SET status = 'sent', sent_at = ?, updated_at = ? WHERE deal_id = ? AND email_type = ?`
      ).bind(now, now, dealId, 'day2').run();
    } else {
      await c.env.DB.prepare(
        `INSERT INTO deal_emails (id, deal_id, email_type, subject, body, status, scheduled_for, sent_at, rep_email, created_at, updated_at)
         VALUES (?, ?, 'day2', '', '', 'sent', ?, ?, ?, ?, ?)`
      ).bind(crypto.randomUUID(), dealId, new Date().toISOString().split('T')[0], now, user.email, now, now).run();
    }
    return c.json({ success: true });
  } catch (err) {
    return c.json({ error: 'Failed to mark proposal as sent', details: err.message }, 500);
  }
});

app.post('/api/deals/:id/day2/mark-sent', requireAuth, async (c) => {
  try {
    const dealId = c.req.param('id');
    const user = c.get('user');
    const existing = await c.env.DB.prepare(
      'SELECT id FROM deal_emails WHERE deal_id = ? AND email_type = ?'
    ).bind(dealId, 'day2').first()

    if (existing) {
      await c.env.DB.prepare(
        `UPDATE deal_emails SET status = 'sent', sent_at = datetime('now') WHERE deal_id = ? AND email_type = ?`
      ).bind(dealId, 'day2').run()
    } else {
      await c.env.DB.prepare(
        `INSERT INTO deal_emails (id, deal_id, email_type, subject, body, status, sent_at, created_at, updated_at)
         VALUES (?, ?, 'day2', '', '', 'sent', datetime('now'), datetime('now'), datetime('now'))`
      ).bind(crypto.randomUUID(), dealId).run()
    }
    try {
      const dealRes = await getDeal(c.env, dealId)
      const currentStage = dealRes?.data?.[0]?.Stage
      if (currentStage === 'Demo Done') {
        await updateDeal(c.env, dealId, { Stage: 'Proposal Sent' })
        await c.env.TOKEN_CACHE.delete('v3_deals_cache')
      }
    } catch (e) {
      console.error('Stage auto-advance failed:', e.message)
    }
    await logTimelineEvent(c.env, dealId, {
      eventType: 'email_sent',
      description: 'Pricing proposal marked as sent',
      actorName: user.name,
      actorEmail: user.email,
      metadata: { emailType: 'day2' }
    })
    return c.json({ success: true });
  } catch (err) {
    return c.json({ error: 'Failed to mark day2 as sent', details: err.message }, 500);
  }
});

app.post('/api/deals/:id/day1/mark-sent', requireAuth, async (c) => {
  try {
    const dealId = c.req.param('id')
    const user = c.get('user')
    const emailType = 'day1'
    const existing = await c.env.DB.prepare(
      'SELECT id FROM deal_emails WHERE deal_id = ? AND email_type = ?'
    ).bind(dealId, emailType).first()
    if (existing) {
      await c.env.DB.prepare(
        `UPDATE deal_emails SET status = 'sent', sent_at = datetime('now'), updated_at = datetime('now') WHERE deal_id = ? AND email_type = ?`
      ).bind(dealId, emailType).run()
    } else {
      await c.env.DB.prepare(
        `INSERT INTO deal_emails (id, deal_id, email_type, subject, body, status, sent_at, created_at, updated_at) VALUES (?, ?, ?, '', '', 'sent', datetime('now'), datetime('now'), datetime('now'))`
      ).bind(crypto.randomUUID(), dealId, emailType).run()
    }
    await c.env.TOKEN_CACHE.delete('v3_deals_cache')
    await logTimelineEvent(c.env, dealId, {
      eventType: 'email_sent',
      description: `${emailType} email marked as sent manually`,
      actorName: user.name,
      actorEmail: user.email,
      metadata: { emailType, method: 'manual' }
    })
    return c.json({ success: true })
  } catch (err) {
    return c.json({ error: err.message }, 500)
  }
})

app.post('/api/deals/:id/day3/mark-sent', requireAuth, async (c) => {
  try {
    const dealId = c.req.param('id')
    const user = c.get('user')
    const emailType = 'day3'
    const existing = await c.env.DB.prepare(
      'SELECT id FROM deal_emails WHERE deal_id = ? AND email_type = ?'
    ).bind(dealId, emailType).first()
    if (existing) {
      await c.env.DB.prepare(
        `UPDATE deal_emails SET status = 'sent', sent_at = datetime('now'), updated_at = datetime('now') WHERE deal_id = ? AND email_type = ?`
      ).bind(dealId, emailType).run()
    } else {
      await c.env.DB.prepare(
        `INSERT INTO deal_emails (id, deal_id, email_type, subject, body, status, sent_at, created_at, updated_at) VALUES (?, ?, ?, '', '', 'sent', datetime('now'), datetime('now'), datetime('now'))`
      ).bind(crypto.randomUUID(), dealId, emailType).run()
    }
    await c.env.TOKEN_CACHE.delete('v3_deals_cache')
    await logTimelineEvent(c.env, dealId, {
      eventType: 'email_sent',
      description: `${emailType} email marked as sent manually`,
      actorName: user.name,
      actorEmail: user.email,
      metadata: { emailType, method: 'manual' }
    })
    return c.json({ success: true })
  } catch (err) {
    return c.json({ error: err.message }, 500)
  }
})

app.post('/api/deals/:id/day4/mark-sent', requireAuth, async (c) => {
  try {
    const dealId = c.req.param('id')
    const user = c.get('user')
    const emailType = 'day4'
    const existing = await c.env.DB.prepare(
      'SELECT id FROM deal_emails WHERE deal_id = ? AND email_type = ?'
    ).bind(dealId, emailType).first()
    if (existing) {
      await c.env.DB.prepare(
        `UPDATE deal_emails SET status = 'sent', sent_at = datetime('now'), updated_at = datetime('now') WHERE deal_id = ? AND email_type = ?`
      ).bind(dealId, emailType).run()
    } else {
      await c.env.DB.prepare(
        `INSERT INTO deal_emails (id, deal_id, email_type, subject, body, status, sent_at, created_at, updated_at) VALUES (?, ?, ?, '', '', 'sent', datetime('now'), datetime('now'), datetime('now'))`
      ).bind(crypto.randomUUID(), dealId, emailType).run()
    }
    await c.env.TOKEN_CACHE.delete('v3_deals_cache')
    await logTimelineEvent(c.env, dealId, {
      eventType: 'email_sent',
      description: `${emailType} email marked as sent manually`,
      actorName: user.name,
      actorEmail: user.email,
      metadata: { emailType, method: 'manual' }
    })
    return c.json({ success: true })
  } catch (err) {
    return c.json({ error: err.message }, 500)
  }
})

app.post('/api/deals/:id/nudge/mark-sent', requireAuth, async (c) => {
  try {
    const dealId = c.req.param('id')
    const user = c.get('user')
    const emailType = 'nudge'
    const existing = await c.env.DB.prepare(
      'SELECT id FROM deal_emails WHERE deal_id = ? AND email_type = ?'
    ).bind(dealId, emailType).first()
    if (existing) {
      await c.env.DB.prepare(
        `UPDATE deal_emails SET status = 'sent', sent_at = datetime('now'), updated_at = datetime('now') WHERE deal_id = ? AND email_type = ?`
      ).bind(dealId, emailType).run()
    } else {
      await c.env.DB.prepare(
        `INSERT INTO deal_emails (id, deal_id, email_type, subject, body, status, sent_at, created_at, updated_at) VALUES (?, ?, ?, '', '', 'sent', datetime('now'), datetime('now'), datetime('now'))`
      ).bind(crypto.randomUUID(), dealId, emailType).run()
    }
    await c.env.TOKEN_CACHE.delete('v3_deals_cache')
    await logTimelineEvent(c.env, dealId, {
      eventType: 'email_sent',
      description: `${emailType} email marked as sent manually`,
      actorName: user.name,
      actorEmail: user.email,
      metadata: { emailType, method: 'manual' }
    })
    return c.json({ success: true })
  } catch (err) {
    return c.json({ error: err.message }, 500)
  }
})

app.post('/api/deals/:id/generate-content', requireAuth, async (c) => {
  try {
    const dealId = c.req.param('id');
    const user = c.get('user');

    const formRecord = await c.env.DB.prepare(
      'SELECT * FROM deal_form_data WHERE deal_id = ?'
    ).bind(dealId).first();

    if (!formRecord) return c.json({ error: 'No form data found for this deal' }, 404);

    const formData = {
      zohoId: formRecord.deal_id,
      prospectName: formRecord.prospect_name,
      prospectEmail: formRecord.prospect_email,
      brandName: formRecord.brand_name,
      orderVolume: formRecord.order_volume,
      solutionInterest: formRecord.solution_interest,
      demoFormat: formRecord.demo_format,
      dmPresent: formRecord.dm_present,
      brandType: formRecord.brand_type,
      shippingPains: JSON.parse(formRecord.shipping_pains || '[]'),
      warehousingPains: JSON.parse(formRecord.warehousing_pains || '[]'),
      shippingPainOther: formRecord.shipping_pain_other,
      warehousingPainOther: formRecord.warehousing_pain_other,
      painClarity: formRecord.pain_clarity,
      engagementLevel: formRecord.engagement_level,
      objections: formRecord.objections,
      competitorMentioned: formRecord.competitor_mentioned,
      budgetSignal: formRecord.budget_signal,
      purchaseTimeline: formRecord.purchase_timeline,
      nextStep: formRecord.next_step,
      followupMeetingDate: formRecord.followup_meeting_date,
      urgencyDriver: formRecord.urgency_driver,
      pricingRaisedInDemo: formRecord.pricing_raised,
      featuresShown: JSON.parse(formRecord.features_shown || '[]'),
      transcript: formRecord.transcript,
      repNotes: formRecord.rep_notes,
      repName: formRecord.rep_name,
    };
    const grade = formRecord.grade;
    const score = formRecord.score;

    let drafts = null;
    try {
      drafts = await generateEmailDrafts(c.env, formData, grade, score);
    } catch (e) {
      if (e.code === 'CLAUDE_RATE_LIMIT') return c.json({ error: 'Claude is busy — please try again in a minute' }, 429);
      if (e.code === 'CLAUDE_OVERLOADED') return c.json({ error: 'Claude is temporarily overloaded — please try again in a few minutes' }, 503);
      console.error('Email draft generation failed:', e.message);
      return c.json({ error: 'Email generation failed: ' + (e.message || 'unknown error'), emailsGenerated: 0 }, 500);
    }

    let analysis = null;
    let dealSummary = null;
    try {
      [analysis, dealSummary] = await Promise.all([
        generateDealAnalysis(c.env, formData, grade, score),
        generateDealSummary(c.env, formData),
      ]);
    } catch (e) {
      console.error('Analysis/summary generation failed:', e.message);
    }

    try {
      await c.env.DB.prepare(
        `UPDATE deal_form_data SET ai_analysis = ?, deal_summary = ?, updated_at = ? WHERE deal_id = ?`
      ).bind(
        analysis ? JSON.stringify(analysis) : null,
        dealSummary || null,
        new Date().toISOString(),
        dealId
      ).run();
    } catch (e) {
      console.error('D1 analysis update failed:', e.message);
    }

    let emailsGenerated = 0;
    if (drafts) {
      try {
        const demoDate = formRecord.demo_date
          ? new Date(formRecord.demo_date)
          : new Date();
        const addDays = (date, days) => new Date(date.getTime() + days * 86400000).toISOString().split('T')[0];
        const nowISO = new Date().toISOString();
        // Clear stale drafts before inserting fresh ones
        await c.env.DB.prepare(
          `DELETE FROM deal_emails WHERE deal_id = ? AND email_type IN ('day1', 'day3', 'day4', 'nudge')`
        ).bind(dealId).run();
        const emailsToSave = [
          { type: 'day1', subject: drafts.recap.subject, body: drafts.recap.body, scheduledFor: addDays(demoDate, 0) },
          { type: 'day3', subject: `Re: ${drafts.recap.subject}`, body: drafts.roi.body, scheduledFor: addDays(demoDate, 3) },
          { type: 'day4', subject: `Re: ${drafts.recap.subject}`, body: drafts.objection.body, scheduledFor: addDays(demoDate, 4) },
          { type: 'nudge', subject: drafts.nudge.subject, body: drafts.nudge.body, scheduledFor: addDays(demoDate, 14) },
        ];
        for (const email of emailsToSave) {
          await c.env.DB.prepare(`
            INSERT INTO deal_emails (id, deal_id, email_type, subject, body, status, scheduled_for, rep_email, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).bind(
            crypto.randomUUID(), dealId, email.type, email.subject, email.body,
            'draft', email.scheduledFor, user.email, nowISO, nowISO
          ).run();
        }
        emailsGenerated = 4;
      } catch (e) {
        console.error('Email D1 insert failed:', e.message);
        return c.json({ error: 'Email generation failed: ' + (e.message || 'unknown error'), emailsGenerated: 0 }, 500);
      }
    }

    await logTimelineEvent(c.env, dealId, {
      eventType: 'emails_generated',
      description: 'Email sequence generated by AI',
      actorName: user.name,
      actorEmail: user.email,
    })
    return c.json({ success: true, emailsGenerated, analysisGenerated: !!analysis });
  } catch (err) {
    return c.json({ error: 'Content generation failed', details: err.message }, 500);
  }
});

app.put('/api/deals/:id/f2f', requireAuth, async (c) => {
  try {
    const dealId = c.req.param('id');
    const { meetingType } = await c.req.json();
    const dealRes = await getDeal(c.env, dealId);
    if (!dealRes?.data?.[0]) return c.json({ error: 'Deal not found' }, 404);
    const currentF2F = dealRes.data[0].SA_F2F_Count || 0;
    const currentScore = dealRes.data[0].SA_Forecast_Probability || 0;
    const currentGrade = dealRes.data[0].Deal_Grade || 'D';
    let newScore = currentScore;
    if (meetingType === 'warehouse') newScore = Math.min(currentScore + 3, 22);
    else if (meetingType === 'inperson') newScore = Math.min(currentScore + 2, 22);
    const newGrade = scoreToGrade(newScore);
    await updateDeal(c.env, dealId, { SA_F2F_Count: currentF2F + 1, SA_Forecast_Probability: newScore, Deal_Grade: newGrade });
    return c.json({ success: true, previousGrade: currentGrade, newGrade, previousScore: currentScore, newScore, f2fCount: currentF2F + 1 });
  } catch (err) {
    return c.json({ error: 'Failed to log F2F', details: err.message }, 500);
  }
});

app.get('/api/deals/:id/f2f-log', requireAuth, async (c) => {
  try {
    const dealId = c.req.param('id');
    const dealRes = await getDeal(c.env, dealId);
    if (!dealRes?.data?.[0]) return c.json({ error: 'Deal not found' }, 404);
    const count = dealRes.data[0].SA_F2F_Count || 0;
    return c.json({ count, logs: [] });
  } catch (err) {
    return c.json({ error: 'Failed to fetch F2F log', details: err.message }, 500);
  }
});

app.post('/api/deals/:id/close', requireAuth, async (c) => {
  try {
    const dealId = c.req.param('id');
    const { outcome, reason, notes } = await c.req.json();
    if (!outcome || !['won', 'lost'].includes(outcome)) {
      return c.json({ error: 'outcome must be "won" or "lost"' }, 400);
    }
    const stage = outcome === 'won' ? 'Won/Payment Received' : 'Lost/Dropped';
    const updatePayload = { Stage: stage };
    if (outcome === 'lost' && reason) updatePayload.Lost_Reason = reason;
    if (reason) updatePayload.SA_Segment = reason;
    await updateDeal(c.env, dealId, updatePayload);
    await c.env.TOKEN_CACHE.delete('deals_cache');
    return c.json({ success: true });
  } catch (err) {
    return c.json({ error: 'Failed to close deal', details: err.message }, 500);
  }
});

app.patch('/api/deals/:id/stage', requireAuth, async (c) => {
  try {
    const dealId = c.req.param('id')
    const user = c.get('user')
    const { stage, reason } = await c.req.json()
    const payload = { Stage: stage }
    if (stage === 'Lost/Dropped') payload.Lost_Reason = reason
    if (stage === 'On Hold') payload.On_Hold_Reason = reason
    await updateDeal(c.env, dealId, payload)
    await c.env.TOKEN_CACHE.delete('v3_deals_cache')
    await logTimelineEvent(c.env, dealId, {
      eventType: 'stage_changed',
      description: `Stage moved to ${stage}`,
      actorName: user.name,
      actorEmail: user.email,
      metadata: { to: stage, reason }
    })
    if (stage === 'Lost/Dropped') {
      await logTimelineEvent(c.env, dealId, {
        eventType: 'mark_lost',
        description: `Deal marked as Lost — ${reason || 'No reason'}`,
        actorName: user.name,
        actorEmail: user.email,
        metadata: { reason }
      })
    }
    if (stage === 'On Hold') {
      await logTimelineEvent(c.env, dealId, {
        eventType: 'mark_on_hold',
        description: 'Deal marked as On Hold',
        actorName: user.name,
        actorEmail: user.email,
      })
    }
    return c.json({ success: true })
  } catch (err) {
    return c.json({ error: err.message }, 500)
  }
})

app.post('/api/deals/:id/stage', requireAuth, async (c) => {
  try {
    const dealId = c.req.param('id')
    const user = c.get('user')
    const { stage, reason } = await c.req.json()
    const VALID_STAGES = [
      'Upcoming Demo', 'Demo Done', 'Proposal Sent',
      'Account Setup in Progress', 'Awaiting First Shipment',
      'First Shipment Done', 'Active', 'On Hold',
      'Won/Payment Received', 'Lost/Dropped',
      'Follow up Meeting Done', 'Demo Approved'
    ]
    if (!VALID_STAGES.includes(stage)) {
      return c.json({ error: 'Invalid stage' }, 400)
    }
    await updateDeal(c.env, dealId, { Stage: stage })
    await c.env.TOKEN_CACHE.delete('v3_deals_cache')
    if (stage === 'Lost/Dropped') {
      await logTimelineEvent(c.env, dealId, {
        eventType: 'mark_lost',
        description: `Deal marked as Lost — ${reason || 'No reason'}`,
        actorName: user?.name || '',
        actorEmail: user?.email || '',
        metadata: { reason }
      })
    } else if (stage === 'On Hold') {
      await logTimelineEvent(c.env, dealId, {
        eventType: 'mark_on_hold',
        description: 'Deal marked as On Hold',
        actorName: user?.name || '',
        actorEmail: user?.email || '',
      })
    } else {
      await logTimelineEvent(c.env, dealId, {
        eventType: 'stage_changed',
        description: `Stage moved to ${stage}`,
        actorName: user?.name || '',
        actorEmail: user?.email || '',
        metadata: { to: stage }
      })
    }
    return c.json({ success: true, stage })
  } catch (err) {
    return c.json({ error: err.message }, 500)
  }
})

app.get('/api/deals/:id/timeline', requireAuth, async (c) => {
  const dealId = c.req.param('id')
  try {
    const [d1Events, dealRes, stageHistory, notesRes, callsRes, meetingsRes, tasksRes] = await Promise.all([
      c.env.DB.prepare('SELECT * FROM deal_timeline WHERE deal_id = ? ORDER BY created_at DESC').bind(dealId).all(),
      getDeal(c.env, dealId),
      fetch(
        `https://www.zohoapis.com/crm/v2.1/Deals/${dealId}/Stage_History`,
        { headers: { Authorization: `Zoho-oauthtoken ${await getAccessToken(c.env)}` } }
      ).then(r => r.ok ? r.json() : null),
      getDealNotes(c.env, dealId),
      getDealCalls(c.env, dealId),
      getDealMeetings(c.env, dealId),
      getDealTasks(c.env, dealId),
    ])

    const zohoEvents = (stageHistory?.data || []).map(s => ({
      id: s.id,
      event_type: 'stage_changed_zoho',
      description: s.Moved_To__s
        ? `Stage: ${s.Stage} → ${s.Moved_To__s}`
        : `Stage changed to ${s.Stage}`,
      actor_name: s.Modified_By?.name || 'Zoho CRM',
      actor_email: s.Modified_By?.email || '',
      metadata: JSON.stringify({ stage: s.Stage, movedTo: s.Moved_To__s, probability: s.Probability }),
      created_at: s.Modified_Time,
      source: 'zoho'
    }))

    const notesEvents = (notesRes?.data || []).map(n => ({
      id: 'note_' + n.id,
      event_type: 'note_added',
      description: `Note: ${(n.Note_Content || n.Note_Title || '').slice(0, 80)}${(n.Note_Content || '').length > 80 ? '...' : ''}`,
      actor_name: n.Created_By?.name || 'Zoho CRM',
      actor_email: '',
      metadata: JSON.stringify({}),
      created_at: n.Created_Time,
      source: 'zoho'
    }))

    const callEvents = (callsRes?.data || []).map(cl => ({
      id: 'call_' + cl.id,
      event_type: cl.Call_Status === 'Scheduled' ? 'call_scheduled' : 'call_logged',
      description: `Call: ${cl.Subject || cl.Call_Purpose || 'Call'} — ${cl.Call_Status || ''}`,
      actor_name: cl.Created_By?.name || 'Zoho CRM',
      actor_email: '',
      metadata: JSON.stringify({ purpose: cl.Call_Purpose, result: cl.Call_Result }),
      created_at: cl.Created_Time || cl.Call_Start_Time,
      source: 'zoho'
    }))

    const meetingEvents = (meetingsRes?.data || []).map(m => ({
      id: 'meeting_' + m.id,
      event_type: 'meeting_created',
      description: `Meeting: ${m.Event_Title || 'Meeting'} — ${m.Venue || ''}`,
      actor_name: m.Created_By?.name || 'Zoho CRM',
      actor_email: '',
      metadata: JSON.stringify({ venue: m.Venue }),
      created_at: m.Created_Time || m.Start_DateTime,
      source: 'zoho'
    }))

    const taskEvents = (tasksRes?.data || []).map(t => ({
      id: 'task_' + t.id,
      event_type: t.Status === 'Completed' ? 'task_completed' : 'task_created',
      description: `Task: ${t.Subject || 'Task'} — ${t.Status || ''}`,
      actor_name: t.Owner?.name || 'Zoho CRM',
      actor_email: '',
      metadata: JSON.stringify({ dueDate: t.Due_Date }),
      created_at: t.Created_Time,
      source: 'zoho'
    }))

    const rawDeal = dealRes?.data?.[0]
    const dealCreatedEvent = {
      id: 'deal_created',
      event_type: 'deal_created',
      description: 'Deal created',
      actor_name: rawDeal?.Owner?.name || '',
      actor_email: rawDeal?.Owner?.email || '',
      metadata: JSON.stringify({}),
      created_at: rawDeal?.Created_Time || '',
      source: 'zoho'
    }

    const d1Mapped = (d1Events.results || []).map(e => ({ ...e, source: 'salesassist' }))

    const d1Fingerprints = new Set(
      d1Mapped.map(e => `${e.event_type}_${(e.created_at || '').slice(0, 16)}`)
    )

    const zohoToD1Type = {
      'task_created':      ['task_created'],
      'task_completed':    ['task_completed'],
      'call_logged':       ['call_logged'],
      'call_scheduled':    ['call_scheduled'],
      'call_completed':    ['call_completed'],
      'meeting_created':   ['meeting_created'],
      'meeting_completed': ['meeting_completed'],
      'note_added':        ['note_added'],
    }

    function isZohoDuplicate(zohoEvent) {
      const minute = (zohoEvent.created_at || '').slice(0, 16)
      const d1Types = zohoToD1Type[zohoEvent.event_type] || []
      return d1Types.some(t => d1Fingerprints.has(`${t}_${minute}`))
    }

    const dedupedTaskEvents    = taskEvents.filter(e => !isZohoDuplicate(e))
    const dedupedCallEvents    = callEvents.filter(e => !isZohoDuplicate(e))
    const dedupedMeetingEvents = meetingEvents.filter(e => !isZohoDuplicate(e))
    const dedupedNotesEvents   = notesEvents.filter(e => !isZohoDuplicate(e))

    const merged = [
      ...d1Mapped,
      ...zohoEvents,
      ...dedupedTaskEvents,
      ...dedupedCallEvents,
      ...dedupedMeetingEvents,
      ...dedupedNotesEvents,
      dealCreatedEvent
    ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))

    return c.json({ timeline: merged })
  } catch (err) {
    return c.json({ error: err.message }, 500)
  }
})

app.get('/api/deals/:id/notes', requireAuth, async (c) => {
  try {
    const dealId = c.req.param('id')
    const { results } = await c.env.DB.prepare(
      'SELECT id, content, author_name as authorName, author_email as authorEmail, created_at as createdAt FROM deal_notes WHERE deal_id = ? ORDER BY created_at DESC'
    ).bind(dealId).all()
    return c.json({ notes: results || [] })
  } catch (err) {
    return c.json({ notes: [] })
  }
})

app.post('/api/deals/:id/notes', requireAuth, async (c) => {
  try {
    const dealId = c.req.param('id')
    const user = c.get('user')
    const { content } = await c.req.json()
    const id = crypto.randomUUID()
    const now = new Date().toISOString()
    await c.env.DB.prepare(
      'INSERT INTO deal_notes (id, deal_id, content, author_email, author_name, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(id, dealId, content, user.email, user.name, now).run()
    try {
      await zohoAPI(c.env, 'POST', '/Notes', {
        data: [{
          Note_Title: 'Sales Assist Note',
          Note_Content: content,
          Parent_Id: dealId,
          '$se_module': 'Deals'
        }]
      })
    } catch (zohoErr) {
      console.error('Zoho note sync failed (non-blocking):', zohoErr.message)
    }
    await logTimelineEvent(c.env, dealId, {
      eventType: 'note_added',
      description: 'Note added',
      actorName: user.name,
      actorEmail: user.email,
    })
    return c.json({ success: true, note: { id, content, authorEmail: user.email, authorName: user.name, createdAt: now } })
  } catch (err) {
    return c.json({ error: err.message }, 500)
  }
})

app.post('/api/deals/:id/f2f', requireAuth, async (c) => {
  try {
    const dealId = c.req.param('id')
    const { date, notes } = await c.req.json()
    const deal = await getDeal(c.env, dealId)
    const currentF2F = deal?.data?.[0]?.SA_F2F_Count || 0
    await updateDeal(c.env, dealId, {
      SA_F2F_Count: currentF2F + 1,
    })
    await c.env.TOKEN_CACHE.delete('v3_deals_cache')
    return c.json({ success: true })
  } catch (err) {
    return c.json({ error: err.message }, 500)
  }
})

app.post('/api/deals/:id/activities', requireAuth, async (c) => {
  try {
    const dealId = c.req.param('id')
    const { type, subject, notes } = await c.req.json()

    const token = await getAccessToken(c.env)

    const payload = {
      Note_Title: subject,
      Note_Content: `[${type}] ${notes || ''}`,
      Parent_Id: dealId,
      $se_module: 'Deals',
    }

    const res = await fetch(
      'https://www.zohoapis.com/crm/v2/Notes',
      {
        method: 'POST',
        headers: {
          Authorization: `Zoho-oauthtoken ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ data: [payload] })
      }
    ).then(r => r.json())

    console.log('Zoho activity response:', JSON.stringify(res))

    if (res.data?.[0]?.code === 'SUCCESS') {
      return c.json({ success: true })
    } else {
      return c.json({
        error: res.data?.[0]?.message || res.message || 'Zoho activity creation failed',
        details: res
      }, 400)
    }
  } catch (err) {
    return c.json({ error: err.message }, 500)
  }
})

function toZohoDateTime(dtLocal) {
  if (!dtLocal) return null
  const d = new Date(dtLocal)
  const pad = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:00+05:30`
}

app.post('/api/deals/:id/meeting', requireAuth, async (c) => {
  try {
    const dealId = c.req.param('id')
    const user = c.get('user')
    const body = await c.req.json()
    const zohoRes = await createZohoEvent(c.env, dealId, {
      ...body,
      from: toZohoDateTime(body.from),
      to: toZohoDateTime(body.to),
    })
    console.log('Zoho response:', JSON.stringify(zohoRes))
    if (!zohoRes || zohoRes.data?.[0]?.status === 'error') {
      console.error('Zoho error:', JSON.stringify(zohoRes))
      return c.json({ error: 'Zoho API error', details: zohoRes }, 500)
    }
    await logTimelineEvent(c.env, dealId, {
      eventType: 'meeting_created',
      description: `Meeting scheduled: ${body.title}`,
      actorName: user.name,
      actorEmail: user.email,
      metadata: { title: body.title, venue: body.venue }
    })
    return c.json({ success: true })
  } catch (err) {
    return c.json({ error: err.message }, 500)
  }
})

app.post('/api/deals/:id/log-call', requireAuth, async (c) => {
  try {
    const dealId = c.req.param('id')
    const user = c.get('user')
    const body = await c.req.json()
    const zohoRes = await createZohoCall(c.env, dealId, {
      ...body,
      callStatus: 'Completed',
      subject: `Call - ${body.callPurpose}`,
      callTiming: toZohoDateTime(body.callTiming),
    })
    console.log('Zoho response:', JSON.stringify(zohoRes))
    if (!zohoRes || zohoRes.data?.[0]?.status === 'error') {
      console.error('Zoho error:', JSON.stringify(zohoRes))
      return c.json({ error: 'Zoho API error', details: zohoRes }, 500)
    }
    await logTimelineEvent(c.env, dealId, {
      eventType: 'call_logged',
      description: `Call logged: ${body.callPurpose}`,
      actorName: user.name,
      actorEmail: user.email,
      metadata: { purpose: body.callPurpose, result: body.callResult }
    })
    return c.json({ success: true })
  } catch (err) {
    return c.json({ error: err.message }, 500)
  }
})

app.post('/api/deals/:id/schedule-call', requireAuth, async (c) => {
  try {
    const dealId = c.req.param('id')
    const user = c.get('user')
    const body = await c.req.json()
    const zohoRes = await createZohoCall(c.env, dealId, {
      ...body,
      callStatus: 'Scheduled',
      subject: `Scheduled Call - ${body.callPurpose}`,
      callTiming: toZohoDateTime(body.callTiming),
    })
    console.log('Zoho response:', JSON.stringify(zohoRes))
    if (!zohoRes || zohoRes.data?.[0]?.status === 'error') {
      console.error('Zoho error:', JSON.stringify(zohoRes))
      return c.json({ error: 'Zoho API error', details: zohoRes }, 500)
    }
    await logTimelineEvent(c.env, dealId, {
      eventType: 'call_scheduled',
      description: `Call scheduled: ${body.callPurpose}`,
      actorName: user.name,
      actorEmail: user.email,
      metadata: { purpose: body.callPurpose, timing: body.callTiming }
    })
    return c.json({ success: true })
  } catch (err) {
    return c.json({ error: err.message }, 500)
  }
})

app.patch('/api/deals/:id/meeting/:meetingId/complete', requireAuth, async (c) => {
  try {
    const dealId = c.req.param('id')
    const meetingId = c.req.param('meetingId')
    const user = c.get('user')
    function msToZohoIST(ms) {
      const d = new Date(ms + (5.5 * 60 * 60 * 1000))
      const pad = n => String(n).padStart(2, '0')
      return `${d.getUTCFullYear()}-${pad(d.getUTCMonth()+1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:00+05:30`
    }
    const startMs = Date.now() - (2 * 60 * 1000)
    const endMs = Date.now() - (1 * 60 * 1000)
    const res = await zohoAPI(c.env, 'PUT', `/Events/${meetingId}`, { data: [{ id: meetingId, Start_DateTime: msToZohoIST(startMs), End_DateTime: msToZohoIST(endMs) }] })
    await logTimelineEvent(c.env, dealId, {
      eventType: 'meeting_completed',
      description: 'Meeting marked as completed',
      actorName: user.name,
      actorEmail: user.email,
      metadata: { meetingId }
    })
    return c.json({ success: true })
  } catch (err) {
    return c.json({ error: err.message }, 500)
  }
})

app.patch('/api/deals/:id/call/:callId/complete', requireAuth, async (c) => {
  try {
    const dealId = c.req.param('id')
    const callId = c.req.param('callId')
    const callRes = await zohoAPI(c.env, 'GET', `/Calls/${callId}?fields=Subject,Call_Purpose,Call_Agenda,Description,Call_Start_Time,What_Id`)
    const callData = callRes?.data?.[0]
    function msToZohoIST(ms) {
      const d = new Date(ms + (5.5 * 60 * 60 * 1000))
      const pad = n => String(n).padStart(2, '0')
      return `${d.getUTCFullYear()}-${pad(d.getUTCMonth()+1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:00+05:30`
    }
    const nowIST = msToZohoIST(Date.now())
    await zohoAPI(c.env, 'DELETE', `/Calls?ids=${callId}`)
    await zohoAPI(c.env, 'POST', '/Calls', {
      data: [{
        Subject: callData?.Subject || 'Call',
        Call_Type: 'Outbound',
        Call_Status: 'Completed',
        Call_Duration: '00:05',
        Call_Purpose: callData?.Call_Purpose || '',
        Call_Agenda: callData?.Call_Agenda || '',
        Description: callData?.Description || '',
        Call_Start_Time: nowIST,
        What_Id: dealId,
        '$se_module': 'Deals',
      }]
    })
    const user = c.get('user')
    await logTimelineEvent(c.env, dealId, {
      eventType: 'call_completed',
      description: 'Call marked as completed',
      actorName: user.name,
      actorEmail: user.email,
      metadata: { callId }
    })
    return c.json({ success: true })
  } catch (err) {
    console.error('Call complete error:', err.message, err.stack)
    return c.json({ error: err.message }, 500)
  }
})

app.post('/api/reengage', requireAuth, async (c) => {
  try {
    const { dealContext, angle } = await c.req.json();
    const validAngles = ['value', 'checkin', 'urgency', 'breakup'];
    if (!validAngles.includes(angle)) return c.json({ error: 'Invalid angle' }, 400);
    if (!dealContext) return c.json({ error: 'Deal context required' }, 400);
    const draft = await generateReengagement(c.env, dealContext, angle);
    return c.json({ success: true, draft });
  } catch (err) {
    return c.json({ error: 'Failed to generate re-engagement', details: err.message }, 500);
  }
});
// ─── EMAIL STORAGE ROUTES ─────────────────────────────────────────────────

// Save emails after form submission
app.post('/api/deals/:id/emails', requireAuth, async (c) => {
  try {
    const dealId = c.req.param('id');
    const { emails } = await c.req.json();
    const now = new Date().toISOString();

    for (const email of emails) {
      const id = crypto.randomUUID();
      await c.env.DB.prepare(`
        INSERT INTO deal_emails (id, deal_id, email_type, subject, body, status, scheduled_for, rep_email, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO NOTHING
      `).bind(
        id, dealId, email.type, email.subject, email.body,
        email.status || 'draft', email.scheduledFor || null,
        email.repEmail || null, now, now
      ).run();
    }
    return c.json({ success: true });
  } catch (err) {
    return c.json({ error: 'Failed to save emails', details: err.message }, 500);
  }
});

// Send emails for a deal
app.get('/api/deals/:id/emails', requireAuth, async (c) => {
  try {
    const dealId = c.req.param('id');
    const user = c.get('user');
    let effectiveUser = user;
    if (user.email === 'satyanarayan.sahoo@eshopbox.com') {
      const viewAsEmail = c.req.header('x-view-as-email');
      if (viewAsEmail) {
        const viewAsUser = await c.env.DB.prepare(
          'SELECT id, email, name, role FROM users WHERE email = ?'
        ).bind(viewAsEmail).first();
        if (viewAsUser) effectiveUser = viewAsUser;
      }
    }
    const emailRows = await c.env.DB.prepare(
      'SELECT * FROM deal_emails WHERE deal_id = ? ORDER BY created_at ASC'
    ).bind(dealId).all();

    const emails = emailRows.results || [];

    return c.json({ emails });
  } catch (err) {
    return c.json({ error: 'Failed to fetch emails', details: err.message }, 500);
  }
});

// Get emails for a deal
app.post('/api/deals/:id/send-email', requireAuth, async (c) => {
  try {
    const dealId = c.req.param('id');
    const { subject, body, cc } = await c.req.json();
    if (!subject || !body) return c.json({ error: 'Subject and body required' }, 400);
    const result = await sendDealEmail(c.env, dealId, subject, body, cc || '');
    return c.json({ success: true, result });
  } catch (err) {
    return c.json({ error: 'Failed to send email', details: err.message }, 500);
  }
});

// Update email (edit body/subject before sending)
app.put('/api/deals/:id/emails/:emailType', requireAuth, async (c) => {
  try {
    const dealId = c.req.param('id');
    const emailType = c.req.param('emailType');
    const { subject, body } = await c.req.json();
    const now = new Date().toISOString();

    await c.env.DB.prepare(`
      UPDATE deal_emails SET subject = ?, body = ?, updated_at = ?
      WHERE deal_id = ? AND email_type = ? AND status != 'sent'
    `).bind(subject, body, now, dealId, emailType).run();

    return c.json({ success: true });
  } catch (err) {
    return c.json({ error: 'Failed to update email', details: err.message }, 500);
  }
});

// Send or schedule an email
app.post('/api/deals/:id/emails/:emailType/send', requireAuth, async (c) => {
  try {
    const dealId = c.req.param('id');
    const emailType = c.req.param('emailType');
    const user = c.get('user');
    const now = new Date().toISOString();

    // Get the email from DB
    const emailRow = await c.env.DB.prepare(
      'SELECT * FROM deal_emails WHERE deal_id = ? AND email_type = ?'
    ).bind(dealId, emailType).first();

    if (!emailRow) return c.json({ error: 'Email not found' }, 404);
    if (emailRow.status === 'sent') return c.json({ error: 'Email already sent' }, 400);

    // Check if this should be sent now or scheduled
    const body = await c.req.json().catch(() => ({}));
    const cc = body.cc || '';
    const sendNow = emailType === 'day1' || emailType === 'day4' || !emailRow.scheduled_for ||
      new Date(emailRow.scheduled_for) <= new Date();

    if (sendNow) {
      // Send immediately via Zoho
      const result = await sendDealEmail(c.env, dealId, emailRow.subject, emailRow.body, cc);

      await c.env.DB.prepare(`
        UPDATE deal_emails SET status = 'sent', sent_at = ?, zoho_message_id = ?, updated_at = ?
        WHERE deal_id = ? AND email_type = ?
      `).bind(now, result?.data?.[0]?.details?.id || null, now, dealId, emailType).run();

      return c.json({ success: true, status: 'sent' });
    } else {
      // Schedule for later
      await c.env.DB.prepare(`
        UPDATE deal_emails SET status = 'scheduled', rep_email = ?, updated_at = ?
        WHERE deal_id = ? AND email_type = ?
      `).bind(user.email, now, dealId, emailType).run();

      return c.json({ success: true, status: 'scheduled', scheduledFor: emailRow.scheduled_for });
    }
  } catch (err) {
    return c.json({ error: 'Failed to send email', details: err.message }, 500);
  }
});

app.post('/api/deals/:id/emails/:emailType/mark-sent', requireAuth, async (c) => {
  try {
    const dealId = c.req.param('id');
    const emailType = c.req.param('emailType');
    const loggedInUser = c.get('user');

    const emailRow = await c.env.DB.prepare(
      'SELECT gmail_draft_id, gmail_message_id, gmail_thread_id, rep_email, draft_created_at FROM deal_emails WHERE deal_id = ? AND email_type = ?'
    ).bind(dealId, emailType).first();

    console.log('mark-sent: emailRow =', JSON.stringify(emailRow));

    if (!emailRow?.gmail_draft_id) {
      return c.json({ success: true, sent: false });
    }

    let accessToken;
    try {
      accessToken = await getGmailAccessToken(c.env, loggedInUser.id);
    } catch (e) {
      return c.json({ error: 'Gmail not connected', code: 'GMAIL_NOT_CONNECTED' }, 400);
    }

    const { sent } = await checkDraftSent(
      accessToken, loggedInUser.email, emailRow.gmail_draft_id, emailRow.gmail_message_id, emailRow.gmail_thread_id || null, emailRow.draft_created_at || null
    );

    if (sent) {
      const realResult = await getRealMessageId(
        accessToken, loggedInUser.email,
        emailRow.gmail_draft_id, emailRow.gmail_message_id
      );
      const realMessageId = realResult?.messageId || null;
      const realThreadId = realResult?.threadId || null;
      console.log('mark-sent: realMessageId =', realMessageId);
      const now = new Date().toISOString();
      await c.env.DB.prepare(
        `UPDATE deal_emails SET status = 'sent', sent_at = ?, updated_at = ?, thread_message_id = COALESCE(?, thread_message_id), gmail_thread_id = COALESCE(?, gmail_thread_id) WHERE deal_id = ? AND email_type = ?`
      ).bind(now, now, realMessageId, realThreadId, dealId, emailType).run();
      await logTimelineEvent(c.env, dealId, {
        eventType: 'email_sent',
        description: `${emailType} email sent via Gmail`,
        actorName: loggedInUser.name,
        actorEmail: loggedInUser.email,
        metadata: { emailType }
      })
      return c.json({ success: true, sent: true, sent_at: now });
    }

    return c.json({ success: true, sent: false });
  } catch (err) {
    return c.json({ error: 'Failed to check sent status', details: err.message }, 500);
  }
});

app.post('/api/deals/:id/emails/:type/undo-sent', requireAuth, async (c) => {
  try {
    const user = c.get('user')
    if (user.email !== 'satyanarayan.sahoo@eshopbox.com') {
      return c.json({ error: 'Unauthorized' }, 403)
    }
    const dealId = c.req.param('id')
    const emailType = c.req.param('type')
    await c.env.DB.prepare(
      `UPDATE deal_emails SET status = 'draft', sent_at = NULL, gmail_draft_id = NULL, gmail_message_id = NULL, gmail_thread_id = NULL, thread_message_id = NULL, updated_at = datetime('now') WHERE deal_id = ? AND email_type = ?`
    ).bind(dealId, emailType).run()
    await c.env.TOKEN_CACHE.delete('v3_deals_cache')
    return c.json({ success: true })
  } catch (err) {
    return c.json({ error: err.message }, 500)
  }
})

app.get('/api/deals/:id/emails/:type/check-draft', requireAuth, async (c) => {
  try {
    const dealId = c.req.param('id')
    const emailType = c.req.param('type')

    const emailRow = await c.env.DB.prepare(
      `SELECT gmail_draft_id, rep_email FROM deal_emails WHERE deal_id = ? AND email_type = ?`
    ).bind(dealId, emailType).first()

    if (!emailRow?.gmail_draft_id) {
      return c.json({ exists: false, deleted: false })
    }

    const repUser = await c.env.DB.prepare(
      `SELECT id FROM users WHERE email = ?`
    ).bind(emailRow.rep_email).first()

    let accessToken
    let repGmailConnected = true

    if (repUser?.id) {
      try {
        accessToken = await getGmailAccessToken(c.env, repUser.id)
      } catch (e) {
        repGmailConnected = false
      }
    } else {
      repGmailConnected = false
    }

    if (!repGmailConnected || !accessToken) {
      return c.json({
        exists: false,
        deleted: false,
        repGmailNotConnected: true,
        repEmail: emailRow.rep_email
      })
    }

    const repEmail = emailRow.rep_email
    const draftRes = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/${repEmail}/drafts/${emailRow.gmail_draft_id}?format=minimal`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    )

    if (draftRes.ok) return c.json({ exists: true, deleted: false })
    if (draftRes.status === 404) return c.json({ exists: false, deleted: true })
    return c.json({ exists: false, deleted: false })
  } catch (err) {
    return c.json({ exists: false, deleted: false })
  }
})

app.delete('/api/deals/:id/emails/:emailType/draft', requireAuth, async (c) => {
  try {
    const dealId = c.req.param('id')
    const emailType = c.req.param('emailType')
    const loggedInUser = c.get('user')

    const existing = await c.env.DB.prepare(
      'SELECT gmail_draft_id FROM deal_emails WHERE deal_id = ? AND email_type = ?'
    ).bind(dealId, emailType).first()

    if (existing?.gmail_draft_id) {
      try {
        const accessToken = await getGmailAccessToken(c.env, loggedInUser.id)
        const delRes = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/drafts/${existing.gmail_draft_id}`,
          { method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` } }
        )
        console.log('Deleted Gmail draft:', existing.gmail_draft_id, 'status:', delRes.status)
      } catch (e) {
        console.log('Failed to delete Gmail draft (continuing):', e.message)
      }
    }

    await c.env.DB.prepare(
      `UPDATE deal_emails SET gmail_draft_id = NULL, gmail_message_id = NULL, gmail_thread_id = NULL, status = 'draft', updated_at = ? WHERE deal_id = ? AND email_type = ?`
    ).bind(new Date().toISOString(), dealId, emailType).run()
    await logTimelineEvent(c.env, dealId, {
      eventType: 'gmail_draft_recreated',
      description: `Gmail draft reset for ${emailType}`,
      actorName: loggedInUser.name,
      actorEmail: loggedInUser.email,
      metadata: { emailType }
    })
    return c.json({ success: true })
  } catch (err) {
    return c.json({ error: err.message }, 500)
  }
})

async function handleCreateGmailDraft(c) {
  try {
    const dealId = c.req.param('id');
    const emailType = c.req.param('emailType');
    const loggedInUser = c.get('user');

    const EMAIL_SUBJECTS = {
      day1:  (brandName) => `Re: Our demo — next steps for ${brandName}`,
      day3:  (brandName) => `ROI summary for ${brandName}`,
      day4:  (brandName) => `Addressing your questions — ${brandName}`,
      nudge: (brandName) => `Following up — ${brandName}`,
    };

    const emailRow = await c.env.DB.prepare(
      'SELECT * FROM deal_emails WHERE deal_id = ? AND email_type = ?'
    ).bind(dealId, emailType).first();

    if (!emailRow) return c.json({ error: 'Email not found' }, 404);
    if (emailRow.status === 'sent') return c.json({ error: 'Email already sent' }, 400);

    const formData = await c.env.DB.prepare(
      'SELECT prospect_email, brand_name FROM deal_form_data WHERE deal_id = ?'
    ).bind(dealId).first();

    const prospectEmail = formData?.prospect_email;
    if (!prospectEmail) {
      return c.json({ error: 'No prospect email found. Please fill in the demo form with the prospect email first.' }, 400);
    }

    const brandName = formData?.brand_name || 'your brand';

    const userRow = await c.env.DB.prepare(
      'SELECT name FROM users WHERE email = ? AND is_active = 1'
    ).bind(loggedInUser.email).first();
    const fromName = userRow?.name || loggedInUser.email;

    // Build subject: use stored subject or fall back to helper
    let subject = emailRow.subject || (EMAIL_SUBJECTS[emailType] ? EMAIL_SUBJECTS[emailType](brandName) : `Follow-up — ${brandName}`);

    // Threading removed — Gmail UI bug prevents threaded API drafts
    // from showing as compose window inside thread view.
    // Subject already has "Re:" prefix so it reads as a reply to prospect.
    let inReplyTo = null;
    let references = null;
    let day1ThreadId = null;
    if (emailType !== 'day1') {
      inReplyTo = null;
      references = null;
      day1ThreadId = null;
    }

    console.log('create-draft threading:', emailType, '| inReplyTo:', inReplyTo, '| references:', references);
    console.log('create-draft: day1ThreadId =', day1ThreadId, '| from D1 directly');

    let htmlBody = emailRow.body.replace(/\n/g, '<br>');
    console.log('htmlBody preview:', htmlBody?.slice(0, 100))

    let accessToken;
    try {
      accessToken = await getGmailAccessToken(c.env, loggedInUser.id);
    } catch (e) {
      return c.json({ error: 'Gmail not connected. Please connect your Gmail account in Account settings first.', code: 'GMAIL_NOT_CONNECTED' }, 400);
    }

    if (emailRow.gmail_draft_id) {
      try {
        const delRes = await fetch(
          `https://gmail.googleapis.com/gmail/v1/users/me/drafts/${emailRow.gmail_draft_id}`,
          { method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` } }
        )
        console.log('Pre-create: deleted existing draft', emailRow.gmail_draft_id, 'status:', delRes.status)
      } catch (e) {
        console.log('Pre-create: failed to delete existing draft (continuing):', e.message)
      }
    }

    console.log('Calling createGmailDraft for:', loggedInUser.email, 'to:', prospectEmail)
    const result = await createGmailDraft(accessToken, {
      fromEmail: loggedInUser.email,
      fromName,
      toEmail: prospectEmail,
      subject,
      htmlBody,
      inReplyTo,
      references,
      threadId: day1ThreadId,
    });

    console.log('createGmailDraft result:', JSON.stringify(result))
    console.log('create-draft result: draftId =', result.draftId, '| messageId =', result.messageId, '| gmailMessageId =', result.gmailMessageId);

    let draftThreadId = null;
    try {
      const threadFetchRes = await fetch(
        `https://gmail.googleapis.com/gmail/v1/users/me/messages/${result.gmailMessageId}?format=minimal`,
        { headers: { 'Authorization': `Bearer ${accessToken}` } }
      );
      if (threadFetchRes.ok) {
        const threadFetchData = await threadFetchRes.json();
        draftThreadId = threadFetchData.threadId || null;
      }
    } catch {}

    const now = new Date().toISOString();
    await c.env.DB.prepare(
      `UPDATE deal_emails SET gmail_draft_id = ?, gmail_message_id = ?, thread_message_id = ?, gmail_thread_id = ?, draft_created_at = datetime('now'), updated_at = ? WHERE deal_id = ? AND email_type = ?`
    ).bind(result.draftId, result.gmailMessageId, result.messageId, draftThreadId, now, dealId, emailType).run();

    await logTimelineEvent(c.env, dealId, {
      eventType: 'gmail_draft_created',
      description: `Gmail draft created for ${emailType}`,
      actorName: loggedInUser.name,
      actorEmail: loggedInUser.email,
      metadata: { emailType }
    })

    return c.json({ success: true, draftId: result.draftId, messageId: result.messageId, gmailMessageId: result.gmailMessageId });
  } catch (err) {
    return c.json({ error: 'Failed to send email', details: err.message }, 500);
  }
}

app.post('/api/deals/:id/emails/:emailType/create-draft', requireAuth, handleCreateGmailDraft);
app.post('/api/deals/:id/emails/:emailType/gmail-draft',  requireAuth, handleCreateGmailDraft);

app.get('/api/zoho/deal/:id', requireAuth, async (c) => {
  try {
    const dealId = c.req.param('id');
    const dealRes = await getDeal(c.env, dealId);
    if (!dealRes?.data?.[0]) return c.json({ error: 'Deal not found' }, 404);
    const d = dealRes.data[0];

    // Contact_Name is always {id, name} object in Zoho
    const contactObj = d.Contact_Name;
    const contactId = contactObj?.id;
    const contactNameFromDeal = contactObj?.name || '';

    let prospectName = contactNameFromDeal;
    let prospectEmail = '';

    // Fetch email directly from contact record using the id
    if (contactId) {
      try {
        const contactRes = await zohoAPI(c.env, 'GET', `/Contacts/${contactId}?fields=Full_Name,Email`);
        const contact = contactRes?.data?.[0];
        if (contact) {
          prospectName = contact.Full_Name || contactNameFromDeal;
          prospectEmail = contact.Email || '';
        }
      } catch (e) {
        console.error('Contact fetch failed:', e.message);
      }
    }

const orderVolume = d.How_many_orders_do_you_ship_in_a_month || '';
const validVolumes = ['3,001 - 10,000 orders/month', 'More than 10,000 orders/month'];
const volumeTooLow = orderVolume && !validVolumes.includes(orderVolume);

return c.json({
  id: d.id,
  prospectName,
  prospectEmail,
  brandName: d.Deal_Name?.split(' — ')[0] || d.Deal_Name || '',
  orderVolume,
  stage: d.Stage || '',
  repName: d.Owner?.name || '',
  repEmail: d.Owner?.email || '',
  saLogged: d.SA_Logged || false,
  volumeTooLow,
});
  } catch (err) {
    return c.json({ error: 'Failed to fetch deal', details: err.message }, 500);
  }
});

app.get('/api/deals/:id/form-data', requireAuth, async (c) => {
  try {
    const dealId = c.req.param('id');
    const result = await c.env.DB.prepare(
      'SELECT * FROM deal_form_data WHERE deal_id = ?'
    ).bind(dealId).first();
    if (!result) return c.json({ formData: null });
    // Parse JSON fields
    result.shipping_pains = JSON.parse(result.shipping_pains || '[]');
    result.warehousing_pains = JSON.parse(result.warehousing_pains || '[]');
    result.features_shown = JSON.parse(result.features_shown || '[]');
    return c.json({ formData: result });
  } catch (err) {
    return c.json({ error: 'Failed to fetch form data', details: err.message }, 500);
  }
});

app.get('/api/deals/:id/analysis', requireAuth, async (c) => {
  try {
    const dealId = c.req.param('id');
    const user = c.get('user');
    let effectiveUser = user;
    if (user.email === 'satyanarayan.sahoo@eshopbox.com') {
      const viewAsEmail = c.req.header('x-view-as-email');
      if (viewAsEmail) {
        const viewAsUser = await c.env.DB.prepare(
          'SELECT id, email, name, role FROM users WHERE email = ?'
        ).bind(viewAsEmail).first();
        if (viewAsUser) effectiveUser = viewAsUser;
      }
    }
    const result = await c.env.DB.prepare(
      'SELECT * FROM deal_form_data WHERE deal_id = ?'
    ).bind(dealId).first();

    if (!result) {
      // No demo logged — generate analysis from Zoho data on-the-fly
      const dealRes = await getDeal(c.env, dealId);
      if (!dealRes?.data?.[0]) return c.json({ error: 'Deal not found' }, 404);
      const d = dealRes.data[0];
      const grade = d.Deal_Grade || 'D';
      const score = d.SA_Forecast_Probability || 0;
      const zohoData = {
        brandName: d.Deal_Name?.split(' — ')[0] || d.Deal_Name || '',
        stage: d.Stage || '',
        orderVolume: d.How_many_orders_do_you_ship_in_a_month || '',
        solutionInterest: d.SA_Solution_Interest || '',
        painPoints: d.SA_Pain_Points || '',
        grade,
        score,
      };
      const aiAnalysis = await generateDealAnalysis(c.env, zohoData, grade, score);
      return c.json({ formData: null, aiAnalysis, scoreBreakdown: [], grade, score });
    }

    result.shipping_pains = JSON.parse(result.shipping_pains || '[]');
    result.warehousing_pains = JSON.parse(result.warehousing_pains || '[]');
    result.features_shown = JSON.parse(result.features_shown || '[]');

    let aiAnalysis = result.ai_analysis ? JSON.parse(result.ai_analysis) : null;
    if (!aiAnalysis) {
      aiAnalysis = await generateDealAnalysis(c.env, result, result.grade, result.score);
      if (aiAnalysis) {
        await c.env.DB.prepare(
          'UPDATE deal_form_data SET ai_analysis = ?, updated_at = ? WHERE deal_id = ?'
        ).bind(JSON.stringify(aiAnalysis), new Date().toISOString(), dealId).run();
      }
    }
    delete result.ai_analysis;

    const scoreBreakdown = buildScoreBreakdown(result);

    return c.json({ formData: result, aiAnalysis, scoreBreakdown, grade: result.grade, score: result.score });
  } catch (err) {
    return c.json({ error: 'Failed to fetch analysis', details: err.message }, 500);
  }
});

app.post('/api/admin/regenerate-drafts', requireAuth, async (c) => {
  try {
    const user = c.get('user');
    if (user?.role !== 'admin') {
      return c.json({ error: 'Admins only' }, 403);
    }

    const draftRows = await c.env.DB.prepare(`
      SELECT deal_id, email_type, updated_at FROM deal_emails
      WHERE email_type IN ('day1', 'day3', 'day4') AND status = 'draft'
    `).all();

    if (!draftRows.results?.length) {
      return c.json({ success: true, dealsProcessed: 0, emailsUpdated: 0, errors: [] });
    }

    const limitParam = parseInt(c.req.query('limit') || '1', 10);
    const limit = isNaN(limitParam) || limitParam < 1 ? 1 : limitParam;

    const allDealIds = [...new Set(draftRows.results.map(r => r.deal_id))];
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();

    // Skip deals where all 3 draft emails were updated within the last 10 minutes
    const dealIds = [];
    for (const dealId of allDealIds) {
      const recentRows = draftRows.results.filter(
        r => r.deal_id === dealId && r.updated_at && r.updated_at > tenMinutesAgo
      );
      if (recentRows.length >= 3) continue;
      dealIds.push(dealId);
      if (dealIds.length >= limit) break;
    }

    let dealsProcessed = 0;
    let emailsUpdated = 0;
    const errors = [];

    for (let i = 0; i < dealIds.length; i++) {
      const dealId = dealIds[i];

      if (i > 0) await new Promise(resolve => setTimeout(resolve, 13000));

      try {
        const row = await c.env.DB.prepare(
          'SELECT * FROM deal_form_data WHERE deal_id = ?'
        ).bind(dealId).first();

        if (!row) {
          errors.push({ dealId, error: 'No form data found' });
          continue;
        }

        const mappedFormData = {
          prospectName: row.prospect_name || '',
          contactName: row.prospect_name || '',
          brandName: row.brand_name || '',
          solutionInterest: row.solution_interest || '',
          shippingPains: JSON.parse(row.shipping_pains || '[]'),
          warehousingPains: JSON.parse(row.warehousing_pains || '[]'),
          featuresShown: JSON.parse(row.features_shown || '[]'),
          painClarity: row.pain_clarity || '',
          dmPresent: row.dm_present || '',
          repNotes: row.rep_notes || '',
          followupMeetingDate: row.followup_meeting_date || '',
          competitorMentioned: row.competitor_mentioned || '',
          shippingPainOther: row.shipping_pain_other || '',
          warehousingPainOther: row.warehousing_pain_other || '',
          pricingRaisedInDemo: row.pricing_raised || '',
          shippingSetup: row.shipping_setup || '',
          warehousingSetup: row.warehousing_setup || '',
          orderVolume: row.order_volume || '',
          urgencyDriver: row.urgency_driver || '',
          engagementLevel: row.engagement_level || '',
          budgetSignal: row.budget_signal || '',
          purchaseTimeline: row.purchase_timeline || '',
          championStrength: row.champion_strength || '',
          repName: row.rep_name || '',
          transcript: row.transcript || '',
          objections: row.objections || '',
        };

        const drafts = await generateEmailDrafts(c.env, mappedFormData, row.grade, row.score);
        const now = new Date().toISOString();

        const [r1, r3, r4] = await Promise.all([
          c.env.DB.prepare(
            `UPDATE deal_emails SET subject = ?, body = ?, updated_at = ? WHERE deal_id = ? AND email_type = 'day1' AND status = 'draft'`
          ).bind(drafts.recap.subject, drafts.recap.body, now, dealId).run(),
          c.env.DB.prepare(
            `UPDATE deal_emails SET subject = ?, body = ?, updated_at = ? WHERE deal_id = ? AND email_type = 'day3' AND status = 'draft'`
          ).bind(`Re: ${drafts.recap.subject}`, drafts.roi.body, now, dealId).run(),
          c.env.DB.prepare(
            `UPDATE deal_emails SET subject = ?, body = ?, updated_at = ? WHERE deal_id = ? AND email_type = 'day4' AND status = 'draft'`
          ).bind(`Re: ${drafts.recap.subject}`, drafts.objection.body, now, dealId).run(),
        ]);

        emailsUpdated += (r1.meta?.changes || 0) + (r3.meta?.changes || 0) + (r4.meta?.changes || 0);
        dealsProcessed++;
      } catch (err) {
        errors.push({ dealId, error: err.message });
      }
    }

    return c.json({ success: true, dealsProcessed, emailsUpdated, errors });
  } catch (err) {
    return c.json({ error: 'Regeneration failed', details: err.message }, 500);
  }
});

app.post('/api/webhooks/zoho-email-sent', async (c) => {
  try {
    const key = c.req.query('key');
    if (key !== 'eshopbox-webhook-2026') return c.json({ error: 'Unauthorized' }, 401);

    const body = await c.req.json().catch(() => ({}));
    console.log('Zoho email webhook:', JSON.stringify(body));

    const { deal_id } = body;
    if (!deal_id) return c.json({ success: true });

    const draftRows = await c.env.DB.prepare(
      `SELECT id, email_type, zoho_message_id FROM deal_emails WHERE deal_id = ? AND status = 'draft_created'`
    ).bind(deal_id).all();

    console.log('Draft created emails in D1:', JSON.stringify(draftRows.results));
    if (!draftRows.results?.length) return c.json({ success: true, matched: 0 });

    const token = await getAccessToken(c.env);
    const sentRes = await getDealSentEmails(c.env, deal_id, token);
    console.log('Zoho sent emails response:', JSON.stringify(sentRes));
    const sentEmails = sentRes?.Emails || sentRes?.data || [];

    const now = new Date().toISOString();
    let matched = 0;

    for (const sentEmail of sentEmails) {
      if (!sentEmail.sent) continue;
      const messageId = sentEmail.message_id || sentEmail.id;
      if (!messageId) continue;

      const contentRes = await getEmailContent(c.env, deal_id, messageId, token);
      console.log('Email content for', messageId, ':', JSON.stringify(contentRes).substring(0, 500));
      console.log('Actual HTML content:', (contentRes?.Emails?.[0]?.content || 'NO CONTENT FIELD').substring(0, 500));
      const content = contentRes?.Emails?.[0]?.content || '';
      if (!content) continue;

      const match = content.match(/data-sa="([^"]+)"/);
      console.log('Tracking tag search result:', match);
      if (!match) continue;

      const tagValue = match[1];
      const emailType = tagValue.replace(`_${deal_id}`, '');
      const draftRow = draftRows.results.find(r => r.email_type === emailType);
      if (!draftRow) continue;

      await c.env.DB.prepare(
        `UPDATE deal_emails SET status = 'sent', sent_at = ?, zoho_message_id = ?, updated_at = ? WHERE id = ?`
      ).bind(sentEmail.time || now, messageId, now, draftRow.id).run();
      matched++;
    }

    console.log(`Webhook matched ${matched} sent email(s) for deal ${deal_id}`);
    return c.json({ success: true, matched });
  } catch (err) {
    console.error('Webhook error:', err.message);
    return c.json({ success: true });
  }
});

app.post('/api/test/reminders', requireAuth, async (c) => {
  await runRepReminders(c.env);
  return c.json({ success: true });
});

app.get('/api/cron/reminders-pending', async (c) => {
  if (c.req.query('secret') !== 'eshopbox-cron-2026') return c.json({ error: 'Unauthorized' }, 401);

  const rows = await c.env.DB.prepare(`
    SELECT de.deal_id, de.email_type, de.created_at,
           dfd.brand_name, dfd.rep_name, dfd.rep_email
    FROM deal_emails de
    LEFT JOIN deal_form_data dfd ON de.deal_id = dfd.deal_id
    WHERE de.status IN ('draft', 'draft_created')
    AND de.reminder_sent = 0
    AND dfd.rep_email IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM users u
      WHERE u.email = dfd.rep_email
      AND u.role NOT IN ('admin')
      AND u.is_active = 1
    )
    AND (
      (de.email_type = 'day1' AND datetime(de.created_at) <= datetime('now', '-24 hours'))
      OR (de.email_type = 'day3' AND datetime(de.created_at) <= datetime('now', '-3 days'))
      OR (de.email_type = 'day4' AND datetime(de.created_at) <= datetime('now', '-4 days'))
    )
  `).all();

  return c.json({ reminders: rows.results || [] });
});

app.post('/api/cron/mark-reminder-sent', async (c) => {
  if (c.req.query('secret') !== 'eshopbox-cron-2026') return c.json({ error: 'Unauthorized' }, 401);

  const { deal_id, email_type } = await c.req.json();
  await c.env.DB.prepare(`
    UPDATE deal_emails SET reminder_sent = 1, updated_at = datetime('now')
    WHERE deal_id = ? AND email_type = ?
  `).bind(deal_id, email_type).run();

  return c.json({ success: true });
});

app.get('/api/cron/digest-pending', async (c) => {
  if (c.req.query('secret') !== 'eshopbox-cron-2026') return c.json({ error: 'Unauthorized' }, 401);

  const rows = await c.env.DB.prepare(`
    SELECT de.deal_id, de.email_type, de.created_at, de.status,
           dfd.brand_name, dfd.rep_name, dfd.rep_email
    FROM deal_emails de
    LEFT JOIN deal_form_data dfd ON de.deal_id = dfd.deal_id
    WHERE de.status IN ('draft', 'draft_created')
    AND dfd.rep_email IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM users u
      WHERE u.email = dfd.rep_email
      AND u.role NOT IN ('admin')
      AND u.is_active = 1
    )
    ORDER BY dfd.rep_email, de.created_at ASC
  `).all();

  return c.json({ digest: rows.results || [] });
});

async function runScheduledEmails(env) {
  const today = new Date().toISOString().split('T')[0];
  console.log(`Running scheduled emails for ${today}`);

  // Get all emails scheduled for today or earlier that are still pending
  const due = await env.DB.prepare(`
    SELECT de.*, dfd.prospect_email as prospect_email_addr
    FROM deal_emails de
    LEFT JOIN deal_form_data dfd ON de.deal_id = dfd.deal_id
    WHERE de.status = 'scheduled'
    AND de.scheduled_for <= ?
  `).bind(today).all();

  if (!due.results?.length) {
    console.log('No scheduled emails due today');
    return;
  }

  console.log(`Found ${due.results.length} emails to send`);

  for (const email of due.results) {
    try {
      // Check deal stage — skip if Won or Lost
      const dealRes = await getDeal(env, email.deal_id);
      const stage = dealRes?.data?.[0]?.Stage;

      const skipStages = ['Won/Payment Received', 'Deal lost'];
      if (skipStages.includes(stage)) {
        console.log(`Skipping ${email.deal_id} ${email.email_type} — deal is ${stage}`);
        await env.DB.prepare(
          `UPDATE deal_emails SET status = 'skipped', updated_at = ? WHERE id = ?`
        ).bind(new Date().toISOString(), email.id).run();
        continue;
      }

      // Check if rep is still active
      const repEmail = dealRes?.data?.[0]?.Owner?.email;
      const rep = await env.DB.prepare(
        `SELECT * FROM users WHERE email = ? AND is_active = 1`
      ).bind(repEmail || '').first();

      if (!rep) {
        // Rep deactivated — reassign to admin
        const manager = await env.DB.prepare(
          `SELECT email FROM users WHERE role = 'admin' AND is_active = 1 LIMIT 1`
        ).first();
        if (!manager) {
          console.log(`No active manager found for deal ${email.deal_id} — skipping`);
          continue;
        }
        console.log(`Rep ${repEmail} inactive — reassigning to ${manager.email}`);
      }

      // Send via Zoho — uses deal owner as sender automatically
      const result = await sendDealEmail(env, email.deal_id, email.subject, email.body);
      const now = new Date().toISOString();

      if (result?.data?.[0]?.code === 'SUCCESS' || result?.status === 'success') {
        await env.DB.prepare(
          `UPDATE deal_emails SET status = 'sent', sent_at = ?, updated_at = ? WHERE id = ?`
        ).bind(now, now, email.id).run();
        console.log(`✓ Sent ${email.email_type} for deal ${email.deal_id}`);
      } else {
        await env.DB.prepare(
          `UPDATE deal_emails SET status = 'failed', updated_at = ? WHERE id = ?`
        ).bind(now, email.id).run();
        console.log(`✗ Failed ${email.email_type} for deal ${email.deal_id}:`, JSON.stringify(result));
      }

    } catch (err) {
      console.error(`Error sending ${email.email_type} for deal ${email.deal_id}:`, err.message);
      await env.DB.prepare(
        `UPDATE deal_emails SET status = 'failed', updated_at = ? WHERE id = ?`
      ).bind(new Date().toISOString(), email.id).run();
    }
  }
}

async function runRepReminders(env) {
  console.log('Running rep reminders...');
  try {

  const overdue = await env.DB.prepare(`
    SELECT de.id, de.deal_id, de.email_type, de.scheduled_for, de.reminder_sent,
           dfd.brand_name, dfd.prospect_email, dfd.rep_email, dfd.rep_name
    FROM deal_emails de
    LEFT JOIN deal_form_data dfd ON de.deal_id = dfd.deal_id
    WHERE de.status IN ('draft', 'draft_created')
    AND de.reminder_sent = 0
    AND de.scheduled_for IS NOT NULL
    AND de.scheduled_for <= date('now')
  `).all();

  if (!overdue.results?.length) {
    console.log('No overdue emails needing rep reminders');
    return;
  }

  console.log(`Found ${overdue.results.length} overdue email(s) needing reminders`);

  const orgToken = await getAccessToken(env);

  const accountsRes = await fetch('https://mail.zoho.com/api/accounts', {
    headers: { Authorization: `Zoho-oauthtoken ${orgToken}` },
  });
  const accountsData = await accountsRes.json();
  console.log('Accounts raw response:', JSON.stringify(accountsRes || 'null').substring(0, 500));
  const accounts = accountsData?.data || [];
  const mailAccount = accounts.find(a =>
    a.mailboxAddress === 'care@eshopbox.com' ||
    (a.emailAddress || []).some(e => e.mailId === 'care@eshopbox.com')
  );
  console.log('Zoho Mail account lookup:', mailAccount ? `found accountId ${mailAccount.accountId}` : 'not found');

  if (!mailAccount) {
    console.log('care@eshopbox.com mail account not found — aborting reminders');
    return;
  }

  const { accountId } = mailAccount;
  let sent = 0;

  for (const row of overdue.results) {
    try {
      const { id, deal_id, email_type, brand_name, rep_email, rep_name } = row;

      const subjects = {
        day1: `Reminder: Send recap email to ${brand_name}`,
        day3: `Reminder: Send ROI value email to ${brand_name}`,
        day4: `Reminder: Send objection handling email to ${brand_name}`,
      };
      const bodies = {
        day1: `Hi ${rep_name},\n\nYou logged a demo with ${brand_name} and the Day 1 recap email hasn't been sent yet. Please send it today.\n\nSales Assist`,
        day3: `Hi ${rep_name},\n\nYour Day 3 ROI value email to ${brand_name} is overdue. Please send it today.\n\nSales Assist`,
        day4: `Hi ${rep_name},\n\nYour Day 4 objection handling email to ${brand_name} is overdue. Please send it today.\n\nSales Assist`,
      };

      const subject = subjects[email_type] || `Reminder: Overdue email for ${brand_name}`;
      const content = bodies[email_type] || `Hi ${rep_name},\n\nYou have an overdue email for ${brand_name}. Please send it today.\n\nSales Assist`;

      const res = await fetch(`https://mail.zoho.com/api/accounts/${accountId}/messages`, {
        method: 'POST',
        headers: {
          Authorization: `Zoho-oauthtoken ${orgToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fromAddress: 'care@eshopbox.com',
          toAddress: rep_email,
          subject,
          content,
          mailFormat: 'plaintext',
        }),
      });

      const result = await res.json();
      const now = new Date().toISOString();

      if (result?.status?.code === 200 || result?.data?.messageId) {
        await env.DB.prepare(
          'UPDATE deal_emails SET reminder_sent = 1, updated_at = ? WHERE id = ?'
        ).bind(now, id).run();
        console.log(`Reminder sent to ${rep_email} for deal ${deal_id} (${email_type})`);
        sent++;
      } else {
        console.log(`Reminder failed for deal ${deal_id} (${email_type}):`, JSON.stringify(result));
      }
    } catch (err) {
      console.error(`Error sending reminder for deal ${row.deal_id}:`, err.message);
    }
  }

  console.log(`Rep reminders complete — ${sent} sent`);

  } catch (err) {
    console.error('runRepReminders error:', err.message);
  }
}

// ─── SETTINGS RULES ROUTES ────────────────────────────────────────────────────

const DEFAULT_RULES = [
  { id: 'r1',  name: 'Recap email not sent',                severity: 'critical', active: true, threshold: null, desc: 'Day 1 recap email is overdue.' },
  { id: 'r2',  name: 'Pricing proposal not sent',           severity: 'critical', active: true, threshold: null, desc: 'Day 2 pricing proposal task is overdue.' },
  { id: 'r3',  name: 'ROI email overdue',                   severity: 'warning',  active: true, threshold: 2,    desc: 'Day 3 ROI value email is 2+ days overdue.' },
  { id: 'r4',  name: 'No follow-up meeting booked',         severity: 'critical', active: true, threshold: null, desc: 'Demo logged but no follow-up meeting on calendar.' },
  { id: 'r5',  name: 'Follow-up passed, stage not updated', severity: 'critical', active: true, threshold: null, desc: 'Meeting date passed; stage still says Proposal sent.' },
  { id: 'r6',  name: 'Stuck in stage 7+ days',              severity: 'warning',  active: true, threshold: 7,    desc: 'No stage change in 7+ days.' },
  { id: 'r7',  name: 'Deal Approved, no activity 5+ days',  severity: 'warning',  active: true, threshold: 5,    desc: 'In Deal Approved but no activity in 5+ days.' },
  { id: 'r8',  name: 'Grade D, no activity 5+ days',        severity: 'info',     active: true, threshold: 5,    desc: 'Grade D deal still active with no recent activity.' },
  { id: 'r9',  name: 'Decision nudge sent, no response',    severity: 'warning',  active: true, threshold: 3,    desc: 'Meeting+7 nudge sent but prospect silent 3+ days.' },
  { id: 'r10', name: 'Grade A, no in-person meeting',       severity: 'warning',  active: true, threshold: null, desc: 'Grade A deal but no F2F yet — high-impact missed.' },
  { id: 'r11', name: 'Lost deal, no reason logged',         severity: 'warning',  active: true, threshold: null, desc: 'Deal marked Lost but no loss reason entered.' },
  { id: 'r12', name: 'Upcoming demo overdue',               severity: 'warning',  active: true, threshold: 10,   desc: 'Sat in Upcoming Demo 10+ days without logging a demo.' },
];

app.get('/api/settings/rules', requireAuth, async (c) => {
  try {
    const user = c.get('user');
    if (user?.role !== 'admin') return c.json({ error: 'Admins only' }, 403);
    let rows = [];
    try {
      const result = await c.env.DB.prepare('SELECT id, active, threshold FROM rules_config').all();
      rows = result.results || [];
    } catch { /* table may not exist yet */ }
    if (rows.length === 0) return c.json({ rules: DEFAULT_RULES });
    const overrides = {};
    rows.forEach(r => { overrides[r.id] = { active: r.active === 1, threshold: r.threshold ?? null }; });
    const rules = DEFAULT_RULES.map(r => ({
      ...r,
      ...(r.id in overrides ? { active: overrides[r.id].active, threshold: overrides[r.id].threshold } : {}),
    }));
    return c.json({ rules });
  } catch (err) {
    return c.json({ error: 'Failed to fetch rules', details: err.message }, 500);
  }
});

app.put('/api/settings/rules/:id', requireAuth, async (c) => {
  try {
    const user = c.get('user');
    if (user?.role !== 'admin') return c.json({ error: 'Admins only' }, 403);
    const id = c.req.param('id');
    const body = await c.req.json();
    const now = new Date().toISOString();
    await c.env.DB.prepare(
      'CREATE TABLE IF NOT EXISTS rules_config (id TEXT PRIMARY KEY, active INTEGER NOT NULL DEFAULT 1, threshold INTEGER, updated_at TEXT NOT NULL)'
    ).run();
    try {
      await c.env.DB.prepare('ALTER TABLE rules_config ADD COLUMN threshold INTEGER').run();
    } catch { /* column already exists */ }
    const existing = await c.env.DB.prepare('SELECT active, threshold FROM rules_config WHERE id = ?').bind(id).first();
    const defaultRule = DEFAULT_RULES.find(r => r.id === id);
    const newActive = 'active' in body ? (body.active ? 1 : 0) : (existing?.active ?? (defaultRule?.active ? 1 : 0));
    const newThreshold = 'threshold' in body ? body.threshold : (existing?.threshold ?? defaultRule?.threshold ?? null);
    await c.env.DB.prepare(
      'INSERT INTO rules_config (id, active, threshold, updated_at) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET active = excluded.active, threshold = excluded.threshold, updated_at = excluded.updated_at'
    ).bind(id, newActive, newThreshold, now).run();
    return c.json({ success: true, rule: { id, active: newActive === 1, threshold: newThreshold } });
  } catch (err) {
    return c.json({ error: 'Failed to update rule', details: err.message }, 500);
  }
});

// ─── SETTINGS SEQUENCE ROUTES ────────────────────────────────────────────────

const DEFAULT_SEQUENCE = [
  { id: 'seq1', name: 'Day 1 — Recap email',               desc: 'Rep reviews and sends the AI-drafted recap email.', days: 1,    mode: 'manual', editable: false },
  { id: 'seq2', name: 'Day 2 — Pricing proposal task',     desc: 'Zoho task reminds rep to send the pricing proposal.', days: 2,  mode: 'manual', editable: false },
  { id: 'seq3', name: 'Day 3 — ROI value email',           desc: 'Rep sends from Claude-generated draft.', days: 3,              mode: 'manual', editable: false },
  { id: 'seq4', name: 'Day 4 — Objection handling email',  desc: 'Auto-sent via Zoho Cadence.', days: 4,                         mode: 'auto',   editable: true  },
  { id: 'seq5', name: 'Follow-up meeting',                 desc: 'Rep schedules a proposal walkthrough meeting.', days: null,     mode: 'manual', editable: false },
  { id: 'seq6', name: 'Meeting +3 — Post-meeting check-in',desc: 'Auto-sent 3 days after the follow-up meeting.', days: 3,       mode: 'auto',   editable: true  },
  { id: 'seq7', name: 'Meeting +7 — Decision nudge',       desc: 'Auto-sent 7 days after the follow-up meeting.', days: 7,       mode: 'auto',   editable: true  },
];

app.get('/api/settings/sequence', requireAuth, async (c) => {
  try {
    const user = c.get('user');
    if (user?.role !== 'admin') return c.json({ error: 'Admins only' }, 403);
    let rows = [];
    try {
      const result = await c.env.DB.prepare('SELECT id, days FROM sequence_config').all();
      rows = result.results || [];
    } catch { /* table may not exist yet */ }
    if (rows.length === 0) return c.json({ sequence: DEFAULT_SEQUENCE });
    const overrides = {};
    rows.forEach(r => { overrides[r.id] = r.days; });
    const sequence = DEFAULT_SEQUENCE.map(s => ({ ...s, days: s.id in overrides ? overrides[s.id] : s.days }));
    return c.json({ sequence });
  } catch (err) {
    return c.json({ error: 'Failed to fetch sequence', details: err.message }, 500);
  }
});

app.put('/api/settings/sequence/:id', requireAuth, async (c) => {
  try {
    const user = c.get('user');
    if (user?.role !== 'admin') return c.json({ error: 'Admins only' }, 403);
    const id = c.req.param('id');
    const { days } = await c.req.json();
    const now = new Date().toISOString();
    await c.env.DB.prepare(
      'CREATE TABLE IF NOT EXISTS sequence_config (id TEXT PRIMARY KEY, days INTEGER, updated_at TEXT NOT NULL)'
    ).run();
    await c.env.DB.prepare(
      'INSERT INTO sequence_config (id, days, updated_at) VALUES (?, ?, ?) ON CONFLICT(id) DO UPDATE SET days = excluded.days, updated_at = excluded.updated_at'
    ).bind(id, days, now).run();
    return c.json({ success: true, step: { id, days } });
  } catch (err) {
    return c.json({ error: 'Failed to update sequence', details: err.message }, 500);
  }
});

app.post('/api/admin/backfill-tasks', requireAuth, async (c) => {
  try {
    const user = c.get('user');
    if (user.role !== 'admin') return c.json({ error: 'Admin only' }, 403);

    const EXPECTED_TASKS = [
      { subject: 'Day 1 — Send recap email',                daysFromDemo: 1,  anchor: 'demo' },
      { subject: 'Day 2 — Send pricing proposal',           daysFromDemo: 2,  anchor: 'demo' },
      { subject: 'Day 3 — Send ROI value email',            daysFromDemo: 3,  anchor: 'demo' },
      { subject: 'Day 4 — Objection handling email [AUTO]', daysFromDemo: 4,  anchor: 'demo' },
      { subject: 'Meeting — Follow-up proposal walkthrough',daysFromDemo: 0,  anchor: 'meeting' },
      { subject: 'Meeting+3 — Post-meeting check-in [AUTO]',daysFromDemo: 3,  anchor: 'meeting_plus' },
      { subject: 'Meeting+7 — Decision nudge [AUTO]',       daysFromDemo: 7,  anchor: 'meeting_plus' },
    ];

    const TASK_META = {
      'Day 1 — Send recap email':                 { priority: 'High',   desc: 'Send the AI-generated recap email to the prospect. Draft is ready in Sales Assist.' },
      'Day 2 — Send pricing proposal':             { priority: 'High',   desc: 'Send the pricing proposal to the prospect via email or WhatsApp.' },
      'Day 3 — Send ROI value email':              { priority: 'High',   desc: 'Send the AI-generated ROI email to the prospect. Draft is ready in Sales Assist.' },
      'Day 4 — Objection handling email [AUTO]':   { priority: 'Normal', desc: 'Auto-sent via Zoho Cadence. Review the draft in Sales Assist before it fires.' },
      'Meeting — Follow-up proposal walkthrough':  { priority: 'High',   desc: 'Schedule and conduct the follow-up meeting with the prospect.' },
      'Meeting+3 — Post-meeting check-in [AUTO]':  { priority: 'High',   desc: 'Send post-meeting check-in email after the follow-up meeting.' },
      'Meeting+7 — Decision nudge [AUTO]':         { priority: 'High',   desc: 'Send the decision nudge email to push for a close.' },
    };

    const addDaysToDate = (date, days) =>
      new Date(date.getTime() + days * 86400000).toISOString().split('T')[0];

    const allDealsRes = await getDeals(c.env);
    const loggedDeals = (allDealsRes.data || []).filter(d => d.SA_Logged === true);

    let tasksCreated = 0;
    let dealsProcessed = 0;

    for (const deal of loggedDeals) {
      dealsProcessed++;
      const demoDateStr = deal.Demo_Date;
      if (!demoDateStr) {
        await new Promise(r => setTimeout(r, 200));
        continue;
      }

      const demoDate = new Date(demoDateStr);
      const meetingDate = deal.SA_Followup_Meeting_Date
        ? new Date(deal.SA_Followup_Meeting_Date)
        : new Date(demoDate.getTime() + 7 * 86400000);

      let existingSubjects = [];
      try {
        const tasksRes = await getDealTasks(c.env, deal.id);
        existingSubjects = (tasksRes?.data || []).map(t => t.Subject || '');
      } catch {
        await new Promise(r => setTimeout(r, 200));
        continue;
      }

      for (const task of EXPECTED_TASKS) {
        if (existingSubjects.includes(task.subject)) continue;

        let dueDate;
        if (task.anchor === 'demo') {
          dueDate = addDaysToDate(demoDate, task.daysFromDemo);
        } else if (task.anchor === 'meeting') {
          dueDate = addDaysToDate(meetingDate, 0);
        } else {
          dueDate = addDaysToDate(meetingDate, task.daysFromDemo);
        }

        const meta = TASK_META[task.subject];
        try {
          await createTask(c.env, deal.id, {
            Subject: task.subject,
            Due_Date: dueDate,
            Status: 'Not Started',
            Priority: meta.priority,
            Description: meta.desc,
          });
          tasksCreated++;
        } catch (e) {
          console.error(`Backfill: failed to create "${task.subject}" for deal ${deal.id}:`, e.message);
        }
      }

      await new Promise(r => setTimeout(r, 200));
    }

    return c.json({ success: true, tasksCreated, dealsProcessed });
  } catch (err) {
    return c.json({ error: 'Backfill failed', details: err.message }, 500);
  }
});

// ─── GMAIL OAUTH HELPER ──────────────────────────────────────────────────────

async function getSenderAccessToken(env) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      refresh_token: env.GMAIL_SENDER_REFRESH_TOKEN,
      grant_type: 'refresh_token',
    }),
  });
  const data = await res.json();
  if (!data.access_token) throw new Error('Failed to get sender access token: ' + JSON.stringify(data));
  return data.access_token;
}

async function getGmailAccessToken(env, userId) {
  const row = await env.DB.prepare(
    'SELECT gmail_access_token, gmail_refresh_token, gmail_token_expiry FROM users WHERE id = ?'
  ).bind(userId).first();

  if (!row?.gmail_refresh_token) throw new Error('Gmail not connected');

  if (!row.gmail_access_token || (row.gmail_token_expiry && row.gmail_token_expiry < Date.now() + 60000)) {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        refresh_token: row.gmail_refresh_token,
        grant_type: 'refresh_token',
      }),
    });
    const data = await res.json();
    if (!data.access_token) throw new Error('Failed to refresh Gmail token');
    const expiry = Date.now() + (data.expires_in || 3600) * 1000;
    await env.DB.prepare(
      'UPDATE users SET gmail_access_token = ?, gmail_token_expiry = ? WHERE id = ?'
    ).bind(data.access_token, expiry, userId).run();
    return data.access_token;
  }

  return row.gmail_access_token;
}

// ─── GMAIL OAUTH ROUTES ───────────────────────────────────────────────────────

app.get('/auth/gmail', requireAuth, async (c) => {
  const user = c.get('user');
  const authHeader = c.req.header('Authorization') || '';
  const jwtToken = authHeader.replace('Bearer ', '');

  const params = new URLSearchParams({
    client_id: c.env.GOOGLE_CLIENT_ID,
    redirect_uri: 'https://eshopbox-sales-assist-v3-backend.satyanarayan-sahoo.workers.dev/auth/gmail/callback',
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.modify https://www.googleapis.com/auth/gmail.settings.basic',
    access_type: 'offline',
    prompt: 'consent',
    state: jwtToken,
  });

  return c.json({ url: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}` });
});

app.get('/auth/gmail/callback', async (c) => {
  const code = c.req.query('code');
  const state = c.req.query('state');

  if (!code || !state) return c.text('Missing code or state', 400);

  let payload;
  try {
    payload = await verify(state, c.env.JWT_SECRET);
  } catch {
    return c.text('Invalid state token', 401);
  }

  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: c.env.GOOGLE_CLIENT_ID,
      client_secret: c.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: 'https://eshopbox-sales-assist-v3-backend.satyanarayan-sahoo.workers.dev/auth/gmail/callback',
      grant_type: 'authorization_code',
    }),
  });

  const tokenData = await tokenRes.json();
  if (!tokenData.access_token) {
    return c.text('Failed to exchange code: ' + JSON.stringify(tokenData), 500);
  }

  const expiry = Date.now() + (tokenData.expires_in || 3600) * 1000;
  await c.env.DB.prepare(
    'UPDATE users SET gmail_access_token = ?, gmail_refresh_token = ?, gmail_token_expiry = ? WHERE id = ?'
  ).bind(tokenData.access_token, tokenData.refresh_token || null, expiry, payload.id).run();

  return c.redirect('https://eshopbox-sales-assist-v3.pages.dev/settings?gmail=connected');
});

app.get('/auth/gmail/status', requireAuth, async (c) => {
  const user = c.get('user')
  const row = await c.env.DB.prepare(
    'SELECT gmail_refresh_token, gmail_signature FROM users WHERE id = ?'
  ).bind(user.id).first()
  return c.json({ connected: !!row?.gmail_refresh_token, signature: row?.gmail_signature || '' })
})

app.post('/auth/gmail/disconnect', requireAuth, async (c) => {
  const user = c.get('user')
  await c.env.DB.prepare(
    'UPDATE users SET gmail_access_token = NULL, gmail_refresh_token = NULL, gmail_token_expiry = NULL WHERE id = ?'
  ).bind(user.id).run()
  return c.json({ success: true })
});

// ─────────────────────────────────────────────────────────────────────────────

// ── LEADS ────────────────────────────────────────────────

const ACTIVE_LEAD_STATUSES = ['Connected', 'Connecting', 'Bad Timing']

const SYSTEM_EMAILS = ['shikhar.gupta@eshopbox.com']

function mapZohoLead(l) {
  return {
    id: l.id,
    fullName: l.Full_Name || `${l.First_Name || ''} ${l.Last_Name || ''}`.trim(),
    firstName: l.First_Name || '',
    lastName: l.Last_Name || '',
    email: l.Email || '',
    phone: l.Phone || '',
    company: l.Company || '',
    leadType: l.Lead_Type || '',
    leadSource: l.Lead_Source || '',
    originalLeadSource: l.Original_Lead_Source || '',
    leadStatus: l.Lead_Status || '',
    ownerName: l.Owner?.name || '',
    ownerEmail: l.Owner?.email || '',
    ownerId: l.Owner?.id || '',
    orderVolume: l.How_many_orders_do_you_ship_in_a_month || l.Monthly_Order_Volume || l.Order_Volume || '',
    utmSource: l.UTM_Source || '',
    utmMedium: l.UTM_Medium || '',
    utmCampaign: l.UTM_Campaign || '',
    converted: l.$converted || false,
    signup: l.Signup || '',
    createdAt: l.Created_Time || '',
    modifiedAt: l.Modified_Time || '',
    lastActivityAt: l.Last_Activity_Time || '',
    disqualifiedReason: l.Disqualified_reason || '',
    description: l.Description || '',
    supportNeeded: l.How_can_Eshopbox_support_your_business || '',
    productType: l.What_type_of_products_do_you_sell || '',
    city: l.City || '',
    shippingSetup: l.Shipping_Setup || '',
    fulfillmentSetup: l.Current_Fulfillment_Setup || '',
    inventoryTimeline: l.Inventory_Move_Timeline || '',
    website: l.Website || '',
  }
}

app.get('/api/leads', requireAuth, async (c) => {
  try {
    const forceRefresh = c.req.query('refresh') === 'true'
    if (forceRefresh) {
      try { await c.env.TOKEN_CACHE.delete('v3_leads_cache') } catch {}
    }
    const user = c.get('user')
    const [dynamicMDEEmails, dynamicAEEmails] = await Promise.all([
      getMDEEmails(c.env.DB),
      getAEEmails(c.env.DB)
    ])
    const allLeads = await getAllLeads(c.env)
    console.log('Leads from cache/Zoho:', allLeads.length)
    let leads = allLeads.map(mapZohoLead)
    if (user.role === 'mde' || user.role === 'ae') {
      leads = leads.filter(l => l.ownerEmail === user.email)
    } else if (user.role === 'lead-midmarket') {
      leads = leads.filter(l => dynamicMDEEmails.includes(l.ownerEmail))
    } else if (user.role === 'lead-enterprise') {
      leads = leads.filter(l => dynamicAEEmails.includes(l.ownerEmail))
    }
    return c.json({ leads, total: leads.length })
  } catch (err) {
    return c.json({ error: 'Failed to fetch leads', details: err.message }, 500)
  }
})

app.get('/api/leads/:id', requireAuth, async (c) => {
  try {
    const leadId = c.req.param('id')
    const [leadRes, activitiesRes, notesRes] = await Promise.allSettled([
      getLead(c.env, leadId),
      getLeadActivities(c.env, leadId),
      getLeadNotes(c.env, leadId),
    ])
    const leadData = leadRes.status === 'fulfilled' ? leadRes.value : null
    if (!leadData?.data?.[0]) return c.json({ error: 'Lead not found' }, 404)
    const lead = mapZohoLead(leadData.data[0])
    lead.activities = activitiesRes.status === 'fulfilled' ? (activitiesRes.value?.data || []) : []
    lead.notes = notesRes.status === 'fulfilled' ? (notesRes.value?.data || []) : []
    return c.json(lead)
  } catch (err) {
    return c.json({ error: 'Failed to fetch lead', details: err.message }, 500)
  }
})

app.post('/api/leads/:id/disqualify', requireAuth, async (c) => {
  try {
    const leadId = c.req.param('id')
    const { reason } = await c.req.json().catch(() => ({}))
    await updateLead(c.env, leadId, {
      Lead_Status: 'Disqualified',
      ...(reason ? { Disqualified_reason: reason } : {})
    })
    // Clear leads cache so inbox refreshes
    try { await c.env.TOKEN_CACHE.delete('v3_leads_cache') } catch {}
    return c.json({ success: true })
  } catch (err) {
    return c.json({ error: 'Failed to disqualify lead', details: err.message }, 500)
  }
})

app.post('/api/leads/:id/activity', requireAuth, async (c) => {
  try {
    const leadId = c.req.param('id')
    const body = await c.req.json()
    const result = await createLeadActivity(c.env, leadId, body)
    return c.json({ success: true, result })
  } catch (err) {
    return c.json({ error: 'Failed to log activity', details: err.message }, 500)
  }
})

app.get('/api/leads/:id/notes', requireAuth, async (c) => {
  try {
    const leadId = c.req.param('id')
    const { results } = await c.env.DB.prepare(
      'SELECT id, content, author_name as authorName, author_email as authorEmail, created_at as createdAt FROM deal_notes WHERE deal_id = ? ORDER BY created_at DESC'
    ).bind(leadId).all()
    return c.json({ notes: results || [] })
  } catch (err) {
    return c.json({ notes: [] })
  }
})

app.post('/api/leads/:id/notes', requireAuth, async (c) => {
  try {
    const leadId = c.req.param('id')
    const user = c.get('user')
    const { content } = await c.req.json()
    if (!content?.trim()) return c.json({ error: 'Note content required' }, 400)
    const id = crypto.randomUUID()
    const now = new Date().toISOString()
    await c.env.DB.prepare(
      'INSERT INTO deal_notes (id, deal_id, content, author_email, author_name, created_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).bind(id, leadId, content, user.email, user.name, now).run()
    try {
      await createLeadNote(c.env, leadId, content)
    } catch (zohoErr) {
      console.error('Zoho lead note sync failed (non-blocking):', zohoErr.message)
    }
    await logLeadTimelineEvent(c.env, leadId, {
      eventType: 'note_added',
      description: 'Note added',
      actorName: user.name,
      actorEmail: user.email,
    })
    return c.json({ success: true, note: { id, content, author_name: user.name, authorName: user.name, authorEmail: user.email, created_at: now } })
  } catch (err) {
    return c.json({ error: 'Failed to create note', details: err.message }, 500)
  }
})

app.post('/api/leads/:id/convert', requireAuth, async (c) => {
  const safeJson = async (res) => { const text = await res.text(); return text ? JSON.parse(text) : null }

  try {
    const leadId = c.req.param('id')
    const token = await getAccessToken(c.env)

    // 1. Get lead details
    const leadRes = await safeJson(await fetch(
      `https://www.zohoapis.com/crm/v2/Leads/${leadId}`,
      { headers: { Authorization: `Zoho-oauthtoken ${token}` } }
    ))

    if (!leadRes?.data?.[0]) return c.json({ error: 'Lead not found' }, 404)
    const lead = leadRes.data[0]

    const email = lead.Email || ''
    const company = lead.Company || ''
    const firstName = lead.First_Name || ''
    const lastName = lead.Last_Name || ''
    const phone = lead.Phone || ''
    const volume = lead.How_many_orders_do_you_ship_in_a_month || ''
    const leadSource = lead.Lead_Source || ''
    const ownerId = lead.Owner?.id || ''
    const pipeline = volume === 'More than 10,000 orders/month' ? 'Enterprise 2.0' : 'Mid-market'

    // 2. Find or create Account
    let accountId = ''
    const accountSearchRes = await safeJson(await fetch(
      `https://www.zohoapis.com/crm/v2/Accounts/search?criteria=(Account_Name:equals:${encodeURIComponent(company)})`,
      { headers: { Authorization: `Zoho-oauthtoken ${token}` } }
    ))

    if (accountSearchRes?.data?.[0]) {
      accountId = accountSearchRes.data[0].id
    } else {
      const accountCreate = await safeJson(await fetch(
        'https://www.zohoapis.com/crm/v2/Accounts',
        {
          method: 'POST',
          headers: { Authorization: `Zoho-oauthtoken ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ data: [{ Account_Name: company, Phone: phone, Owner: { id: ownerId } }] })
        }
      ))
      accountId = accountCreate?.data?.[0]?.details?.id || ''
    }

    // 3. Find or create Contact
    let contactId = ''
    const contactSearchRes = await safeJson(await fetch(
      `https://www.zohoapis.com/crm/v2/Contacts/search?criteria=(Email:equals:${encodeURIComponent(email)})`,
      { headers: { Authorization: `Zoho-oauthtoken ${token}` } }
    ))

    if (contactSearchRes?.data?.[0]) {
      contactId = contactSearchRes.data[0].id
    } else {
      const contactCreate = await safeJson(await fetch(
        'https://www.zohoapis.com/crm/v2/Contacts',
        {
          method: 'POST',
          headers: { Authorization: `Zoho-oauthtoken ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ data: [{
            First_Name: firstName,
            Last_Name: lastName || company,
            Email: email,
            Phone: phone,
            Account_Name: { id: accountId },
            Owner: { id: ownerId }
          }] })
        }
      ))
      contactId = contactCreate?.data?.[0]?.details?.id || ''
    }

    // 4. Create Deal
    const dealRes = await safeJson(await fetch(
      'https://www.zohoapis.com/crm/v2/Deals',
      {
        method: 'POST',
        headers: { Authorization: `Zoho-oauthtoken ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: [{
          Deal_Name: company + ' — Inbound',
          Stage: 'Upcoming Demo',
          Pipeline: pipeline,
          Account_Name: { id: accountId },
          Contact_Name: { id: contactId },
          Owner: { id: ownerId },
          How_many_orders_do_you_ship_in_a_month: volume,
          Lead_Source: leadSource,
          Layout: { id: '6483035000025962021' }
        }] })
      }
    ))

    const dealId = dealRes?.data?.[0]?.details?.id || ''
    if (!dealId) {
      return c.json({ error: 'Failed to create deal', details: dealRes }, 400)
    }

    // 5. Mark lead as converted
    await fetch(
      `https://www.zohoapis.com/crm/v2/Leads/${leadId}`,
      {
        method: 'PUT',
        headers: { Authorization: `Zoho-oauthtoken ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: [{ Lead_Status: 'Converted' }] })
      }
    )

    // 6. Clear caches
    try { await c.env.TOKEN_CACHE.delete('v3_leads_cache') } catch {}
    try { await c.env.TOKEN_CACHE.delete('v3_deals_cache') } catch {}

    return c.json({ success: true, dealId, accountId, contactId, pipeline })
  } catch (err) {
    console.error('Convert error:', err.message, err.stack)
    return c.json({ error: err.message }, 500)
  }
})

// ── LEAD DEDUP CHECK ──────────────────────────────────────

app.get('/api/leads/:id/dedup-check', requireAuth, async (c) => {
  try {
    const leadId = c.req.param('id')
    const token = await getAccessToken(c.env)

    const cached = await c.env.TOKEN_CACHE.get('v3_leads_cache')
    const allLeads = cached ? JSON.parse(cached) : []
    const lead = allLeads.find(l => l.id === leadId)
    if (!lead) return c.json({ error: 'Lead not found' }, 404)

    const email = (lead.Email || '').toLowerCase().trim()
    const rawPhone = (lead.Phone || '').trim()
    const company = (lead.Company || '').trim()

    const normalizePhone = (p) => {
      let n = p.replace(/[\s\-\(\)]/g, '')
      if (n.startsWith('+91')) n = n.slice(3)
      if (n.startsWith('91') && n.length === 12) n = n.slice(2)
      if (n.startsWith('0') && n.length === 11) n = n.slice(1)
      return n
    }
    const phone = normalizePhone(rawPhone)

    const PERSONAL_DOMAINS = [
      'gmail.com', 'yahoo.com', 'hotmail.com',
      'outlook.com', 'rediffmail.com', 'yahoo.in',
      'ymail.com', 'live.com', 'icloud.com',
      'protonmail.com', 'aol.com', 'hotmail.co.in'
    ]
    const emailDomain = email.includes('@') ? email.split('@')[1] : ''
    const isPersonalEmail = PERSONAL_DOMAINS.includes(emailDomain)

    const [emailDomainRes, phoneRes, brandLeadsRes, brandDealsRes, emailContactRes, phoneContactRes] = await Promise.all([
      !isPersonalEmail && emailDomain
        ? fetch(
            `https://www.zohoapis.com/crm/v2/Leads/search?criteria=(Email:contains:@${emailDomain})&fields=id,Full_Name,Email,Phone,Company,Lead_Status,$converted&per_page=10`,
            { headers: { Authorization: `Zoho-oauthtoken ${token}` } }
          ).then(r => r.status === 204 ? { data: [] } : r.json()).catch(() => ({ data: [] }))
        : Promise.resolve({ data: [] }),

      phone
        ? fetch(
            `https://www.zohoapis.com/crm/v2/Leads/search?criteria=(Phone:equals:${phone})&fields=id,Full_Name,Email,Phone,Company,Lead_Status,$converted&per_page=10`,
            { headers: { Authorization: `Zoho-oauthtoken ${token}` } }
          ).then(r => r.status === 204 ? { data: [] } : r.json()).catch(() => ({ data: [] }))
        : Promise.resolve({ data: [] }),

      company
        ? fetch(
            `https://www.zohoapis.com/crm/v2/Leads/search?criteria=(Company:equals:${encodeURIComponent(company)})&fields=id,Full_Name,Email,Phone,Company,Lead_Status,$converted&per_page=5`,
            { headers: { Authorization: `Zoho-oauthtoken ${token}` } }
          ).then(r => r.status === 204 ? { data: [] } : r.json()).catch(() => ({ data: [] }))
        : Promise.resolve({ data: [] }),

      company
        ? fetch(
            `https://www.zohoapis.com/crm/v2/Deals/search?criteria=(Deal_Name:contains:${encodeURIComponent(company)})&fields=id,Deal_Name,Stage,Owner,Pipeline,Account_Name&per_page=5`,
            { headers: { Authorization: `Zoho-oauthtoken ${token}` } }
          ).then(r => r.status === 204 ? { data: [] } : r.json()).catch(() => ({ data: [] }))
        : Promise.resolve({ data: [] }),

      email
        ? fetch(
            `https://www.zohoapis.com/crm/v2/Contacts/search?criteria=(Email:equals:${encodeURIComponent(email)})&fields=id,Full_Name,Email,Phone,Account_Name&per_page=5`,
            { headers: { Authorization: `Zoho-oauthtoken ${token}` } }
          ).then(r => r.status === 204 ? { data: [] } : r.json()).catch(() => ({ data: [] }))
        : Promise.resolve({ data: [] }),

      phone
        ? fetch(
            `https://www.zohoapis.com/crm/v2/Contacts/search?criteria=(Phone:equals:${encodeURIComponent(phone)})&fields=id,Full_Name,Email,Phone,Account_Name&per_page=5`,
            { headers: { Authorization: `Zoho-oauthtoken ${token}` } }
          ).then(r => r.status === 204 ? { data: [] } : r.json()).catch(() => ({ data: [] }))
        : Promise.resolve({ data: [] }),
    ])

    const mapLead = l => ({
      id: l.id,
      fullName: l.Full_Name || l.fullName,
      email: l.Email || l.email,
      phone: l.Phone || l.phone,
      company: l.Company || l.company,
      leadStatus: l.Lead_Status || l.leadStatus,
      converted: l.$converted || false,
    })

    const mapContact = c => ({
      id: c.id,
      fullName: c.Full_Name,
      email: c.Email,
      phone: c.Phone,
      accountName: c.Account_Name?.name || c.Account_Name,
    })

    const emailDomainMatches = (emailDomainRes.data || []).filter(l => l.id !== leadId).map(mapLead)
    const phoneMatches = (phoneRes.data || []).filter(l => l.id !== leadId).map(mapLead)
    const brandLeadMatches = (brandLeadsRes.data || []).filter(l => l.id !== leadId).map(mapLead)
    const brandDealMatches = (brandDealsRes.data || []).map(d => ({
      id: d.id,
      dealName: d.Deal_Name,
      stage: d.Stage,
      ownerName: d.Owner?.name,
      pipeline: d.Pipeline,
      accountName: d.Account_Name?.name || d.Account_Name,
    }))
    const emailContactMatches = (emailContactRes.data || []).map(mapContact)
    const phoneContactMatches = (phoneContactRes.data || []).map(mapContact)

    return c.json({
      isPersonalEmail,
      emailDomain,
      emailDomainMatches,
      phoneMatches,
      brandLeadMatches,
      brandDealMatches,
      emailContactMatches,
      phoneContactMatches,
      hasDuplicates: emailDomainMatches.length > 0 || phoneMatches.length > 0 || brandLeadMatches.length > 0 || brandDealMatches.length > 0 || emailContactMatches.length > 0 || phoneContactMatches.length > 0,
    })
  } catch (err) {
    console.error('Dedup check error:', err.message)
    return c.json({ error: err.message }, 500)
  }
})

// ── LEAD MERGE ────────────────────────────────────────────

app.post('/api/leads/:id/merge', requireAuth, async (c) => {
  try {
    const user = c.get('user')
    const allowedRoles = ['admin', 'lead-midmarket', 'lead-enterprise', 'mde', 'ae']
    if (!allowedRoles.includes(user.role)) {
      return c.json({ error: 'Not authorised' }, 403)
    }

    const leadId = c.req.param('id')
    const { duplicateLeadId } = await c.req.json()
    if (!duplicateLeadId) return c.json({ error: 'duplicateLeadId is required' }, 400)

    const token = await getAccessToken(c.env)

    const LEAD_MERGE_FIELDS = 'id,Created_Time,Full_Name,Email,Phone,Company,Lead_Status,Lead_Source,Owner'
    const [currentRes, duplicateRes] = await Promise.all([
      zohoAPI(c.env, 'GET', `/Leads/${leadId}?fields=${LEAD_MERGE_FIELDS}`),
      zohoAPI(c.env, 'GET', `/Leads/${duplicateLeadId}?fields=${LEAD_MERGE_FIELDS}`),
    ])

    const currentLead = currentRes?.data?.[0]
    const duplicateLead = duplicateRes?.data?.[0]
    if (!currentLead || !duplicateLead) return c.json({ error: 'Could not fetch leads' }, 404)

    const currentDate = new Date(currentLead.Created_Time)
    const duplicateDate = new Date(duplicateLead.Created_Time)
    const masterLead = currentDate <= duplicateDate ? currentLead : duplicateLead
    const childLead = currentDate <= duplicateDate ? duplicateLead : currentLead

    const MERGE_FIELDS = ['Full_Name', 'Email', 'Phone', 'Company', 'Lead_Source', 'Lead_Status', 'Owner']
    const childFieldsToKeep = MERGE_FIELDS
      .filter(field => !masterLead[field] && childLead[field])
      .map(field => ({ api_name: field }))

    const mergePayload = {
      merge: [{
        master_record_fields: MERGE_FIELDS.filter(f => masterLead[f]).map(f => ({ api_name: f })),
        data: [{
          id: childLead.id,
          _fields: childFieldsToKeep.length > 0 ? childFieldsToKeep : [{ api_name: 'Full_Name' }],
        }],
      }],
    }

    const mergeRes = await fetch(
      `https://www.zohoapis.com/crm/v8/Leads/${masterLead.id}/actions/merge`,
      {
        method: 'POST',
        headers: { Authorization: `Zoho-oauthtoken ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(mergePayload),
      }
    )
    const mergeData = await mergeRes.json()

    if (mergeData?.merge?.[0]?.status !== 'success') {
      console.error('Merge failed:', JSON.stringify(mergeData))
      return c.json({ error: 'Merge failed', details: mergeData }, 500)
    }

    try { await c.env.TOKEN_CACHE.delete('v3_leads_cache') } catch {}

    return c.json({
      success: true,
      masterLeadId: masterLead.id,
      masterLeadName: masterLead.Full_Name,
      message: `Merged into ${masterLead.Full_Name} (older lead)`,
    })
  } catch (err) {
    console.error('Merge error:', err.message)
    return c.json({ error: err.message }, 500)
  }
})

// ── LEAD ACTIVITIES ───────────────────────────────────────

app.get('/api/leads/:id/tasks', requireAuth, async (c) => {
  try {
    const leadId = c.req.param('id')
    const res = await zohoAPI(c.env, 'GET', `/Tasks/search?criteria=(What_Id:equals:${leadId})&fields=id,Subject,Status,Due_Date,Priority,Description,Owner,Created_Time`)
    if (!res?.data) return c.json({ tasks: [] })
    return c.json({ tasks: res.data.map(mapZohoTask) })
  } catch (err) {
    return c.json({ tasks: [] })
  }
})

app.get('/api/leads/:id/cadences', requireAuth, async (c) => {
  try {
    const leadId = c.req.param('id')

    const res = await zohoAPI(c.env, 'GET',
      `/Leads/${leadId}/Entity_Cadences_leads?fields=Cadencesid__s,Start_Date__s,End_Date__s,Enrolled_By__s,Unenrolled_Date__s,Cadences_Status__s,Member_Status__s,Last_Follow_up_Response__s,Last_Follow_up_Date__s,Next_Follow_Up__s,Last_Follow_Up_Type__s&per_page=10`)

    const cadences = (res?.data || []).map(c => ({
      id: c.id,
      cadenceName: c.Cadencesid__s?.name || '—',
      startDate: c.Start_Date__s,
      completedDate: c.End_Date__s,
      enrolledBy: c.Enrolled_By__s?.name || '—',
      unenrolledDate: c.Unenrolled_Date__s,
      cadenceStatus: c.Cadences_Status__s,
      memberStatus: c.Member_Status__s,
      lastFollowUpResponse: c.Last_Follow_up_Response__s,
      lastFollowUpDate: c.Last_Follow_up_Date__s,
      nextFollowUp: c.Next_Follow_Up__s,
      lastFollowUpType: c.Last_Follow_Up_Type__s
    }))

    return c.json({ cadences })
  } catch (err) {
    console.error('Cadences fetch error:', err.message)
    return c.json({ cadences: [] })
  }
})

app.get('/api/leads/:id/emails', requireAuth, async (c) => {
  const leadId = c.req.param('id')
  try {
    const res = await zohoAPI(c.env, 'GET', `/Leads/${leadId}/Emails`)
    console.log('Lead emails raw:', JSON.stringify(res).slice(0, 3000))
    const all = res?.email_related_list || res?.Emails || []
    const mails = all.filter(e => e.sent === true)
    const drafts = all.filter(e => e.sent === false && e.status?.[0]?.type === 'draft')
    const scheduled = all.filter(e => e.status?.[0]?.type === 'scheduled')
    const mapEmail = e => ({
      id: e.message_id,
      subject: e.subject || '(No Subject)',
      date: e.sent_time || e.time,
      from: e.from?.email || e.from?.user_name || '—',
      fromName: e.from?.user_name || '',
      to: (e.to || []).map(t => t.email).join(', '),
      status: e.status?.[0]?.type || '—',
      source: e.source || '—',
      sentiment: e.sentiment_info || '—',
      hasAttachment: e.has_attachment || false,
    })
    console.log('Lead emails - total:', all.length, 'mails:', mails.length, 'drafts:', drafts.length, 'scheduled:', scheduled.length)
    return c.json({ mails: mails.map(mapEmail), drafts: drafts.map(mapEmail), scheduled: scheduled.map(mapEmail) })
  } catch (err) {
    console.error('Lead emails fetch error:', err.message)
    return c.json({ mails: [], drafts: [], scheduled: [] })
  }
})

app.get('/api/leads/:id/emails/:messageId', requireAuth, async (c) => {
  const leadId = c.req.param('id')
  const messageId = c.req.param('messageId')
  try {
    const res = await zohoAPI(c.env, 'GET', `/Leads/${leadId}/Emails/${messageId}`)
    console.log('Single email raw:', JSON.stringify(res).slice(0, 2000))
    const email = res?.email_related_list?.[0] || res?.Emails?.[0]
    return c.json({ content: email?.content || '', subject: email?.subject || '' })
  } catch (err) {
    console.error('Lead email body fetch error:', err.message)
    return c.json({ content: '', subject: '' })
  }
})

app.post('/api/leads/:id/tasks', requireAuth, async (c) => {
  try {
    const leadId = c.req.param('id')
    const user = c.get('user')
    const body = await c.req.json()
    if (!body.subject?.trim()) return c.json({ error: 'Subject required' }, 400)
    const result = await zohoAPI(c.env, 'POST', '/Tasks', {
      data: [{
        Subject: body.subject,
        Due_Date: body.dueDate || body.due_date || new Date(Date.now() + 86400000).toISOString().split('T')[0],
        Status: 'Not Started',
        Priority: body.priority || 'Normal',
        Description: body.description || '',
        What_Id: leadId,
        '$se_module': 'Leads',
      }]
    })
    if (result?.data?.[0]?.code !== 'SUCCESS') return c.json({ error: 'Failed to create task in Zoho' }, 500)
    await logLeadTimelineEvent(c.env, leadId, {
      eventType: 'task_created',
      description: `Task created: ${body.subject}`,
      actorName: user.name,
      actorEmail: user.email,
    })
    return c.json({ success: true, taskId: result.data[0].details.id })
  } catch (err) {
    return c.json({ error: err.message }, 500)
  }
})

app.get('/api/leads/:id/meetings', requireAuth, async (c) => {
  try {
    const leadId = c.req.param('id')
    const res = await zohoAPI(c.env, 'GET', `/Events/search?criteria=(What_Id:equals:${leadId})&fields=id,Event_Title,Venue,Start_DateTime,End_DateTime,Description,Status,Created_By`)
    return c.json({ meetings: (res?.data || []).map(m => ({
      id: m.id, title: m.Event_Title || '', venue: m.Venue || '',
      from: m.Start_DateTime, to: m.End_DateTime, description: m.Description || '',
      status: m.Status || '', createdBy: m.Created_By?.name || '',
    })) })
  } catch (err) {
    return c.json({ meetings: [] })
  }
})

app.post('/api/leads/:id/meeting', requireAuth, async (c) => {
  try {
    const leadId = c.req.param('id')
    const user = c.get('user')
    const body = await c.req.json()
    const result = await zohoAPI(c.env, 'POST', '/Events', {
      data: [{
        Event_Title: body.title,
        Venue: body.venue || 'Online',
        Start_DateTime: toZohoDateTime(body.from),
        End_DateTime: toZohoDateTime(body.to),
        Description: body.description || '',
        What_Id: leadId,
        '$se_module': 'Leads',
      }]
    })
    if (!result || result.data?.[0]?.status === 'error') return c.json({ error: 'Zoho API error', details: result }, 500)
    await logLeadTimelineEvent(c.env, leadId, {
      eventType: 'meeting_created',
      description: `Meeting scheduled: ${body.title}`,
      actorName: user.name,
      actorEmail: user.email,
      metadata: { title: body.title, venue: body.venue },
    })
    return c.json({ success: true })
  } catch (err) {
    return c.json({ error: err.message }, 500)
  }
})

app.get('/api/leads/:id/calls', requireAuth, async (c) => {
  try {
    const leadId = c.req.param('id')
    const res = await zohoAPI(c.env, 'GET', `/Calls/search?criteria=(What_Id:equals:${leadId})&fields=id,Subject,Call_Purpose,Call_Agenda,Call_Result,Call_Start_Time,Call_Status,Outbound_Call_Status,Description,Created_By`)
    return c.json({ calls: (res?.data || []).map(cl => ({
      id: cl.id, subject: cl.Subject || '', purpose: cl.Call_Purpose || '',
      agenda: cl.Call_Agenda || '', result: cl.Call_Result || '',
      timing: cl.Call_Start_Time, status: cl.Call_Status || '',
      description: cl.Description || '', createdBy: cl.Created_By?.name || '',
    })) })
  } catch (err) {
    return c.json({ calls: [] })
  }
})

app.post('/api/leads/:id/log-call', requireAuth, async (c) => {
  try {
    const leadId = c.req.param('id')
    const user = c.get('user')
    const body = await c.req.json()
    const result = await zohoAPI(c.env, 'POST', '/Calls', {
      data: [{
        Subject: `Call - ${body.callPurpose || 'Call'}`,
        Call_Type: 'Outbound',
        Call_Status: 'Completed',
        Call_Duration: '00:05',
        Call_Purpose: body.callPurpose || 'None',
        Call_Agenda: body.callAgenda || '',
        Call_Result: body.callResult || 'None',
        Call_Start_Time: toZohoDateTime(body.callTiming),
        Description: body.description || '',
        What_Id: leadId,
        '$se_module': 'Leads',
      }]
    })
    if (!result || result.data?.[0]?.status === 'error') return c.json({ error: 'Zoho API error', details: result }, 500)
    await logLeadTimelineEvent(c.env, leadId, {
      eventType: 'call_logged',
      description: `Call logged: ${body.callPurpose}`,
      actorName: user.name,
      actorEmail: user.email,
      metadata: { purpose: body.callPurpose, result: body.callResult },
    })
    return c.json({ success: true })
  } catch (err) {
    return c.json({ error: err.message }, 500)
  }
})

app.post('/api/leads/:id/schedule-call', requireAuth, async (c) => {
  try {
    const leadId = c.req.param('id')
    const user = c.get('user')
    const body = await c.req.json()
    const result = await zohoAPI(c.env, 'POST', '/Calls', {
      data: [{
        Subject: `Scheduled Call - ${body.callPurpose || 'Call'}`,
        Call_Type: 'Outbound',
        Call_Status: 'Scheduled',
        Call_Purpose: body.callPurpose || 'None',
        Call_Agenda: body.callAgenda || '',
        Call_Start_Time: toZohoDateTime(body.callTiming),
        Description: body.description || '',
        What_Id: leadId,
        '$se_module': 'Leads',
      }]
    })
    if (!result || result.data?.[0]?.status === 'error') return c.json({ error: 'Zoho API error', details: result }, 500)
    await logLeadTimelineEvent(c.env, leadId, {
      eventType: 'call_scheduled',
      description: `Call scheduled: ${body.callPurpose}`,
      actorName: user.name,
      actorEmail: user.email,
      metadata: { purpose: body.callPurpose },
    })
    return c.json({ success: true })
  } catch (err) {
    return c.json({ error: err.message }, 500)
  }
})

app.patch('/api/leads/:id/tasks/:taskId', requireAuth, async (c) => {
  try {
    const taskId = c.req.param('taskId')
    await updateTaskStatus(c.env, taskId, 'Completed')
    return c.json({ success: true })
  } catch (err) {
    return c.json({ error: err.message }, 500)
  }
})

app.patch('/api/leads/:id/meeting/:meetingId/complete', requireAuth, async (c) => {
  try {
    const meetingId = c.req.param('meetingId')
    function msToZohoIST(ms) {
      const d = new Date(ms + (5.5 * 60 * 60 * 1000))
      const pad = n => String(n).padStart(2, '0')
      return `${d.getUTCFullYear()}-${pad(d.getUTCMonth()+1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:00+05:30`
    }
    const startMs = Date.now() - (2 * 60 * 1000)
    const endMs = Date.now() - (1 * 60 * 1000)
    await zohoAPI(c.env, 'PUT', `/Events/${meetingId}`, { data: [{ id: meetingId, Start_DateTime: msToZohoIST(startMs), End_DateTime: msToZohoIST(endMs) }] })
    return c.json({ success: true })
  } catch (err) {
    return c.json({ error: err.message }, 500)
  }
})

app.patch('/api/leads/:id/call/:callId/complete', requireAuth, async (c) => {
  try {
    const leadId = c.req.param('id')
    const callId = c.req.param('callId')
    const callRes = await zohoAPI(c.env, 'GET', `/Calls/${callId}?fields=Subject,Call_Purpose,Call_Agenda,Description`)
    const callData = callRes?.data?.[0]
    function msToZohoIST(ms) {
      const d = new Date(ms + (5.5 * 60 * 60 * 1000))
      const pad = n => String(n).padStart(2, '0')
      return `${d.getUTCFullYear()}-${pad(d.getUTCMonth()+1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:00+05:30`
    }
    await zohoAPI(c.env, 'DELETE', `/Calls?ids=${callId}`)
    await zohoAPI(c.env, 'POST', '/Calls', {
      data: [{
        Subject: callData?.Subject || 'Call',
        Call_Type: 'Outbound',
        Call_Status: 'Completed',
        Call_Duration: '00:05',
        Call_Purpose: callData?.Call_Purpose || '',
        Call_Agenda: callData?.Call_Agenda || '',
        Description: callData?.Description || '',
        Call_Start_Time: msToZohoIST(Date.now()),
        What_Id: leadId,
        '$se_module': 'Leads',
      }]
    })
    return c.json({ success: true })
  } catch (err) {
    return c.json({ error: err.message }, 500)
  }
})

// ── TASKS ─────────────────────────────────────────────────

function mapZohoTask(t) {
  return {
    id: t.id,
    subject: t.Subject || '',
    status: t.Status || 'Not Started',
    priority: t.Priority || 'Normal',
    dueDate: t.Due_Date || '',
    description: t.Description || '',
    ownerName: t.Owner?.name || '',
    ownerEmail: t.Owner?.email || '',
    dealId: t.What_Id?.id || '',
    dealName: t.What_Id?.name || '',
    createdAt: t.Created_Time || '',
    modifiedAt: t.Modified_Time || '',
    isComplete: t.Status === 'Completed',
  }
}

const TASK_MDE_EMAILS = ['sriya.komal@eshopbox.com','mriganki.srivastava@eshopbox.com','shubham.kumar@eshopbox.com','raghwendra.kumar@eshopbox.com']
const TASK_AE_EMAILS = ['taufeeq.ahmad@eshopbox.com','afzal.maknoo@eshopbox.com','gautam@eshopbox.com','jeevan.more@eshopbox.com']

app.get('/api/tasks', requireAuth, async (c) => {
  try {
    const user = c.get('user')
    const [dynamicMDEEmails, dynamicAEEmails] = await Promise.all([
      getMDEEmails(c.env.DB),
      getAEEmails(c.env.DB)
    ])
    const res = await getTasks(c.env)
    if (!res?.data) return c.json({ tasks: [] })
    let tasks = res.data.map(mapZohoTask)
    if (user.role === 'mde' || user.role === 'ae') {
      tasks = tasks.filter(t => t.ownerEmail === user.email)
    } else if (user.role === 'lead-midmarket') {
      tasks = tasks.filter(t => dynamicMDEEmails.includes(t.ownerEmail))
    } else if (user.role === 'lead-enterprise') {
      tasks = tasks.filter(t => dynamicAEEmails.includes(t.ownerEmail))
    }
    return c.json({ tasks, total: tasks.length })
  } catch (err) {
    return c.json({ error: 'Failed to fetch tasks', details: err.message }, 500)
  }
})

app.get('/api/deals/:id/tasks', requireAuth, async (c) => {
  try {
    const dealId = c.req.param('id')
    const res = await getTasks(c.env, { deal_id: dealId })
    if (!res?.data) return c.json({ tasks: [] })
    const tasks = res.data.map(mapZohoTask)
    return c.json({ tasks, total: tasks.length })
  } catch (err) {
    return c.json({ error: 'Failed to fetch deal tasks', details: err.message }, 500)
  }
})

app.post('/api/deals/:id/tasks', requireAuth, async (c) => {
  try {
    const dealId = c.req.param('id')
    const user = c.get('user')
    const body = await c.req.json()
    if (!body.subject?.trim()) return c.json({ error: 'Subject required' }, 400)

    const result = await createTask(c.env, dealId, {
      Subject: body.subject,
      Due_Date: body.dueDate || new Date(Date.now() + 86400000).toISOString().split('T')[0],
      Status: 'Not Started',
      Priority: body.priority || 'Normal',
      Description: body.description || '',
    })

    console.log('createTask result:', JSON.stringify(result))

    if (result?.data?.[0]?.code !== 'SUCCESS') {
      console.error('Zoho task error:', JSON.stringify(result))
      return c.json({ error: 'Failed to create task in Zoho' }, 500)
    }
    await logTimelineEvent(c.env, dealId, {
      eventType: 'task_created',
      description: `Task created: ${body.subject}`,
      actorName: user.name,
      actorEmail: user.email,
      metadata: { subject: body.subject, dueDate: body.dueDate }
    })
    return c.json({ success: true, taskId: result.data[0].details.id })
  } catch (err) {
    return c.json({ error: err.message }, 500)
  }
})

app.post('/api/tasks', requireAuth, async (c) => {
  try {
    const body = await c.req.json()
    if (!body.subject?.trim()) return c.json({ error: 'Subject required' }, 400)
    const result = await createGenericTask(c.env, body)
    if (!result?.data?.[0]?.details?.id) return c.json({ error: 'Failed to create task in Zoho' }, 500)
    return c.json({ success: true, taskId: result.data[0].details.id })
  } catch (err) {
    return c.json({ error: 'Failed to create task', details: err.message }, 500)
  }
})

app.patch('/api/tasks/:id/complete', requireAuth, async (c) => {
  try {
    const taskId = c.req.param('id')
    const user = c.get('user')
    const taskRes = await getTask(c.env, taskId)
    const taskData = taskRes?.data?.[0]
    await updateTaskStatus(c.env, taskId, 'Completed')
    if (taskData?.What_Id) {
      await logTimelineEvent(c.env, taskData.What_Id, {
        eventType: 'task_completed',
        description: `Task completed: ${taskData.Subject || 'Task'}`,
        actorName: user.name,
        actorEmail: user.email,
        metadata: { taskId }
      })
    }
    return c.json({ success: true })
  } catch (err) {
    return c.json({ error: 'Failed to complete task', details: err.message }, 500)
  }
})

app.patch('/api/tasks/:id/reopen', requireAuth, async (c) => {
  try {
    const taskId = c.req.param('id')
    await updateTaskStatus(c.env, taskId, 'Not Started')
    return c.json({ success: true })
  } catch (err) {
    return c.json({ error: 'Failed to reopen task', details: err.message }, 500)
  }
})

// ── Reassign routes ────────────────────────────────────────

app.get('/api/team/assignable-users', requireAuth, async (c) => {
  try {
    const user = c.get('user')
    if (!['admin', 'lead-midmarket', 'lead-enterprise'].includes(user?.role))
      return c.json({ error: 'Forbidden' }, 403)
    const result = await c.env.DB.prepare(
      `SELECT id, name, email, role FROM users
       WHERE role IN ('ae', 'mde', 'lead-midmarket', 'lead-enterprise')
         AND is_active = 1
       ORDER BY name ASC`
    ).all()
    return c.json({ users: result.results })
  } catch (err) {
    return c.json({ error: err.message }, 500)
  }
})

app.patch('/api/deals/:id/reassign', requireAuth, async (c) => {
  try {
    const user = c.get('user')
    if (!['admin', 'lead-midmarket', 'lead-enterprise'].includes(user?.role))
      return c.json({ error: 'Forbidden' }, 403)
    const dealId = c.req.param('id')
    const { newOwnerEmail, newOwnerName } = await c.req.json()
    const zohoUsers = await zohoAPI(c.env, 'GET', '/users?type=ActiveUsers')
    const zohoUser = zohoUsers?.users?.find(u => u.email === newOwnerEmail)
    if (!zohoUser) return c.json({ error: `No Zoho user found for ${newOwnerEmail}` }, 400)
    await zohoAPI(c.env, 'PUT', `/Deals/${dealId}`, {
      data: [{ id: dealId, Owner: { id: zohoUser.id } }]
    })
    await c.env.TOKEN_CACHE.delete('v3_deals_cache')
    await logTimelineEvent(c.env, dealId, {
      eventType: 'deal_reassigned',
      description: `Deal reassigned to ${newOwnerName}`,
      actorName: user.name,
      actorEmail: user.email,
      metadata: { newOwner: newOwnerName, newOwnerEmail }
    })
    return c.json({ success: true })
  } catch (err) {
    return c.json({ error: err.message }, 500)
  }
})

app.patch('/api/leads/:id/reassign', requireAuth, async (c) => {
  try {
    const user = c.get('user')
    if (!['admin', 'lead-midmarket', 'lead-enterprise'].includes(user?.role))
      return c.json({ error: 'Forbidden' }, 403)
    const leadId = c.req.param('id')
    const { newOwnerEmail, newOwnerName } = await c.req.json()
    const zohoUsers = await zohoAPI(c.env, 'GET', '/users?type=ActiveUsers')
    const zohoUser = zohoUsers?.users?.find(u => u.email === newOwnerEmail)
    if (!zohoUser) return c.json({ error: `No Zoho user found for ${newOwnerEmail}` }, 400)
    await zohoAPI(c.env, 'PUT', `/Leads/${leadId}`, {
      data: [{ id: leadId, Owner: { id: zohoUser.id } }]
    })
    try { await c.env.TOKEN_CACHE.delete('v3_leads_cache') } catch (_) {}
    await logLeadTimelineEvent(c.env, leadId, {
      eventType: 'lead_reassigned',
      description: `Lead reassigned to ${newOwnerName}`,
      actorName: user.name,
      actorEmail: user.email,
      metadata: { newOwner: newOwnerName, newOwnerEmail },
    })
    return c.json({ success: true })
  } catch (err) {
    return c.json({ error: err.message }, 500)
  }
})

// ── Bulk assign ────────────────────────────────────────────

app.post('/api/leads/bulk-reassign', requireAuth, async (c) => {
  try {
    const user = c.get('user')
    if (!['admin', 'lead-midmarket', 'lead-enterprise'].includes(user?.role))
      return c.json({ error: 'Forbidden' }, 403)
    const { leadIds, newOwnerEmail, newOwnerName } = await c.req.json()
    if (!Array.isArray(leadIds) || leadIds.length === 0)
      return c.json({ error: 'leadIds required' }, 400)
    if (leadIds.length > 100)
      return c.json({ error: 'Maximum 100 leads per bulk assign' }, 400)

    const zohoUsers = await zohoAPI(c.env, 'GET', '/users?type=ActiveUsers')
    const zohoUser = zohoUsers?.users?.find(u => u.email === newOwnerEmail)
    if (!zohoUser) return c.json({ error: 'User not found in Zoho' }, 404)

    const massUpdateRes = await zohoAPI(c.env, 'PUT', '/Leads', {
      data: leadIds.map(id => ({ id, Owner: { id: zohoUser.id } })),
    })
    console.log('Zoho bulk PUT response:', JSON.stringify(massUpdateRes))

    try { await c.env.TOKEN_CACHE.delete('v3_leads_cache') } catch (_) {}

    for (const leadId of leadIds) {
      try {
        await logLeadTimelineEvent(c.env, leadId, {
          eventType: 'lead_reassigned',
          description: `Lead reassigned to ${newOwnerName}`,
          actorName: user.name,
          actorEmail: user.email,
          metadata: { newOwner: newOwnerName, newOwnerEmail },
        })
      } catch (e) {
        console.error('Timeline log failed for lead:', leadId, e.message)
      }
    }

    await c.env.DB.prepare(`
      INSERT INTO bulk_assign_history
      (id, module, record_count, to_owner_name, to_owner_email,
       to_owner_zoho_id, done_by_name, done_by_email, record_ids, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      crypto.randomUUID(), 'Leads', leadIds.length,
      newOwnerName, newOwnerEmail, zohoUser.id,
      user.name, user.email,
      JSON.stringify(leadIds),
      new Date().toISOString()
    ).run()

    return c.json({ success: true, updated: leadIds.length, zohoResponse: massUpdateRes })
  } catch (err) {
    return c.json({ error: err.message }, 500)
  }
})

app.post('/api/deals/bulk-reassign', requireAuth, async (c) => {
  try {
    const user = c.get('user')
    if (!['admin', 'lead-midmarket', 'lead-enterprise'].includes(user?.role))
      return c.json({ error: 'Forbidden' }, 403)
    const { dealIds, newOwnerEmail, newOwnerName } = await c.req.json()
    if (!Array.isArray(dealIds) || dealIds.length === 0)
      return c.json({ error: 'dealIds required' }, 400)
    if (dealIds.length > 100)
      return c.json({ error: 'Maximum 100 deals per bulk assign' }, 400)

    const zohoUsers = await zohoAPI(c.env, 'GET', '/users?type=ActiveUsers')
    const zohoUser = zohoUsers?.users?.find(u => u.email === newOwnerEmail)
    if (!zohoUser) return c.json({ error: 'User not found in Zoho' }, 404)

    const massUpdateRes = await zohoAPI(c.env, 'PUT', '/Deals', {
      data: dealIds.map(id => ({ id, Owner: { id: zohoUser.id } })),
    })
    console.log('Zoho bulk PUT response:', JSON.stringify(massUpdateRes))

    try { await c.env.TOKEN_CACHE.delete('v3_deals_cache') } catch (_) {}

    for (const dealId of dealIds) {
      try {
        await logTimelineEvent(c.env, dealId, {
          eventType: 'deal_reassigned',
          description: `Deal reassigned to ${newOwnerName}`,
          actorName: user.name,
          actorEmail: user.email,
          metadata: { newOwner: newOwnerName, newOwnerEmail },
        })
      } catch (e) {
        console.error('Timeline log failed for deal:', dealId, e.message)
      }
    }

    await c.env.DB.prepare(`
      INSERT INTO bulk_assign_history
      (id, module, record_count, to_owner_name, to_owner_email,
       to_owner_zoho_id, done_by_name, done_by_email, record_ids, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      crypto.randomUUID(), 'Deals', dealIds.length,
      newOwnerName, newOwnerEmail, zohoUser.id,
      user.name, user.email,
      JSON.stringify(dealIds),
      new Date().toISOString()
    ).run()

    return c.json({ success: true, updated: dealIds.length, zohoResponse: massUpdateRes })
  } catch (err) {
    return c.json({ error: err.message }, 500)
  }
})

app.get('/api/bulk-assign/history', requireAuth, async (c) => {
  try {
    const user = c.get('user')
    if (!['admin', 'lead-midmarket', 'lead-enterprise'].includes(user?.role))
      return c.json({ error: 'Forbidden' }, 403)
    const result = await c.env.DB.prepare(
      'SELECT * FROM bulk_assign_history ORDER BY created_at DESC LIMIT 50'
    ).all()
    return c.json({ history: result.results })
  } catch (err) {
    return c.json({ error: err.message }, 500)
  }
})

app.post('/api/deals/:id/contact', requireAuth, async (c) => {
  const dealId = c.req.param('id')
  const { firstName, lastName, email, phone } = await c.req.json()
  if (!email) return c.json({ error: 'Email is required' }, 400)
  try {
    const upsertRes = await zohoAPI(c.env, 'POST', '/Contacts/upsert', {
      data: [{
        First_Name: firstName || '',
        Last_Name: lastName || '',
        Email: email,
        Phone: phone || '',
      }],
      duplicate_check_fields: ['Email']
    })
    const contact = upsertRes?.data?.[0]
    if (!contact || contact.status === 'error') {
      return c.json({ error: 'Failed to upsert contact in Zoho' }, 500)
    }
    const contactId = contact.details?.id
    if (!contactId) return c.json({ error: 'No contact ID returned' }, 500)
    console.log('Contact upserted:', contactId, contact.code)
    const linkRes = await zohoAPI(c.env, 'PUT', `/Deals/${dealId}`, {
      data: [{ id: dealId, Contact_Name: { id: contactId } }]
    })
    console.log('Contact linked to deal:', linkRes?.data?.[0]?.code)
    try { await c.env.TOKEN_CACHE.delete('v3_deals_cache') } catch (_) {}
    return c.json({ success: true, contactId, action: contact.action || contact.code })
  } catch (err) {
    console.error('Add contact error:', err.message)
    return c.json({ error: err.message }, 500)
  }
})

app.patch('/api/deals/:id/contact', requireAuth, async (c) => {
  try {
    const dealId = c.req.param('id')
    const { email, phone } = await c.req.json()
    const dealRes = await zohoAPI(c.env, 'GET', `/Deals/${dealId}?fields=Contact_Name`)
    const contactId = dealRes?.data?.[0]?.Contact_Name?.id
    if (!contactId) return c.json({ error: 'No contact linked to this deal' }, 400)
    await zohoAPI(c.env, 'PUT', `/Contacts/${contactId}`, {
      data: [{ id: contactId, Email: email, Phone: phone }]
    })
    try { await c.env.TOKEN_CACHE.delete('v3_deals_cache') } catch (_) {}
    return c.json({ success: true })
  } catch (err) {
    return c.json({ error: err.message }, 500)
  }
})

app.patch('/api/leads/:id/fields', requireAuth, async (c) => {
  try {
    const leadId = c.req.param('id')
    const { phone, email, company, city, website } = await c.req.json()
    await zohoAPI(c.env, 'PUT', `/Leads/${leadId}`, {
      data: [{ id: leadId, Phone: phone, Email: email, Company: company, City: city, Website: website }]
    })
    try { await c.env.TOKEN_CACHE.delete('v3_leads_cache') } catch (_) {}
    return c.json({ success: true })
  } catch (err) {
    return c.json({ error: err.message }, 500)
  }
})

let dbMigrated = false;

export default {
  async fetch(request, env, ctx) {
    if (!dbMigrated) {
      try {
        await env.DB.prepare('ALTER TABLE deal_emails ADD COLUMN thread_message_id TEXT').run();
      } catch (_) {}
      try {
        await env.DB.prepare('ALTER TABLE users ADD COLUMN gmail_access_token TEXT').run();
      } catch (_) {}
      try {
        await env.DB.prepare('ALTER TABLE users ADD COLUMN gmail_refresh_token TEXT').run();
      } catch (_) {}
      try {
        await env.DB.prepare('ALTER TABLE users ADD COLUMN gmail_token_expiry INTEGER').run();
      } catch (_) {}
      try {
        await env.DB.prepare('ALTER TABLE deal_emails ADD COLUMN gmail_draft_id TEXT').run();
      } catch (_) {}
      try {
        await env.DB.prepare('ALTER TABLE deal_emails ADD COLUMN gmail_message_id TEXT').run();
      } catch (_) {}
      try {
        await env.DB.prepare('ALTER TABLE deal_emails ADD COLUMN gmail_thread_id TEXT').run();
      } catch (_) {}
      try {
        await env.DB.prepare(`
          CREATE TABLE IF NOT EXISTS password_reset_otps (
            id TEXT PRIMARY KEY,
            email TEXT NOT NULL,
            otp TEXT NOT NULL,
            expires_at INTEGER NOT NULL,
            used INTEGER DEFAULT 0,
            created_at TEXT DEFAULT (datetime('now'))
          )
        `).run();
      } catch (_) {}
      dbMigrated = true;
    }
    return app.fetch(request, env, ctx);
  },
  async scheduled(event, env, ctx) {
    console.log('Cron triggered:', event.cron);
    ctx.waitUntil((async () => {
      try {
        await env.TOKEN_CACHE.delete('v3_deals_cache')
        const { data } = await getAllDeals(env)
        console.log('Cache refresh: total deals cached:', data.length)
      } catch (err) {
        console.error('Cache refresh error:', err.message)
      }
      try {
        await env.TOKEN_CACHE.delete('v3_leads_cache')
        const leads = await getAllLeads(env)
        console.log('Leads cache refreshed:', leads.length)
      } catch (err) {
        console.error('Leads cache refresh error:', err.message)
      }
      await Promise.all([
        runScheduledEmails(env),
        runRepReminders(env),
      ])
    })());
  },
};