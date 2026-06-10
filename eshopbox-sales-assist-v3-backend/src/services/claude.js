const CLAUDE_API = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-haiku-4-5-20251001';

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

function mapPains(pains, map) {
  if (!pains || !pains.length) return '';
  return pains.map(p => map[p] || p).join(', ');
}

async function callClaude(env, systemPrompt, userPrompt, maxTokens = 700) {
  const res = await fetch(CLAUDE_API, {
    method: 'POST',
    headers: {
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      temperature: 0,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  });
  if (res.status === 429) {
    const err = new Error('Claude rate limit exceeded');
    err.code = 'CLAUDE_RATE_LIMIT';
    err.status = 429;
    throw err;
  }
  if (res.status === 529) {
    const err = new Error('Claude API overloaded');
    err.code = 'CLAUDE_OVERLOADED';
    err.status = 529;
    throw err;
  }
  const data = await res.json();
  if (!data.content?.[0]?.text) throw new Error('Claude API error: ' + JSON.stringify(data));
  return data.content[0].text.trim();
}

// ─── EMAIL 1 — DAY 1 RECAP ────────────────────────────────────────────────

async function generateEmail1(env, f, repName) {
  const system = `You are writing a post-demo follow-up email on behalf of an Eshopbox sales rep. Your job is to write a single email that feels personally written for this specific prospect, not pulled from a template. The email should mirror the conversation back accurately. Rules:
- Lead with the prospect's pain, not the product
- Write in flowing prose — no bullet lists anywhere in the email
- If a transcript is provided, extract ONE specific phrase, question, or moment the prospect said that reveals something meaningful — weave it into the opening or the "What I heard" section. It should feel like you remembered it, not quoted it.
- If repNotes is provided, use them to add one extra specific or warm detail.
- If demoFormat is "inperson", open with a reference to the meeting itself.
- If painClarity is "vague" or "none", do not assert what the pain is. Use observational or probe language instead: "It sounded like..." or "One thing worth exploring..."
- Include ALL pain points provided — do not limit to 2. Prioritise the most critical ones.
- Include ALL features shown — write them as connected prose explaining their purpose.
- The follow-up meeting date should appear exactly once.
- Sign off with the rep's actual name — never "[Your name]".
- Keep the three section headers: "What we covered:", "What I heard from your side:", "Next steps:"
- FORMATTING: Opening paragraph is plain prose. Each section header is on its own line followed by a blank line. Content after each header uses "• " bullet points, one per line, each on a new line. Blank line between sections. "Next steps:" section is plain prose not bullets.
- Output the email body only. No subject line. No explanations.`;

  const transcriptSnippet = f.transcript ? f.transcript.slice(0, 2000) : '';

  const user = `Write the Day 1 recap email using this deal data:
Prospect name: ${f.contactName || f.prospectName || ''}
Brand name: ${f.brandName || ''}
Solution interest: ${f.solutionInterest || ''}
Demo format: ${f.demoFormat || ''}
Features shown in demo: ${(f.featuresShown || []).join(', ')}
Shipping pain points: ${mapPains(f.shippingPains, SHIPPING_PAINS_MAP)}
Warehousing pain points: ${mapPains(f.warehousingPains, WAREHOUSING_PAINS_MAP)}
Additional shipping pain: ${f.shippingPainOther || ''}
Additional warehousing pain: ${f.warehousingPainOther || ''}
Pain clarity: ${f.painClarity || ''}
Objection raised: ${f.objections || ''}
Competitor mentioned: ${f.competitorMentioned || ''}
Follow-up meeting date: ${f.followupMeetingDate || ''}
Rep name: ${repName}
Demo transcript (extract 1 specific phrase or signal): ${transcriptSnippet}
Rep notes: ${f.repNotes || ''}

Gold standard output example:
Hi Raj,
Really enjoyed our conversation today about Raj Brand Co.'s shipping and warehousing setup — and the specific questions you raised about carrier rate benchmarking made it clear you've thought about this carefully. Here's a quick recap while it's fresh.
What we covered: We walked through Eshopbox's on-time delivery guarantee, how the RTO Risk Score works to reduce return-driven losses before they hit your P&L, and how our multi-warehouse network gives Raj Brand Co. the pin code coverage to scale without renegotiating carrier contracts individually.
What I heard from your side: The two challenges that came through clearly were the pressure on shipping costs and the lack of a proper WMS driving too much manual effort in operations. On top of that, your key concern was direct — rates need to be at least as competitive as your existing Blue Dart and Express Bees contracts, and that's a fair bar to hold us to.
Next steps: I'll have the pricing proposal in your inbox tomorrow, built around your order volume and current setup. We're also scheduled to walk through it together on December 10, 2024 — looking forward to that.
Taufeeq`;

  const subject = `Great speaking today, ${f.contactName || f.prospectName || 'you'} — next steps`;
  const body = await callClaude(env, system, user);
  return { subject, body };
}

// ─── EMAIL 2 — DAY 3 ROI ──────────────────────────────────────────────────

async function generateEmail2(env, f, repName) {
  const system = `You are writing a Day 3 ROI value email on behalf of an Eshopbox sales rep. This email is sent after the pricing proposal. Its job is to give the prospect a business case they can share internally — not to recap the demo. Rules:
- Check dmPresent: if "champion", open with language that helps them build an internal case ("Something to take to your leadership team"). If "yes", use "share with your team".
- Speak directly to the prospect: "you unlock", not "brands like yours"
- Include ALL pain points — do not limit to 2. Prioritise the most critical in the bullets.
- Write four outcome bullets, each as a sentence with a business consequence.
- Order bullets by relevance to the top pain point.
- Do not frame outcomes as percentage commitments.
- Do not include disclaimer language.
- If transcript contains a specific business concern or metric the prospect mentioned, use it to personalise the ROI framing.
- If repNotes mention a specific decision-maker, tailor the closing sharing line.
- Close with an availability line and meeting date in one sentence.
- Sign off with the rep's name.
- FORMATTING: Opening paragraph is plain prose. "What you unlock with Eshopbox:" is on its own line followed by a blank line. Each bullet point starts on a new line with "• " prefix. One blank line between the last bullet and the closing paragraph.
- Output the email body only. No subject line. No explanations.`;

  const transcriptSnippet = f.transcript ? f.transcript.slice(0, 2000) : '';

  const user = `Write the Day 3 ROI value email using this deal data:
Prospect name: ${f.contactName || f.prospectName || ''}
Brand name: ${f.brandName || ''}
Order volume: ${f.orderVolume || ''}
Current shipping setup: ${f.shippingSetup || ''}
Current warehousing setup: ${f.warehousingSetup || ''}
Shipping pain points: ${mapPains(f.shippingPains, SHIPPING_PAINS_MAP)}
Warehousing pain points: ${mapPains(f.warehousingPains, WAREHOUSING_PAINS_MAP)}
Solution interest: ${f.solutionInterest || ''}
DM present in demo: ${f.dmPresent || ''}
Follow-up meeting date: ${f.followupMeetingDate || ''}
Rep name: ${repName}
Demo transcript: ${transcriptSnippet}
Rep notes: ${f.repNotes || ''}

Gold standard output example:
Hi Raj,
Sending this alongside the pricing — something you can share with your team as you evaluate.
What you unlock with Eshopbox: At 5,000–20,000 orders a month, running your own warehouse and carrier accounts, here's what typically shifts when you move to Eshopbox:
↓ Shipping costs come down, particularly on non-metro zones where direct carrier contracts tend to leak the most
↓ RTO drops through AI-driven return risk scoring that flags suspect orders before they ship
↑ On-time delivery improves — backed by a 95%+ SLA. If we miss it, the shipping cost is on us
↓ Ops overhead reduces significantly as manual tracking, reconciliation, and WMS dependency fall away
If anything comes up as you're reviewing internally, feel free to reply here or call me anytime. Otherwise I'll see you on December 10, 2024.
Taufeeq`;

  const subject = `Something worth sharing internally — ${f.brandName || ''}`;
  const body = await callClaude(env, system, user);
  return { subject, body };
}

// ─── EMAIL 3 — DAY 4 OBJECTION ────────────────────────────────────────────

async function generateEmail3(env, f, repName) {
  const system = `You are writing a Day 4 email on behalf of an Eshopbox sales rep. This is auto-sent. CRITICAL: First check pricingRaisedInDemo.
IF pricingRaisedInDemo is "yes":
- This is an objection handling email.
- Open with the follow-up meeting reference.
- Quote the objection verbatim: You mentioned: "[quote]"
- Lead response with the SLA guarantee as the strongest differentiator.
- If competitorMentioned is filled, offer a direct side-by-side comparison as a pre-meeting deliverable.
- Reframe from cost to value + risk.
- Close with a reply invite or specific pre-meeting offer.
IF pricingRaisedInDemo is "no":
- This is a value reinforcement email. Do NOT reference pricing or objections.
- Open with the follow-up meeting reference.
- Reinforce the strongest value point from the demo based on solutionInterest and top pain point.
- Make one concrete tangible offer.
- Close with a reply invite.
Rules for both: Write in short focused paragraphs — maximum 2 sentences each. Each paragraph separated by a blank line. No walls of text. No passive closing. Sign off with the rep's name. Output the email body only. No subject line. No explanations.`;
  const transcriptSnippet = f.transcript ? f.transcript.slice(0, 2000) : '';

  let subject;
  if (f.pricingRaisedInDemo === 'yes') {
    subject = f.competitorMentioned
      ? `On the ${f.competitorMentioned} question — ${f.brandName}`
      : `Re: Pricing proposal — one more thing, ${f.brandName}`;
  } else {
    subject = `One more thing before our call — ${f.brandName}`;
  }

  const user = `Write the Day 4 email using this deal data:
Prospect name: ${f.contactName || f.prospectName || ''}
Brand name: ${f.brandName || ''}
Pricing raised in demo: ${f.pricingRaisedInDemo || 'no'}
Objection raised: ${f.objections || ''}
Competitor mentioned: ${f.competitorMentioned || ''}
Solution interest: ${f.solutionInterest || ''}
Top pain points: ${mapPains(f.shippingPains, SHIPPING_PAINS_MAP)}, ${mapPains(f.warehousingPains, WAREHOUSING_PAINS_MAP)}
Follow-up meeting date: ${f.followupMeetingDate || ''}
Rep name: ${repName}
Demo transcript: ${transcriptSnippet}

Gold standard output example (pricing raised = yes):
Hi Raj,
One thing I wanted to address before our call on December 10. You mentioned: "Rates must match their direct Blue Dart and Express Bees contracts. Previous quote was too high." Fair bar. Here's the difference: our pricing includes a 95% on-time SLA — if we miss it, the shipping cost is on us. Your direct carrier contracts don't include that. You're comparing cost without comparing risk. On the rate itself — the only honest comparison is against your actual order mix and pin code distribution, not a benchmark. Happy to run that before December 10 so you walk into the meeting with a real number. Just reply here if you want it.
Taufeeq`;

  const body = await callClaude(env, system, user);
  return { subject, body };
}

// ─── EMAIL 4 — MEETING+7 NUDGE ────────────────────────────────────────────

async function generateEmail4(env, f, repName, grade) {
  const system = `You are writing a Meeting +7 decision nudge email on behalf of an Eshopbox sales rep. This is auto-sent 7 days after the follow-up meeting if the deal is still open. Rules:
- Open by referencing the specific follow-up meeting date.
- Use urgencyDriver to do explicit math: time to event minus onboarding time = decision window.
- State the consequence of missing the window in one concrete sentence.
- Offer a phased start specific to solutionInterest.
- For Grade A/B: make the offer directly and confidently.
- For Grade C/D: soften to "if this is still worth pursuing".
- If repNotes contain post-meeting observations, use them to add one specific personal touch.
- Close with a direct two-option question — not open-ended.
- No scarcity plays, no emotional appeals.
- Sign off with the rep's name.
- Output the email body only. No subject line. No explanations.`;

  const user = `Write the Meeting +7 decision nudge email using this deal data:
Prospect name: ${f.contactName || f.prospectName || ''}
Brand name: ${f.brandName || ''}
Follow-up meeting date: ${f.followupMeetingDate || ''}
Urgency driver: ${f.urgencyDriver || ''}
Solution interest: ${f.solutionInterest || ''}
Deal grade: ${grade}
Rep name: ${repName}
Rep notes: ${f.repNotes || ''}

Gold standard output example:
Hi Raj,
Following up on our December 10 call — wanted to reach out before the peak season window closes. Onboarding takes 2–3 weeks from sign-off to go-live. With 6 weeks to peak, the decision needs to happen in the next week to get you live in time. If you want to start smaller, we can begin with shipping and add warehousing once you're running. Same destination, smaller first step. Where do things stand — still moving forward, or has something changed internally?
Taufeeq`;

  const subject = `${f.brandName} + Eshopbox — where do things stand?`;
  const body = await callClaude(env, system, user);
  return { subject, body };
}

// ─── RE-ENGAGEMENT EMAILS ─────────────────────────────────────────────────

async function generateRE1(env, dealContext, repName) {
  const system = `You are writing a "Lead with value" re-engagement email on behalf of an Eshopbox sales rep. The deal has gone quiet for 5–10 days. Rules:
- If transcript is available, extract the prospect's top priority or concern and open with it.
- Otherwise, open with the specific top pain point from the form.
- Name the competitor and lead with the SLA guarantee as the differentiator.
- Offer something specific and tangible tied to their order volume and situation.
- Close with a specific day for a 15-minute call — not an open-ended ask.
- Keep it short — 4 sentences maximum excluding greeting and sign-off.
- Sign off with the rep's name.
- Output the email body only. No subject line. No explanations.`;

  const user = `Write the "Lead with value" re-engagement email:
Prospect name: ${dealContext.contactName || ''}
Brand name: ${dealContext.brandName || ''}
Shipping pain points: ${dealContext.painPoints || ''}
Competitor mentioned: ${dealContext.competitorMentioned || ''}
Order volume: ${dealContext.orderVolume || ''}
Days since last activity: ${dealContext.daysSinceActivity || ''}
Rep name: ${repName}
Rep notes: ${dealContext.repNotes || ''}

Gold standard:
Hi Raj,
You mentioned shipping cost as the core pressure at Raj Brand Co. One thing that changes the Blue Dart / Express Bees comparison: our pricing includes a 95% on-time SLA with a full refund if we miss. That's not standard in direct carrier contracts. Happy to put together a quick breakdown against your actual order mix and pin code distribution — gives you a real comparison number before you make a call. Does Thursday or Friday work for 15 minutes?
Taufeeq`;

  const subject = `One thing worth sharing — ${dealContext.brandName}`;
  const body = await callClaude(env, system, user);
  return { subject, body };
}

async function generateRE2(env, dealContext, repName) {
  const system = `You are writing a soft check-in re-engagement email on behalf of an Eshopbox sales rep. The deal has gone quiet and the rep doesn't know why. Goal: get any reply. Rules:
- Open with brandName and one specific pain point to show you remember.
- Give the prospect an explicit easy out — intentional and effective.
- Make a single low-friction ask: 15 minutes if still interested.
- Project calm confidence — not needy or eager.
- 3 short paragraphs maximum.
- Sign off with the rep's name.
- Output the email body only. No subject line. No explanations.`;

  const user = `Write the "Soft check-in" re-engagement email:
Prospect name: ${dealContext.contactName || ''}
Brand name: ${dealContext.brandName || ''}
Pain points: ${dealContext.painPoints || ''}
Solution interest: ${dealContext.solutionInterest || ''}
Days since last activity: ${dealContext.daysSinceActivity || ''}
Rep name: ${repName}
Rep notes: ${dealContext.repNotes || ''}

Gold standard:
Hi Raj,
We spoke a few weeks back about the shipping cost and WMS gap at Raj Brand Co. — just checking in to see where things stand. No pressure if the timing isn't right. If something's changed internally or it's just not the right moment, just let me know and I'll follow up later. If you're still looking at this, 15 minutes this week would be enough to pick up where we left off.
Taufeeq`;

  const subject = `Checking in — ${dealContext.brandName} + Eshopbox`;
  const body = await callClaude(env, system, user);
  return { subject, body };
}

async function generateRE3(env, dealContext, repName) {
  const system = `You are writing a re-engagement email using the urgency angle on behalf of an Eshopbox sales rep. The prospect mentioned a specific time-sensitive event. Rules:
- Open by referencing the urgency driver directly.
- Do the explicit math: onboarding takes 2–3 weeks from sign-off, calculate the decision window.
- State the consequence of missing the window in one concrete sentence.
- Close with a single CTA: a 15-minute call this week.
- No manufactured scarcity, no emotional appeals.
- Under 80 words excluding greeting and sign-off.
- Sign off with the rep's name.
- Output the email body only. No subject line. No explanations.`;

  const user = `Write the "Urgency angle" re-engagement email:
Prospect name: ${dealContext.contactName || ''}
Brand name: ${dealContext.brandName || ''}
Urgency driver: ${dealContext.urgencyDriver || ''}
Solution interest: ${dealContext.solutionInterest || ''}
Days since last activity: ${dealContext.daysSinceActivity || ''}
Rep name: ${repName}

Gold standard:
Hi Raj,
You mentioned peak season in 6 weeks. Onboarding takes 2–3 weeks from sign-off to go-live — which means the decision needs to happen in the next week or two to get you live before peak. If you miss that window, the earliest we can get you running is post-peak — which means another season managing it the way it's been managed. Worth a 15-minute call this week to close out any remaining questions?
Taufeeq`;

  const subject = `Time-sensitive — ${dealContext.brandName}`;
  const body = await callClaude(env, system, user);
  return { subject, body };
}

async function generateRE4(env, dealContext, repName) {
  const system = `You are writing a break-up re-engagement email on behalf of an Eshopbox sales rep. The deal has been quiet for 15+ days. Goal: get any reply by removing pressure entirely. Rules:
- Open with brandName and one specific reference from the conversation.
- Use the exact three-option structure: "which usually means one of three things:" followed by: 1. timing, 2. internal change, 3. missed the mark.
- Follow with: "Which is it? I'd rather know so I can either adjust or close this off rather than keep sending messages that aren't useful."
- Sign off with the rep's name.
- CRITICAL: Do not add anything after the closing sentence. Nothing.
- Output the email body only. No subject line. No explanations.`;

  const user = `Write the "Break-up email" re-engagement email:
Prospect name: ${dealContext.contactName || ''}
Brand name: ${dealContext.brandName || ''}
Pain points: ${dealContext.painPoints || ''}
Solution interest: ${dealContext.solutionInterest || ''}
Days since last activity: ${dealContext.daysSinceActivity || ''}
Rep name: ${repName}

Gold standard:
Hi Raj,
I've reached out a few times since our conversation about Raj Brand Co.'s shipping setup and haven't heard back — which usually means one of three things:
1. The timing isn't right
2. Something has changed internally
3. I've missed the mark on something
Which is it? I'd rather know so I can either adjust or close this off rather than keep sending messages that aren't useful.
Taufeeq`;

  const subject = `Closing the loop — ${dealContext.brandName}`;
  const body = await callClaude(env, system, user);
  return { subject, body };
}

// ─── MAIN EXPORTS ─────────────────────────────────────────────────────────

export async function generateEmailDrafts(env, formData, grade, score) {
  const repName = formData.repName || 'the Eshopbox team';

  const [email1, email2, email3, email4] = await Promise.all([
    generateEmail1(env, formData, repName),
    generateEmail2(env, formData, repName),
    generateEmail3(env, formData, repName),
    generateEmail4(env, formData, repName, grade),
  ]);

  return {
    recap: email1,
    roi: email2,
    objection: email3,
    nudge: email4,
  };
}

export async function generateDealAnalysis(env, formData, grade, score) {
  const shippingPainsLabels = mapPains(formData.shippingPains || [], SHIPPING_PAINS_MAP);
  const warehousingPainsLabels = mapPains(formData.warehousingPains || [], WAREHOUSING_PAINS_MAP);

  const system = `You are an experienced B2B sales coach analyzing a completed product demo for an Eshopbox sales rep. Based on the demo data, return a JSON object with exactly these 4 keys:
- "strengths": array of 2-3 strings — what is working in this deal that the rep should lean on
- "risks": array of 2-3 strings — biggest risks to closing and specifically how to address each one
- "nextMeeting": array of 2-3 strings — specific actions and talking points for the follow-up meeting based on this deal's data
- "repAdvice": array of 1-2 strings — one thing the rep should do differently or prepare before the next call
Be specific and actionable. Reference actual deal details. Respond with JSON only — no markdown, no code fences, no explanation.`;

  const user = `Analyze this demo and return coaching JSON:
Grade: ${grade} (${score} pts)
Pain clarity: ${formData.painClarity || 'not set'}
Engagement level: ${formData.engagementLevel || 'not set'}
DM present: ${formData.dmPresent || 'not set'}
Champion strength: ${formData.championStrength || 'not set'}
Budget signal: ${formData.budgetSignal || 'not set'}
Purchase timeline: ${formData.purchaseTimeline || 'not set'}
Next step agreed: ${formData.nextStep || 'not set'}
Demo format: ${formData.demoFormat || 'not set'}
Meeting location: ${formData.meetingLocation || 'not set'}
Brand type: ${formData.brandType || 'not set'}
Procurement involved: ${formData.procurementInvolved || 'not set'}
Solution interest: ${formData.solutionInterest || 'not set'}
Shipping pain points: ${shippingPainsLabels || 'none'}
Warehousing pain points: ${warehousingPainsLabels || 'none'}
Additional shipping pain: ${formData.shippingPainOther || 'none'}
Additional warehousing pain: ${formData.warehousingPainOther || 'none'}
Objections raised: ${formData.objections || 'none'}
Competitor mentioned: ${formData.competitorMentioned || 'none'}
Urgency driver: ${formData.urgencyDriver || 'none'}
Features shown: ${(formData.featuresShown || []).join(', ') || 'not recorded'}
Rep notes: ${formData.repNotes || 'none'}`;

  const text = await callClaude(env, system, user, 1000);
  try {
    // Strip markdown code fences if Haiku adds them
    const clean = text
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim();
    return JSON.parse(clean);
  } catch {
    console.error('generateDealAnalysis JSON parse failed. Raw text:', text?.slice(0, 200));
    return null;
  }
}

export async function generateDealSummary(env, data) {
  const shippingPains = Array.isArray(data.shippingPains)
    ? data.shippingPains.map(p => SHIPPING_PAINS_MAP[p] || p).join(', ')
    : (data.shipping_pains ? mapPains(data.shipping_pains, SHIPPING_PAINS_MAP) : '');
  const warehousingPains = Array.isArray(data.warehousingPains)
    ? data.warehousingPains.map(p => WAREHOUSING_PAINS_MAP[p] || p).join(', ')
    : (data.warehousing_pains ? mapPains(data.warehousing_pains, WAREHOUSING_PAINS_MAP) : '');
  const allPains = [shippingPains, warehousingPains].filter(Boolean).join(', ')
    || data.painPointsReadable || data.painPoints || data.SA_Pain_Points || '';

  const system = `You are a concise B2B sales intelligence assistant. Write exactly 2 sentences of plain text summarizing this deal. Sentence 1: describe the prospect company, their business type, and their core problem. Sentence 2: describe the deal status — champion/DM presence, follow-up meeting date if known, and close probability signal. Write naturally, like a briefing note a manager would skim. No bullets, no labels, no markdown, no explanation.`;

  const user = `Summarize this deal in 2 sentences:
Brand: ${data.brandName || data.brand_name || ''}
Stage: ${data.stage || ''}
Order volume: ${data.orderVolume || data.order_volume || ''}
Solution interest: ${data.solutionInterest || data.solution_interest || ''}
Pain points: ${allPains}
Objections: ${data.objections || ''}
Grade: ${data.grade || ''}
Follow-up meeting: ${data.followupMeetingDate || data.followup_meeting_date || ''}
Competitor mentioned: ${data.competitorMentioned || data.competitor_mentioned || ''}
Urgency driver: ${data.urgencyDriver || data.urgency_driver || ''}
DM present: ${data.dmPresent || data.dm_present || ''}
Champion strength: ${data.championStrength || data.champion_strength || ''}`;

  try {
    return await callClaude(env, system, user, 150);
  } catch {
    return null;
  }
}

export async function generateReengagement(env, dealContext, angle) {
  const repName = dealContext.repName || dealContext.contactName || 'the Eshopbox team';

  if (angle === 'value') return generateRE1(env, dealContext, repName);
  if (angle === 'checkin') return generateRE2(env, dealContext, repName);
  if (angle === 'urgency') return generateRE3(env, dealContext, repName);
  if (angle === 'breakup') return generateRE4(env, dealContext, repName);

  throw new Error('Invalid angle: ' + angle);
}