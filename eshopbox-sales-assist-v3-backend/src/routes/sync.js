import { Hono } from 'hono';
import { calculateGrade } from '../services/grading.js';
import { createDeal, createTask } from '../services/zoho.js';
import { generateEmailDrafts } from '../services/claude.js';

const sync = new Hono();

sync.post('/', async (c) => {
  try {
    const user = c.get('user');
    const formData = await c.req.json();

    // Step 1 — Calculate grade
    const { score, grade, probability, segment } = calculateGrade(formData);

    // Step 2 — Build Zoho deal payload
    const dealPayload = {
      Deal_Name: `${formData.brandName} — ${new Date().toLocaleDateString('en-IN')}`,
      Stage: 'Demo done',
      Owner: { email: user.email },
      Deal_Grade: grade,
      SA_Forecast_Probability: Math.round((score / 22) * 100),
      SA_Segment: segment,
      SA_Solution_Interest: formData.solutionInterest,
      SA_Brand_Type: formData.brandType,
      SA_Pain_Points: [
        ...(formData.shippingPains || []),
        ...(formData.warehousingPains || []),
      ].join(', '),
      SA_OMS: formData.oms || '',
      SA_Shopping_Cart: formData.shoppingCart || '',
      SA_Current_Shipping: formData.shippingSetup || '',
      SA_Current_Warehousing: formData.warehousingSetup || '',
      SA_Followup_Meeting_Date: formData.followupMeetingDate || null,
      SA_Pricing_Raised: formData.pricingRaisedInDemo === 'yes',
      SA_Demo_Format: formData.demoFormat || 'virtual',
      SA_F2F_Count: 0,
      SA_Logged: true,
      Demo_Date: formData.demoDate || new Date().toISOString().split('T')[0],
    };

    // Step 3 — Create deal in Zoho
    const zohoResponse = await createDeal(c.env, dealPayload);
    if (!zohoResponse?.data?.[0]?.details?.id) {
      throw new Error(`Zoho deal creation failed: ${JSON.stringify(zohoResponse)}`);
    }
    const dealId = zohoResponse.data[0].details.id;

    // Step 4 — Create 7 tasks in Zoho
    const demoDate = new Date(formData.demoDate || new Date());
    const meetingDate = formData.followupMeetingDate
      ? new Date(formData.followupMeetingDate)
      : new Date(demoDate.getTime() + 7 * 86400000);

    const addDays = (date, days) => {
      const d = new Date(date.getTime() + days * 86400000);
      return d.toISOString().split('T')[0];
    };

    const tasks = [
      { Subject: 'Day 1 — Send recap email', Due_Date: addDays(demoDate, 1), Status: 'Open' },
      { Subject: 'Day 2 — Send pricing proposal', Due_Date: addDays(demoDate, 2), Status: 'Open' },
      { Subject: 'Day 3 — Send ROI value email', Due_Date: addDays(demoDate, 3), Status: 'Open' },
      { Subject: 'Day 4 — Objection email [AUTO]', Due_Date: addDays(demoDate, 4), Status: 'Open' },
      { Subject: 'Meeting — Follow-up proposal walkthrough', Due_Date: formData.followupMeetingDate || addDays(demoDate, 7), Status: 'Open' },
      { Subject: 'Meeting+3 — Post-meeting check-in [AUTO]', Due_Date: addDays(meetingDate, 3), Status: 'Open' },
      { Subject: 'Meeting+7 — Decision nudge [AUTO]', Due_Date: addDays(meetingDate, 7), Status: 'Open' },
    ];

    const taskResults = [];
    for (const task of tasks) {
      const result = await createTask(c.env, dealId, task);
      taskResults.push(result);
    }

    // Step 5 — Generate email drafts via Claude
    const drafts = await generateEmailDrafts(
      c.env,
      { ...formData, repName: user.name },
      grade,
      score
    );

    // Step 6 — Return everything to frontend
    return c.json({
      success: true,
      dealId,
      grade,
      score,
      maxScore: 22,
      probability,
      segment,
      tasksCreated: taskResults.length,
      drafts,
    });

  } catch (err) {
    console.error('Sync error:', err);
    return c.json({ error: 'Sync failed', details: err.message }, 500);
  }
});

export default sync;