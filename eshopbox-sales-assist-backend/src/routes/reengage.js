import { Hono } from 'hono';
import { generateReengagement } from '../services/claude.js';

const reengage = new Hono();

reengage.post('/', async (c) => {
  try {
    const { dealContext, angle } = await c.req.json();

    const validAngles = ['value', 'checkin', 'urgency', 'breakup'];
    if (!validAngles.includes(angle)) {
      return c.json({ error: 'Invalid angle. Must be one of: value, checkin, urgency, breakup' }, 400);
    }

    if (!dealContext) {
      return c.json({ error: 'Deal context is required' }, 400);
    }

    const draft = await generateReengagement(c.env, dealContext, angle);

    return c.json({ success: true, draft });

  } catch (err) {
    console.error('Reengage error:', err);
    return c.json({ error: 'Failed to generate re-engagement', details: err.message }, 500);
  }
});

export default reengage;