import { Hono } from 'hono';
import { getDeals, getDeal, getDealTasks, getDealActivities, updateDeal } from '../services/zoho.js';
import getAttentionFlags, { getAttentionLevel } from '../services/attentionRules.js';
import { scoreToGrade } from '../services/grading.js';

const deals = new Hono();

// Cache helper
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getCached(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.time > CACHE_TTL) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function setCached(key, data) {
  cache.set(key, { data, time: Date.now() });
}

function mapZohoDeal(d) {
  return {
    id: d.id,
    dealName: d.Deal_Name,
    brandName: d.Deal_Name?.split(' — ')[0] || d.Deal_Name,
    stage: d.Stage,
    pipeline: d.Pipeline?.name || d.Pipeline || '',
    repName: d.Owner?.name || 'Unknown',
    repEmail: d.Owner?.email || '',
    grade: d.Deal_Grade || 'D',
    score: d.SA_Forecast_Probability || 0,
    segment: d.SA_Segment || '',
    solutionInterest: d.SA_Solution_Interest || '',
    brandType: d.SA_Brand_Type || '',
    painPoints: d.SA_Pain_Points || '',
    oms: d.SA_OMS || '',
    shoppingCart: d.SA_Shopping_Cart || '',
    currentShipping: d.SA_Current_Shipping || '',
    currentWarehousing: d.SA_Current_Warehousing || '',
    followupMeetingDate: d.SA_Followup_Meeting_Date || null,
    pricingRaised: d.SA_Pricing_Raised || false,
    demoFormat: d.SA_Demo_Format || '',
    f2fCount: d.SA_F2F_Count || 0,
    saLogged: d.SA_Logged || false,
    orderVolume: d['How_many_orders_do_you_ship_in_a_month'] || '',
    modifiedTime: d.Modified_Time || '',
    lostReason: d.Lost_Reason || '',
    demoDate: d.Demo_Date || d.Created_Time?.split('T')[0] || '',
    stageChangedOn: d.Modified_Time?.split('T')[0] || '',
    createdAt: d.Created_Time || '',
    tasks: [],
    activities: [],
    f2fMeetings: [],
  };
}

// GET /api/deals — all deals with attention flags
deals.get('/', async (c) => {
  try {
    const user = c.get('user');
    const cacheKey = `deals_${user.role}_${user.email}`;
    const cached = getCached(cacheKey);
    if (cached) return c.json(cached);

    const zohoResponse = await getDeals(c.env);
    if (!zohoResponse?.data) {
      return c.json({ deals: [], total: 0 });
    }

    let dealsList = zohoResponse.data.map(mapZohoDeal);

    // Reps only see their own deals
    if (user.role === 'Sales rep') {
      dealsList = dealsList.filter(d => d.repEmail === user.email);
    }

    // Run attention rules on each deal
    const dealsWithFlags = dealsList.map(deal => {
      const flags = getAttentionFlags(deal);
      const attentionLevel = getAttentionLevel(flags);
      return { ...deal, flags, attentionLevel };
    });

    // Sort by severity — high flags first
    const severityOrder = { high: 0, medium: 1, info: 2, ok: 3 };
    dealsWithFlags.sort((a, b) =>
      severityOrder[a.attentionLevel] - severityOrder[b.attentionLevel]
    );

    const result = { deals: dealsWithFlags, total: dealsWithFlags.length };
    setCached(cacheKey, result);
    return c.json(result);

  } catch (err) {
    console.error('Get deals error:', err);
    return c.json({ error: 'Failed to fetch deals', details: err.message }, 500);
  }
});

// GET /api/deals/:id — single deal with tasks and activities
deals.get('/:id', async (c) => {
  try {
    const dealId = c.req.param('id');
    const user = c.get('user');

    const [dealRes, tasksRes, activitiesRes] = await Promise.all([
      getDeal(c.env, dealId),
      getDealTasks(c.env, dealId),
      getDealActivities(c.env, dealId),
    ]);

    if (!dealRes?.data?.[0]) {
      return c.json({ error: 'Deal not found' }, 404);
    }

    const deal = mapZohoDeal(dealRes.data[0]);

    // Attach tasks
    deal.tasks = tasksRes?.data || [];

    // Attach activities
    deal.activities = (activitiesRes?.data || []).map(a => ({
      id: a.id,
      type: a.Activity_Type || 'Note',
      date: a.Created_Time,
      description: a.Description || a.Subject || '',
    }));

    // Block rep from seeing other reps deals
    if (user.role === 'Sales rep' && deal.repEmail !== user.email) {
      return c.json({ error: 'Access denied' }, 403);
    }

    // Run attention flags
    const flags = getAttentionFlags(deal);
    const attentionLevel = getAttentionLevel(flags);

    return c.json({ ...deal, flags, attentionLevel });

  } catch (err) {
    console.error('Get deal error:', err);
    return c.json({ error: 'Failed to fetch deal', details: err.message }, 500);
  }
});

// PUT /api/deals/:id/f2f — log F2F meeting
deals.put('/:id/f2f', async (c) => {
  try {
    const dealId = c.req.param('id');
    const { meetingType, date, location, notes } = await c.req.json();

    const dealRes = await getDeal(c.env, dealId);
    if (!dealRes?.data?.[0]) {
      return c.json({ error: 'Deal not found' }, 404);
    }

    const currentF2F = dealRes.data[0].SA_F2F_Count || 0;
    const currentScore = dealRes.data[0].SA_Forecast_Probability || 0;
    const currentGrade = dealRes.data[0].Deal_Grade || 'D';

    // Recalculate score with F2F boost
    let newScore = currentScore;
    if (meetingType === 'warehouse') newScore = Math.min(currentScore + 3, 22);
    else if (meetingType === 'inperson') newScore = Math.min(currentScore + 2, 22);

    const newGrade = scoreToGrade(newScore);

    await updateDeal(c.env, dealId, {
      SA_F2F_Count: currentF2F + 1,
      SA_Forecast_Probability: newScore,
      Deal_Grade: newGrade,
    });

    return c.json({
      success: true,
      previousGrade: currentGrade,
      newGrade,
      previousScore: currentScore,
      newScore,
      f2fCount: currentF2F + 1,
    });

  } catch (err) {
    console.error('F2F error:', err);
    return c.json({ error: 'Failed to log F2F meeting', details: err.message }, 500);
  }
});

export default deals;