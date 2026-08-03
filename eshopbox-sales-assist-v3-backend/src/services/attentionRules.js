const MDE_REPS = [
  'sriya.komal@eshopbox.com',
  'mriganki.srivastava@eshopbox.com',
  'shubham.kumar@eshopbox.com',
  'arihant.sharma@eshopbox.com',
]
const AE_REPS = [
  'taufeeq.ahmad@eshopbox.com',
  'afzal.maknoo@eshopbox.com',
  'jeevan.more@eshopbox.com',
]

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

  const TERMINAL_STAGES = ['Active / Won', 'Active', 'On Hold', 'Lost/Dropped', 'Won/Payment Received']
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
      flags.push({
        id: 'r1', title: 'Recap email not sent', severity: 'high', daysCount: daysAgoDemo,
        desc: `${daysAgoDemo} day${daysAgoDemo === 1 ? '' : 's'} since demo`,
      })
    }
  }

  // R2 — Day 2 pricing proposal not sent within 3 days
  if (
    !isTerminal && deal.saLogged && demoDate &&
    deal.stage === 'Demo Done'
  ) {
    if (daysAgoDemo >= 3 && deal.emailStatuses?.day2?.status !== 'sent') {
      flags.push({
        id: 'r2', title: 'Pricing proposal not sent', severity: 'high', daysCount: daysAgoDemo ?? 0,
        desc: `${daysAgoDemo ?? 0} days since demo`,
      })
    }
  }

  // R3 — Day 3 ROI email overdue 2+ days past scheduled
  if (!isTerminal && deal.saLogged && demoDate) {
    const day3 = deal.emailStatuses?.day3
    if (day3 && day3.status !== 'sent' && day3.scheduledFor) {
      const day3DaysOverdue = Math.floor((today - new Date(day3.scheduledFor)) / 86400000)
      if (day3DaysOverdue >= 2) {
        flags.push({
          id: 'r3', title: 'ROI value email not sent', severity: 'medium', daysCount: day3DaysOverdue,
          desc: `${day3DaysOverdue} days overdue`,
        })
      }
    }
  }

  // R4 — No follow-up meeting booked within 2 days of demo
  if (
    isEnterprise && !isTerminal && deal.saLogged && demoDate &&
    deal.stage === 'Demo Done'
  ) {
    if (daysAgoDemo >= 2 && !deal.followupMeetingDate) {
      flags.push({
        id: 'r4', title: 'No follow-up meeting booked', severity: 'high', daysCount: daysAgoDemo ?? 0,
        desc: `${daysAgoDemo ?? 0} days since demo, no meeting booked`,
      })
    }
  }

  // R5 — Follow-up meeting passed, stage not updated
  if (isEnterprise && !isTerminal && meetingDate) {
    if (meetingDate < today && deal.stage === 'Proposal Sent') {
      flags.push({
        id: 'r5', title: 'Follow-up meeting passed — stage not updated', severity: 'high', daysCount: daysAgoStage,
        desc: `${daysAgoStage} days since meeting passed, stage unchanged`,
      })
    }
  }

  // R6 — Stuck in same stage 7+ days
  const R6_EXCLUDED_STAGES = [
    'Upcoming Demo',
    'Account Setup in Progress',
    'Awaiting First Shipment',
    'First Shipment Done',
  ]
  if (!isTerminal && !R6_EXCLUDED_STAGES.includes(deal.stage)) {
    if (isOpen && daysAgoStage >= 7) {
      flags.push({
        id: 'r6', title: `Stuck in "${deal.stage}" for ${daysAgoStage} days`, severity: 'medium', daysCount: daysAgoStage,
        desc: `No stage movement in ${daysAgoStage} days`,
      })
    }
  }

  // R7 — Follow up Meeting Done going quiet 5+ days
  if (isEnterprise && !isTerminal) {
    if (
      deal.stage === 'Follow up Meeting Done' &&
      daysSinceActivity >= 5 && daysSinceActivity < 500
    ) {
      flags.push({
        id: 'r7', title: 'Follow-up meeting done — deal going quiet', severity: 'medium',
        daysCount: daysSinceActivity < 999 ? daysSinceActivity : daysAgoStage,
        desc: `${daysSinceActivity < 999 ? daysSinceActivity : daysAgoStage} days since last activity`,
      })
    }
  }

  // R8 — Nudge (Day 9) email sent, deal still open 1+ day
  if (!isTerminal && deal.saLogged) {
    const nudge = deal.emailStatuses?.nudge
    if (isOpen && nudge?.status === 'sent' && nudge?.sentAt) {
      const nudgeDays = Math.floor((today - new Date(nudge.sentAt)) / 86400000)
      if (nudgeDays >= 1) {
        flags.push({
          id: 'r8', title: 'Nudge email sent — no response yet', severity: 'medium', daysCount: nudgeDays,
          desc: `${nudgeDays} days since nudge email sent`,
        })
      }
    }
  }

  // R9 — Grade A deal, no in-person meeting after 5 days
  if (isEnterprise && !isTerminal && demoDate) {
    if (
      deal.grade === 'A' && daysAgoDemo >= 5 &&
      (!deal.meetings || !deal.meetings.some(m => m.venue === 'In-office' || m.venue === 'Client location'))
    ) {
      flags.push({
        id: 'r9', title: 'Grade A deal — no in-person meeting yet', severity: 'medium', daysCount: daysAgoDemo ?? 0,
        desc: `${daysAgoDemo ?? 0} days since demo, no in-person meeting`,
      })
    }
  }

  // R10 — Lost deal, no reason logged
  if (deal.stage === 'Lost/Dropped') {
    if (!deal.lostReason || deal.lostReason.trim() === '') {
      flags.push({
        id: 'r10', title: 'Lost deal — no reason logged', severity: 'medium', daysCount: daysAgoStage,
        desc: `Lost ${daysAgoStage} days ago, no reason on file`,
      })
    }
  }

  // R11 — Upcoming Demo 10+ days, no demo scheduled
  if (!deal.demoDate) {
    if (deal.stage === 'Upcoming Demo' && daysAgoStage >= 10) {
      flags.push({
        id: 'r11', title: 'Upcoming demo overdue — no demo scheduled', severity: 'high', daysCount: daysAgoStage,
        desc: `${daysAgoStage} days in Upcoming Demo, no date set`,
      })
    }
  }

  // R12 — Demo Done but form not logged in Sales Assist
  if (!isTerminal && !deal.saLogged) {
    if (deal.stage === 'Demo Done') {
      flags.push({
        id: 'r12', title: 'Demo done — form not logged in Sales Assist', severity: 'high', daysCount: daysAgoDemo ?? 0,
        desc: `${daysAgoDemo ?? 0} days since demo, not yet logged`,
      })
    }
  }

  // R13 — Account Setup in Progress 14+ days
  if (isMidMarket && !isTerminal) {
    if (deal.stage === 'Account Setup in Progress' && daysAgoStage >= 14) {
      flags.push({
        id: 'r13', title: 'Account setup taking too long', severity: 'medium', daysCount: daysAgoStage,
        desc: `${daysAgoStage} days in Account Setup in Progress`,
      })
    }
  }

  // R14 — Awaiting First Shipment 21+ days
  if (isMidMarket && !isTerminal) {
    if (deal.stage === 'Awaiting First Shipment' && daysAgoStage >= 21) {
      flags.push({
        id: 'r14', title: 'Awaiting first shipment for 21+ days', severity: 'medium', daysCount: daysAgoStage,
        desc: `${daysAgoStage} days awaiting first shipment`,
      })
    }
  }

  // R15 — First Shipment Done 14+ days, not activated
  if (isMidMarket && !isTerminal) {
    if (deal.stage === 'First Shipment Done' && daysAgoStage >= 14) {
      flags.push({
        id: 'r15', title: 'First shipment done — deal not activated yet', severity: 'medium', daysCount: daysAgoStage,
        desc: `${daysAgoStage} days since first shipment, not activated`,
      })
    }
  }

  // R16 — Deal owned by an MDE/AE rep but sitting in the wrong pipeline
  if (!isTerminal && deal.repEmail && MDE_REPS.includes(deal.repEmail) && deal.pipeline !== 'Mid-market') {
    flags.push({
      id: 'r16', title: 'Deal in wrong pipeline', severity: 'high', daysCount: daysAgoStage,
      desc: `In ${deal.stage} for ${daysAgoStage} days — rep role doesn't match pipeline`,
    })
  } else if (!isTerminal && deal.repEmail && AE_REPS.includes(deal.repEmail) && deal.pipeline !== 'Enterprise 2.0') {
    flags.push({
      id: 'r16', title: 'Deal in wrong pipeline', severity: 'high', daysCount: daysAgoStage,
      desc: `In ${deal.stage} for ${daysAgoStage} days — rep role doesn't match pipeline`,
    })
  }

  return flags
}

export function getAttentionLevel(flags) {
  if (flags.some(f => f.severity === 'high')) return 'high'
  if (flags.some(f => f.severity === 'medium')) return 'medium'
  return 'ok'
}

// ── Rule metadata — single source of truth for the Settings › Flags admin table ──
// Kept in sync by hand against the logic above; update this whenever a rule's
// condition, threshold, or exclusions change.
export const RULE_META = [
  {
    id: 'R1', title: 'Recap email not sent', severity: 'high', pipeline: 'Both',
    description: "Deal is open, demo was logged, the demo date is on/after 2026-04-15, stage is \"Demo Done,\" it's been 1+ day since the demo, and the Day 1 recap email is still a draft.",
    skipConditions: 'Terminal stage, demo not logged, no demo date, demo before 2026-04-15, stage other than Demo Done, or Day 1 email not in draft status.',
  },
  {
    id: 'R2', title: 'Pricing proposal not sent', severity: 'high', pipeline: 'Both',
    description: 'Deal is open, demo logged, stage is "Demo Done," 3+ days since demo, and the Day 2 proposal email has not been sent.',
    skipConditions: 'Terminal stage, demo not logged, no demo date, stage other than Demo Done, or Day 2 email already sent.',
  },
  {
    id: 'R3', title: 'ROI value email not sent', severity: 'medium', pipeline: 'Both',
    description: 'Deal is open, demo logged, a Day 3 email exists with a scheduled send date but has not been sent, and it is 2+ days past that scheduled date.',
    skipConditions: 'Terminal stage, demo not logged, no demo date, no Day 3 email record, Day 3 already sent, or no scheduled date set.',
  },
  {
    id: 'R4', title: 'No follow-up meeting booked', severity: 'high', pipeline: 'Enterprise',
    description: 'Enterprise deal is open, demo logged, stage is "Demo Done," 2+ days since demo, and no follow-up meeting date has been set.',
    skipConditions: 'Mid-market pipeline, terminal stage, demo not logged, no demo date, stage other than Demo Done, or a follow-up meeting date already exists.',
  },
  {
    id: 'R5', title: 'Follow-up meeting passed — stage not updated', severity: 'high', pipeline: 'Enterprise',
    description: 'Enterprise deal is open, has a follow-up meeting date that has already passed, and is still sitting in "Proposal Sent" (stage was not advanced after the meeting).',
    skipConditions: 'Mid-market pipeline, terminal stage, no meeting date set, meeting date still in the future, or stage other than Proposal Sent.',
  },
  {
    id: 'R6', title: 'Stuck in current stage for 7+ days', severity: 'medium', pipeline: 'Both',
    description: 'Deal is open and has not changed stage in 7+ days, for any stage not already covered by a more specific stage-duration rule.',
    skipConditions: 'Terminal stages, Upcoming Demo, Account Setup in Progress, Awaiting First Shipment, and First Shipment Done — these stages are excluded because R11/R13/R14/R15 already own them with their own dedicated thresholds.',
  },
  {
    id: 'R7', title: 'Follow-up meeting done — deal going quiet', severity: 'medium', pipeline: 'Enterprise',
    description: 'Enterprise deal is open, in stage "Follow up Meeting Done," with 5+ days (and fewer than 500) since the last logged activity.',
    skipConditions: 'Mid-market pipeline, terminal stage, stage other than Follow up Meeting Done, or fewer than 5 (or 500+) days since last activity.',
  },
  {
    id: 'R8', title: 'Nudge email sent — no response yet', severity: 'medium', pipeline: 'Both',
    description: 'Deal is open, demo logged, a nudge (Day 9) email was sent, and at least 1 day has passed since it was sent.',
    skipConditions: 'Terminal stage, demo not logged, no nudge email sent, or nudge sent less than 1 day ago.',
  },
  {
    id: 'R9', title: 'Grade A deal — no in-person meeting yet', severity: 'medium', pipeline: 'Enterprise',
    description: 'Enterprise deal is open, has a demo date, is graded "A," 5+ days have passed since the demo, and no in-office or client-location meeting has been logged.',
    skipConditions: 'Mid-market pipeline, terminal stage, no demo date, grade other than A, fewer than 5 days since demo, or an in-person meeting already logged.',
  },
  {
    id: 'R10', title: 'Lost deal — no reason logged', severity: 'medium', pipeline: 'Both',
    description: 'Deal stage is "Lost/Dropped" and no lost reason (or a blank one) has been recorded.',
    skipConditions: 'Only evaluated on Lost/Dropped deals; skipped if a lost reason is already on file.',
  },
  {
    id: 'R11', title: 'Upcoming demo overdue — no demo scheduled', severity: 'high', pipeline: 'Both',
    description: 'Deal has no demo date set, stage is "Upcoming Demo," and it has been 10+ days in that stage.',
    skipConditions: 'A demo date is already set, or stage other than Upcoming Demo.',
  },
  {
    id: 'R12', title: 'Demo done — form not logged in Sales Assist', severity: 'high', pipeline: 'Both',
    description: 'Deal is open, the demo form has not been logged in Sales Assist, and stage is "Demo Done."',
    skipConditions: 'Terminal stage, demo already logged, or stage other than Demo Done.',
  },
  {
    id: 'R13', title: 'Account setup taking too long', severity: 'medium', pipeline: 'Mid-market',
    description: 'Mid-market deal is open, in stage "Account Setup in Progress," for 14+ days.',
    skipConditions: 'Enterprise pipeline, terminal stage, or stage other than Account Setup in Progress.',
  },
  {
    id: 'R14', title: 'Awaiting first shipment for 21+ days', severity: 'medium', pipeline: 'Mid-market',
    description: 'Mid-market deal is open, in stage "Awaiting First Shipment," for 21+ days.',
    skipConditions: 'Enterprise pipeline, terminal stage, or stage other than Awaiting First Shipment.',
  },
  {
    id: 'R15', title: 'First shipment done — deal not activated yet', severity: 'medium', pipeline: 'Mid-market',
    description: 'Mid-market deal is open, in stage "First Shipment Done," for 14+ days (not yet moved to Active).',
    skipConditions: 'Enterprise pipeline, terminal stage, or stage other than First Shipment Done.',
  },
  {
    id: 'R16', title: 'Deal in wrong pipeline', severity: 'high', pipeline: 'Both',
    description: "Deal is open and owned by a rep on the MDE list but sitting outside the Mid-market pipeline, or owned by a rep on the AE list but sitting outside the Enterprise 2.0 pipeline.",
    skipConditions: "Terminal stage, no rep email on the deal, or the rep's list membership already matches the deal's pipeline.",
  },
]
