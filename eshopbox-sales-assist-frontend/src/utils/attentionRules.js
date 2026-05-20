export function computeAttentionFlags(deal) {
  if (deal.stage === 'Won/Payment Received') return [];

  const flags = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const toDate = (str) => { if (!str) return null; const d = new Date(str); d.setHours(0,0,0,0); return d; };
  const daysDiff = (a, b) => Math.floor((b - a) / 86400000);

  const demoDate = toDate(deal.demoDate);
  const meetingDate = toDate(deal.followupMeetingDate);
  const stageChanged = toDate(deal.stageChangedOn);
  const daysAgoDemo = demoDate ? daysDiff(demoDate, today) : 0;
  const daysAgoStage = stageChanged ? daysDiff(stageChanged, today) : 0;

  const PRE_DEMO_STAGES = ["Qualified To Buy", "Demo Call Scheduled"];
  const isPreDemo = PRE_DEMO_STAGES.includes(deal.stage);
  const isOpen = !["Won/Payment Received", "Lost/Dropped"].includes(deal.stage);
  const getTask = (prefix) => deal.tasks?.find(t => t.subject.startsWith(prefix));
  const taskOverdue = (t) => t && t.status === "Open" && t.dueDate && toDate(t.dueDate) < today;
  const lastActivity = deal.activities?.length
    ? new Date(Math.max(...deal.activities.map(a => new Date(a.date))))
    : null;
  const daysSinceActivity = lastActivity ? daysDiff(lastActivity, today) : 999;

  // Rule 1 — Recap email not sent within 24hrs
  const recapTask = getTask("Day 1");
  if (!isPreDemo && recapTask && recapTask.status === "Open" && daysAgoDemo >= 1) {
    flags.push({ severity: "high", title: "Recap email not sent", desc: `Demo was ${daysAgoDemo} day${daysAgoDemo > 1 ? "s" : ""} ago. Day 1 email is overdue.`, rule: 1 });
  }

  // Rule 2 — Pricing proposal not sent within 3 days
  const proposalTask = getTask("Day 2");
  if (!isPreDemo && proposalTask && proposalTask.status === "Open" && daysAgoDemo >= 3 && deal.stage === "Demo Done") {
    flags.push({ severity: "high", title: "Pricing proposal not sent", desc: `Demo was ${daysAgoDemo} days ago. Proposal task is ${daysAgoDemo - 2} day${daysAgoDemo - 2 > 1 ? "s" : ""} overdue.`, rule: 2 });
  }

  // Rule 3 — ROI email not sent (2+ days overdue)
  const roiTask = getTask("Day 3");
  if (!isPreDemo && roiTask && taskOverdue(roiTask) && daysDiff(toDate(roiTask.dueDate), today) >= 2) {
    flags.push({ severity: "medium", title: "ROI value email not sent", desc: `Day 3 task is ${daysDiff(toDate(roiTask.dueDate), today)} days overdue.`, rule: 3 });
  }

  // Rule 4 — No follow-up meeting booked
  if (!isPreDemo && !deal.followupMeetingDate && daysAgoDemo >= 2 && isOpen) {
    flags.push({ severity: "high", title: "No follow-up meeting booked", desc: "Follow-up meeting date not set. Should have been locked before the demo ended.", rule: 4 });
  }

  // Rule 5 — Follow-up meeting date passed, stage not updated
  if (!isPreDemo && meetingDate && meetingDate < today && deal.stage === "Proposal Sent") {
    const daysOverdue = daysDiff(meetingDate, today);
    flags.push({ severity: "high", title: "Follow-up meeting overdue", desc: `Meeting was due ${daysOverdue} day${daysOverdue > 1 ? "s" : ""} ago. Stage not moved to "Follow-up meeting done".`, rule: 5 });
  }

  // Rule 6 — Stuck in stage for 7+ days
  if (isOpen && daysAgoStage >= 7) {
    flags.push({ severity: "medium", title: `Stuck in "${deal.stage}"`, desc: `No stage change in ${daysAgoStage} days.`, rule: 6 });
  }

  // Rule 7 — Deal Approved, no activity in 5+ days
  if (deal.stage === "Deal Approved" && daysSinceActivity >= 5 && daysSinceActivity < 900) {
    flags.push({ severity: "medium", title: "Deal Approved — going quiet", desc: `No activity in ${daysSinceActivity} days. Chase for final sign-off.`, rule: 7 });
  }

  // Rule 8 — Grade D deal still active
  if (!isPreDemo && deal.grade === "D" && isOpen && daysSinceActivity >= 5) {
    flags.push({ severity: "info", title: "Grade D deal — consider closing", desc: `Weak deal with no activity in ${daysSinceActivity} days. Review whether to continue pursuing.`, rule: 8 });
  }

  // Rule 9 — Decision nudge sent, no response
  const nudgeTask = getTask("Meeting+7");
  if (nudgeTask && nudgeTask.status === "Completed" && isOpen && daysSinceActivity >= 3) {
    flags.push({ severity: "medium", title: "Decision nudge sent — no response", desc: `Nudge email sent ${daysSinceActivity} days ago with no reply or stage change.`, rule: 9 });
  }

  // Rule 10 — Grade A deal, no in-person meeting after 5+ days
  if (deal.grade === "A" && isOpen && daysAgoDemo >= 5 && (!deal.f2fMeetings || deal.f2fMeetings.length === 0)) {
    flags.push({ severity: "medium", title: "No in-person meeting yet", desc: `Grade A deal · ${daysAgoDemo} days since demo · In-person meetings significantly improve close rates. Consider proposing a warehouse visit.`, rule: 10 });
  }

  // Rule 11 — Deal lost with no reason logged in Zoho
  if (deal.stage === "Lost/Dropped" && (!deal.lostReason || deal.lostReason.trim() === "")) {
    flags.push({ severity: "medium", title: "Lost deal — no reason logged", desc: "Deal marked lost in Zoho but no loss reason has been entered. Ask the rep to update this in Zoho CRM.", rule: 11 });
  }

  // Dedup — keep highest severity per rule
  const seen = new Set();
  return flags.filter(f => { if (seen.has(f.rule)) return false; seen.add(f.rule); return true; });
}

export function getAttentionLevel(flags) {
  if (flags.some(f => f.severity === "high" || f.severity === "critical")) return "high";
  return "ok";
}

export function getSequenceStatus(deal) {
  const today = new Date(); today.setHours(0,0,0,0);
  const toDate = (s) => { if (!s) return null; const d = new Date(s); d.setHours(0,0,0,0); return d; };

  return deal.tasks.map(task => {
    const isAuto = task.subject.includes("[AUTO]");
    const dueDate = toDate(task.dueDate);
    let status = "pending";
    if (task.status === "Completed") status = "done";
    else if (dueDate && dueDate < today && !isAuto) status = "overdue";
    else if (dueDate && dueDate <= today && isAuto) status = "auto-pending";
    return { ...task, computedStatus: status, isAuto };
  });
}

export function getF2FCount(deal) {
  return deal.f2fMeetings?.length || 0;
}

export function hasWarehouseVisit(deal) {
  return deal.f2fMeetings?.some(m => m.location?.toLowerCase().includes("eshopbox") || m.location?.toLowerCase().includes("warehouse")) || deal.meetingLocation === "warehouse";
}
