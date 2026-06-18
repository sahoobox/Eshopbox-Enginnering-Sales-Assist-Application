export default function getAttentionFlags(deal) {
  const flags = []

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const demoDate = deal.demoDate ? new Date(deal.demoDate) : null
  const meetingDate = deal.followupMeetingDate ? new Date(deal.followupMeetingDate) : null
  // TODO: stageChangedOn uses Modified_Time not true stage change time — needs Stage History fix
  const stageChanged = deal.stageChangedOn ? new Date(deal.stageChangedOn) : null
  const daysAgoDemo = demoDate ? Math.floor((today - demoDate) / 86400000) : null
  const daysAgoStage = stageChanged ? Math.floor((today - stageChanged) / 86400000) : 0

  const isMidMarket = deal.pipeline === 'Mid-market'
  const isEnterprise = deal.pipeline === 'Enterprise 2.0'

  const TERMINAL_STAGES = ['Active / Won', 'On Hold', 'Lost/Dropped', 'Won/Payment Received']
  const isTerminal = TERMINAL_STAGES.includes(deal.stage)
  const isOpen = !isTerminal

  const activities = deal.activities || []
  const lastActivity = activities.length > 0
    ? Math.max(...activities.map(a => new Date(a.date || a.Created_Time || 0).getTime()))
    : null
  const daysSinceActivity = lastActivity
    ? Math.floor((today - new Date(lastActivity)) / 86400000)
    : 999

  // R1 — Recap email not sent within 24hrs of demo
  if (
    !isTerminal && deal.saLogged && demoDate &&
    demoDate >= new Date('2026-04-15') &&
    deal.stage === 'Demo Done'
  ) {
    if (daysAgoDemo >= 1 && deal.emailStatuses?.day1?.status === 'draft') {
      flags.push({ id: 'r1', title: 'Recap email not sent', severity: 'high' })
    }
  }

  // R2 — Day 2 pricing proposal not sent within 3 days
  if (
    !isTerminal && deal.saLogged && demoDate &&
    deal.stage === 'Demo Done'
  ) {
    if (daysAgoDemo >= 3 && deal.emailStatuses?.day2?.status !== 'sent') {
      flags.push({ id: 'r2', title: 'Pricing proposal not sent', severity: 'high' })
    }
  }

  // R3 — Day 3 ROI email overdue 2+ days past scheduled
  if (!isTerminal && deal.saLogged && demoDate) {
    const day3 = deal.emailStatuses?.day3
    if (
      day3 && day3.status !== 'sent' && day3.scheduledFor &&
      Math.floor((today - new Date(day3.scheduledFor)) / 86400000) >= 2
    ) {
      flags.push({ id: 'r3', title: 'ROI value email not sent', severity: 'medium' })
    }
  }

  // R4 — No follow-up meeting booked within 2 days of demo
  if (
    isEnterprise && !isTerminal && deal.saLogged && demoDate &&
    deal.stage === 'Demo Done'
  ) {
    if (daysAgoDemo >= 2 && !deal.followupMeetingDate) {
      flags.push({ id: 'r4', title: 'No follow-up meeting booked', severity: 'high' })
    }
  }

  // R5 — Follow-up meeting passed, stage not updated
  if (isEnterprise && !isTerminal && meetingDate) {
    if (meetingDate < today && deal.stage === 'Proposal Sent') {
      flags.push({ id: 'r5', title: 'Follow-up meeting passed — stage not updated', severity: 'high' })
    }
  }

  // R6 — Stuck in same stage 7+ days
  if (!isTerminal && deal.stage !== 'Upcoming Demo') {
    if (isOpen && daysAgoStage >= 7) {
      flags.push({ id: 'r6', title: `Stuck in "${deal.stage}" for ${daysAgoStage} days`, severity: 'medium' })
    }
  }

  // R7 — Follow up Meeting Done going quiet 5+ days
  if (isEnterprise && !isTerminal) {
    if (
      deal.stage === 'Follow up Meeting Done' &&
      daysSinceActivity >= 5 && daysSinceActivity < 500
    ) {
      flags.push({ id: 'r7', title: 'Follow-up meeting done — deal going quiet', severity: 'medium' })
    }
  }

  // R8 — Nudge (Day 9) email sent, deal still open 1+ day
  if (!isTerminal && deal.saLogged) {
    const nudge = deal.emailStatuses?.nudge
    if (
      isOpen && nudge?.status === 'sent' && nudge?.sentAt &&
      Math.floor((today - new Date(nudge.sentAt)) / 86400000) >= 1
    ) {
      flags.push({ id: 'r8', title: 'Nudge email sent — no response yet', severity: 'medium' })
    }
  }

  // R9 — Grade A deal, no in-person meeting after 5 days
  if (isEnterprise && !isTerminal && demoDate) {
    if (
      deal.grade === 'A' && daysAgoDemo >= 5 &&
      (!deal.meetings || !deal.meetings.some(m => m.venue === 'In-office' || m.venue === 'Client location'))
    ) {
      flags.push({ id: 'r9', title: 'Grade A deal — no in-person meeting yet', severity: 'medium' })
    }
  }

  // R10 — Lost deal, no reason logged
  if (deal.stage === 'Lost/Dropped') {
    if (!deal.lostReason || deal.lostReason.trim() === '') {
      flags.push({ id: 'r10', title: 'Lost deal — no reason logged', severity: 'medium' })
    }
  }

  // R11 — Upcoming Demo 10+ days, no demo scheduled
  if (!deal.demoDate) {
    if (deal.stage === 'Upcoming Demo' && daysAgoStage >= 10) {
      flags.push({ id: 'r11', title: 'Upcoming demo overdue — no demo scheduled', severity: 'high' })
    }
  }

  // R12 — Demo Done but form not logged in Sales Assist
  if (!isTerminal && !deal.saLogged) {
    if (deal.stage === 'Demo Done') {
      flags.push({ id: 'r12', title: 'Demo done — form not logged in Sales Assist', severity: 'high' })
    }
  }

  // R13 — Account Setup in Progress 14+ days
  if (isMidMarket && !isTerminal) {
    if (deal.stage === 'Account Setup in Progress' && daysAgoStage >= 14) {
      flags.push({ id: 'r13', title: 'Account setup taking too long', severity: 'medium' })
    }
  }

  // R14 — Awaiting First Shipment 21+ days
  if (isMidMarket && !isTerminal) {
    if (deal.stage === 'Awaiting First Shipment' && daysAgoStage >= 21) {
      flags.push({ id: 'r14', title: 'Awaiting first shipment for 21+ days', severity: 'medium' })
    }
  }

  // R15 — First Shipment Done 14+ days, not activated
  if (isMidMarket && !isTerminal) {
    if (deal.stage === 'First Shipment Done' && daysAgoStage >= 14) {
      flags.push({ id: 'r15', title: 'First shipment done — deal not activated yet', severity: 'medium' })
    }
  }

  return flags
}

export function getAttentionLevel(flags) {
  if (flags.some(f => f.severity === 'high')) return 'high'
  if (flags.some(f => f.severity === 'medium')) return 'medium'
  return 'ok'
}
