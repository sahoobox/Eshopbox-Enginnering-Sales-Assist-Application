export function computeAttentionFlags(deal) {
  const flags = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const toDate = (str) => {
    if (!str) return null;
    const d = new Date(str);
    d.setHours(0, 0, 0, 0);
    return d;
  };

  const daysDiff = (a, b) => Math.floor((b - a) / 86400000);

  const demoDate = toDate(deal.demoDate);
  const meetingDate = toDate(deal.followupMeetingDate);
  const stageChanged = toDate(deal.stageChangedOn);
  const daysAgoDemo = demoDate ? daysDiff(demoDate, today) : 0;
  const daysAgoStage = stageChanged ? daysDiff(stageChanged, today) : 0;

  const PRE_DEMO_STAGES = ['Qualified To Buy', 'Demo Call Scheduled'];
  const isPreDemo = PRE_DEMO_STAGES.includes(deal.stage);
  const isOpen = !['Won/Payment Received', 'Deal Approved', 'Lost/Dropped'].includes(deal.stage);
  const getTask = (prefix) => deal.tasks?.find(t => t.Subject?.startsWith(prefix) || t.subject?.startsWith(prefix));
  const taskOverdue = (t) => {
    if (!t) return false;
    const due = toDate(t.due_date || t.dueDate);
    const status = t.Status || t.status;
    return status === 'Open' && due && due < today;
  };

  const lastActivity = deal.activities?.length
    ? new Date(Math.max(...deal.activities.map(a => new Date(a.date || a.Created_Time))))
    : null;
  const daysSinceActivity = lastActivity ? daysDiff(lastActivity, today) : 999;

  // Rule 1 — Recap email not sent within 24hrs
const emailStorageDate = new Date('2026-04-15');
const demoDateObj = demoDate ? new Date(deal.demoDate) : null;
const hasEmailStorage = demoDateObj && demoDateObj >= emailStorageDate;
const day1Email = deal.emailStatuses?.day1;
if (!isPreDemo && deal.saLogged && hasEmailStorage && daysAgoDemo >= 1 && day1Email && day1Email.status === 'draft') {
  flags.push({
    severity: 'high',
    title: 'Recap email not sent',
    desc: `Demo was ${daysAgoDemo} day${daysAgoDemo > 1 ? 's' : ''} ago. Day 1 recap email is overdue.`,
    rule: 1,
  });
}

  // Rule 2 — Pricing proposal not sent within 3 days
  const proposalTask = getTask('Day 2');
  const proposalStatus = proposalTask?.Status || proposalTask?.status;
  if (!isPreDemo && proposalTask && proposalStatus === 'Open' && daysAgoDemo >= 3 && deal.stage === 'Demo Done') {
    flags.push({
      severity: 'high',
      title: 'Pricing proposal not sent',
      desc: `Demo was ${daysAgoDemo} days ago. Proposal task is ${daysAgoDemo - 2} day${daysAgoDemo - 2 > 1 ? 's' : ''} overdue.`,
      rule: 2,
    });
  }

  // Rule 3 — ROI email 2+ days overdue
const day3Email = deal.emailStatuses?.day3;
const emailStorageDateR3 = new Date('2026-04-15');
const demoDateObjR3 = demoDate ? new Date(deal.demoDate) : null;
const hasEmailStorageR3 = demoDateObjR3 && demoDateObjR3 >= emailStorageDateR3;
if (!isPreDemo && deal.saLogged && hasEmailStorageR3 && day3Email) {
  const scheduledDate = toDate(day3Email.scheduledFor);
  const daysLate = scheduledDate ? daysDiff(scheduledDate, today) : 0;
  if (day3Email.status !== 'sent' && daysLate >= 2) {
    flags.push({
      severity: 'medium',
      title: 'ROI value email not sent',
      desc: `Day 3 email is ${daysLate} days overdue.`,
      rule: 3,
    });
  }
}
  // Rule 4 — No follow-up meeting booked
  if (!isPreDemo && !deal.followupMeetingDate && daysAgoDemo >= 2 && isOpen && deal.saLogged) {
    flags.push({
      severity: 'high',
      title: 'No follow-up meeting booked',
      desc: 'Follow-up meeting date not set. Should have been locked before the demo ended.',
      rule: 4,
    });
  }

  // Rule 5 — Follow-up meeting passed, stage not updated
  if (!isPreDemo && meetingDate && meetingDate < today && deal.stage === 'Proposal Sent') {
    const daysOverdue = daysDiff(meetingDate, today);
    flags.push({
      severity: 'high',
      title: 'Follow-up meeting passed — stage not updated',
      desc: `Meeting was ${daysOverdue} day${daysOverdue > 1 ? 's' : ''} ago. Stage still shows "Proposal sent".`,
      rule: 5,
    });
  }

  // Rule 6 — Stuck in same stage 7+ days
  if (isOpen && daysAgoStage >= 7) {
    flags.push({
      severity: 'medium',
      title: `Stuck in "${deal.stage}"`,
      desc: `No stage change in ${daysAgoStage} days.`,
      rule: 6,
    });
  }

  // Rule 7 — Negotiation stalling 5+ days
if (deal.stage === 'Follow up Meeting Done' && deal.saLogged && daysSinceActivity >= 5 && daysSinceActivity < 900) {
  flags.push({
    severity: 'medium',
    title: 'Follow-up meeting done — deal going quiet',
    desc: `No activity in ${daysSinceActivity} days since follow-up meeting. Chase for a decision.`,
    rule: 7,
  });
}

  // Rule 8 — Grade D deal still active
 if (!isPreDemo && deal.grade === 'D' && isOpen && deal.saLogged && daysSinceActivity >= 5 && daysSinceActivity < 900) {
    flags.push({
      severity: 'info',
      title: 'Grade D deal — consider closing',
      desc: `Weak deal with no activity in ${daysSinceActivity} days. Review whether to continue pursuing.`,
      rule: 8,
    });
  }

  // Rule 9 — Decision nudge sent, no response
  const nudgeTask = getTask('Meeting+7');
  const nudgeStatus = nudgeTask?.Status || nudgeTask?.status;
  if (nudgeTask && nudgeStatus === 'Completed' && isOpen && daysSinceActivity >= 3) {
    flags.push({
      severity: 'medium',
      title: 'Decision nudge sent — no response',
      desc: `Nudge email sent ${daysSinceActivity} days ago with no reply or stage change.`,
      rule: 9,
    });
  }

  // Rule 10 — Grade A deal, no in-person meeting after 5 days
  if (deal.grade === 'A' && isOpen && daysAgoDemo >= 5 && (!deal.f2fMeetings || deal.f2fMeetings.length === 0)) {
    flags.push({
      severity: 'medium',
      title: 'No in-person meeting yet',
      desc: `Grade A deal · ${daysAgoDemo} days since demo · In-person meetings significantly improve close rates.`,
      rule: 10,
    });
  }

  // Rule 11 — Deal lost, no reason logged
  if (deal.stage === 'Lost/Dropped' && (!deal.lostReason || deal.lostReason.trim() === '')) {
    flags.push({
      severity: 'medium',
      title: 'Lost deal — no reason logged',
      desc: 'Deal marked lost but no loss reason entered. Ask the rep to update this in Zoho CRM.',
      rule: 11,
    });
  }

  // Dedup — keep highest severity per rule
  const seen = new Set();
  const deduped = flags.filter(f => {
    if (seen.has(f.rule)) return false;
    seen.add(f.rule);
    return true;
  });

  return deduped;
}

export function getAttentionLevel(flags) {
  if (flags.some(f => f.severity === 'high' || f.severity === 'critical')) return 'high';
  return 'ok';
}