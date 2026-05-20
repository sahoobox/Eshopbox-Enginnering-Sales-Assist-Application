export const MOCK_DEALS = [
  {
    id: "deal_001",
    zohoId: "4829302910",
    prospectName: "Raj Sharma",
    prospectEmail: "raj@rajbrand.com",
    brandName: "Raj Brand Co.",
    productCategory: "Fashion & Apparel",
    orderVolume: "5,000–20,000",
    solutionInterest: "both",
    rep: "Taufeeq Ahmed",
    repInitials: "TA",
    demoDate: "2025-01-28",
    followupMeetingDate: null,
    stage: "Demo done",
    grade: "A",
    segment: "Enterprise",
    brandType: "scaling",
    dmPresent: "yes",
    procurementInvolved: "likely",
    oms: "Unicommerce",
    shoppingCart: "Shopify",
    shippingSetup: "Own carrier accounts",
    warehousingSetup: "Own warehouse (self-operated)",
    shippingPains: ["s1", "s3"],
    warehousingPains: ["w1", "w2"],
    painClarity: "clear",
    engagementLevel: "high",
    objections: "Rates must match their direct Blue Dart and Express Bees contracts. Previous Eshopbox quote was too high.",
    competitorMentioned: "Blue Dart, Express Bees",
    budgetSignal: "implied",
    purchaseTimeline: "quarter",
    championStrength: "strong",
    nextStep: "booked",
    urgencyDriver: "Peak season in 6 weeks",
    pricingRaisedInDemo: "yes",
    featuresShown: ["On-time delivery guarantee", "RTO Risk Score", "Customer portal"],
    tasks: [
      { subject: "Day 1 — Send recap email", status: "Open", dueDate: "2025-01-28", isAuto: false },
      { subject: "Day 2 — Send pricing proposal", status: "Open", dueDate: "2025-01-29", isAuto: false },
      { subject: "Day 3 — Send ROI value email", status: "Open", dueDate: "2025-01-30", isAuto: false },
      { subject: "Day 4 — Objection email [AUTO]", status: "Open", dueDate: "2025-01-31", isAuto: true },
      { subject: "Meeting — Follow-up proposal walkthrough", status: "Open", dueDate: null, isAuto: false },
      { subject: "Meeting+3 — Post-meeting check-in [AUTO]", status: "Open", dueDate: null, isAuto: true },
      { subject: "Meeting+7 — Decision nudge [AUTO]", status: "Open", dueDate: null, isAuto: true },
    ],
    lastActivity: "2025-01-28",
    lastStageChange: "2025-01-28",
    score: 15,
  },
  {
    id: "deal_002",
    zohoId: "4829302911",
    prospectName: "Aryan Kapoor",
    prospectEmail: "aryan@sheshaayurveda.com",
    brandName: "Shesha Ayurveda",
    productCategory: "Health & Wellness",
    orderVolume: "20,000–50,000",
    solutionInterest: "warehousing",
    rep: "Priya Nair",
    repInitials: "PN",
    demoDate: "2025-01-22",
    followupMeetingDate: "2025-01-28",
    stage: "Follow-up meeting done",
    grade: "B",
    segment: "Enterprise",
    brandType: "enterprise",
    dmPresent: "champion",
    procurementInvolved: "likely",
    oms: "None",
    shoppingCart: "Custom built",
    shippingSetup: "Mix of both",
    warehousingSetup: "Own warehouse (self-operated)",
    shippingPains: [],
    warehousingPains: ["w1", "w4", "w5"],
    painClarity: "clear",
    engagementLevel: "medium",
    objections: "Concerned about data migration from existing system.",
    competitorMentioned: "",
    budgetSignal: "implied",
    purchaseTimeline: "quarter",
    championStrength: "weak",
    nextStep: "booked",
    urgencyDriver: "",
    pricingRaisedInDemo: "no",
    featuresShown: ["Multi-warehouse network", "WMS / inventory visibility", "Smart order routing"],
    tasks: [
      { subject: "Day 1 — Send recap email", status: "Completed", dueDate: "2025-01-22", isAuto: false },
      { subject: "Day 2 — Send pricing proposal", status: "Completed", dueDate: "2025-01-23", isAuto: false },
      { subject: "Day 3 — Send ROI value email", status: "Completed", dueDate: "2025-01-24", isAuto: false },
      { subject: "Day 4 — Objection email [AUTO]", status: "Completed", dueDate: "2025-01-25", isAuto: true },
      { subject: "Meeting — Follow-up proposal walkthrough", status: "Completed", dueDate: "2025-01-28", isAuto: false },
      { subject: "Meeting+3 — Post-meeting check-in [AUTO]", status: "Open", dueDate: "2025-01-31", isAuto: true },
      { subject: "Meeting+7 — Decision nudge [AUTO]", status: "Open", dueDate: "2025-02-04", isAuto: true },
    ],
    lastActivity: "2025-01-22",
    lastStageChange: "2025-01-22",
    score: 10,
  },
  {
    id: "deal_003",
    zohoId: "4829302912",
    prospectName: "Meena Iyer",
    prospectEmail: "meena@hilaryrhoda.com",
    brandName: "Hilary Rhoda",
    productCategory: "Beauty & Personal Care",
    orderVolume: "1,000–5,000",
    solutionInterest: "both",
    rep: "Taufeeq Ahmed",
    repInitials: "TA",
    demoDate: "2025-01-30",
    followupMeetingDate: "2025-02-06",
    stage: "Demo done",
    grade: "A",
    segment: "SMB",
    brandType: "small",
    dmPresent: "yes",
    procurementInvolved: "no",
    oms: "None",
    shoppingCart: "Shopify",
    shippingSetup: "Aggregator (Shiprocket etc.)",
    warehousingSetup: "3PL",
    shippingPains: ["s2", "s3"],
    warehousingPains: ["w3", "w5"],
    painClarity: "clear",
    engagementLevel: "high",
    objections: "Happy with Shiprocket pricing, worried about switching costs.",
    competitorMentioned: "Shiprocket",
    budgetSignal: "confirmed",
    purchaseTimeline: "month",
    championStrength: "strong",
    nextStep: "booked",
    urgencyDriver: "Wants to go live before Valentine's Day campaign",
    pricingRaisedInDemo: "yes",
    featuresShown: ["On-time delivery guarantee", "RTO Risk Score", "Customer portal", "Returns management"],
    tasks: [
      { subject: "Day 1 — Send recap email", status: "Completed", dueDate: "2025-01-30", isAuto: false },
      { subject: "Day 2 — Send pricing proposal", status: "Open", dueDate: "2025-01-31", isAuto: false },
      { subject: "Day 3 — Send ROI value email", status: "Open", dueDate: "2025-02-01", isAuto: false },
      { subject: "Day 4 — Objection email [AUTO]", status: "Open", dueDate: "2025-02-02", isAuto: true },
      { subject: "Meeting — Follow-up proposal walkthrough", status: "Open", dueDate: "2025-02-06", isAuto: false },
      { subject: "Meeting+3 — Post-meeting check-in [AUTO]", status: "Open", dueDate: "2025-02-09", isAuto: true },
      { subject: "Meeting+7 — Decision nudge [AUTO]", status: "Open", dueDate: "2025-02-13", isAuto: true },
    ],
    lastActivity: "2025-01-30",
    lastStageChange: "2025-01-30",
    score: 17,
  },
  {
    id: "deal_004",
    zohoId: "4829302913",
    prospectName: "Vikram Sundar",
    prospectEmail: "vikram@navvyad.com",
    brandName: "Navvyad (Sunmoon Organics)",
    productCategory: "Food & Beverages",
    orderVolume: "Below 1,000",
    solutionInterest: "warehousing",
    rep: "Rahul Mehta",
    repInitials: "RM",
    demoDate: "2025-01-20",
    followupMeetingDate: "2025-01-25",
    stage: "Commercial negotiation",
    grade: "C",
    segment: "SMB",
    brandType: "small",
    dmPresent: "yes",
    procurementInvolved: "no",
    oms: "None",
    shoppingCart: "Shopify",
    shippingSetup: "Aggregator (Shiprocket etc.)",
    warehousingSetup: "Own warehouse (self-operated)",
    shippingPains: [],
    warehousingPains: ["w1", "w2"],
    painClarity: "vague",
    engagementLevel: "medium",
    objections: "Warehousing cost must be ≤₹12/unit. Low margin business.",
    competitorMentioned: "Shiprocket",
    budgetSignal: "confirmed",
    purchaseTimeline: "month",
    championStrength: "none",
    nextStep: "vague",
    urgencyDriver: "",
    pricingRaisedInDemo: "yes",
    featuresShown: ["Multi-warehouse network", "WMS / inventory visibility"],
    tasks: [
      { subject: "Day 1 — Send recap email", status: "Completed", dueDate: "2025-01-20", isAuto: false },
      { subject: "Day 2 — Send pricing proposal", status: "Completed", dueDate: "2025-01-21", isAuto: false },
      { subject: "Day 3 — Send ROI value email", status: "Completed", dueDate: "2025-01-22", isAuto: false },
      { subject: "Day 4 — Objection email [AUTO]", status: "Completed", dueDate: "2025-01-23", isAuto: true },
      { subject: "Meeting — Follow-up proposal walkthrough", status: "Completed", dueDate: "2025-01-25", isAuto: false },
      { subject: "Meeting+3 — Post-meeting check-in [AUTO]", status: "Completed", dueDate: "2025-01-28", isAuto: true },
      { subject: "Meeting+7 — Decision nudge [AUTO]", status: "Open", dueDate: "2025-02-01", isAuto: true },
    ],
    lastActivity: "2025-01-25",
    lastStageChange: "2025-01-25",
    score: 8,
  },
  {
    id: "deal_005",
    zohoId: "4829302914",
    prospectName: "Deepa Krishnan",
    prospectEmail: "deepa@zestfashions.com",
    brandName: "Zest Fashions",
    productCategory: "Fashion & Apparel",
    orderVolume: "5,000–20,000",
    solutionInterest: "shipping",
    rep: "Rahul Mehta",
    repInitials: "RM",
    demoDate: "2025-01-25",
    followupMeetingDate: "2025-02-03",
    stage: "Proposal sent",
    grade: "B",
    segment: "SMB",
    brandType: "scaling",
    dmPresent: "yes",
    procurementInvolved: "no",
    oms: "Easyecom",
    shoppingCart: "WooCommerce",
    shippingSetup: "Aggregator (Shiprocket etc.)",
    warehousingSetup: "3PL",
    shippingPains: ["s1", "s2", "s4"],
    warehousingPains: [],
    painClarity: "clear",
    engagementLevel: "high",
    objections: "Worried about transition period and carrier continuity.",
    competitorMentioned: "Delhivery",
    budgetSignal: "implied",
    purchaseTimeline: "quarter",
    championStrength: "weak",
    nextStep: "booked",
    urgencyDriver: "",
    pricingRaisedInDemo: "no",
    featuresShown: ["On-time delivery guarantee", "Multi-warehouse network", "Smart order routing"],
    tasks: [
      { subject: "Day 1 — Send recap email", status: "Completed", dueDate: "2025-01-25", isAuto: false },
      { subject: "Day 2 — Send pricing proposal", status: "Completed", dueDate: "2025-01-26", isAuto: false },
      { subject: "Day 3 — Send ROI value email", status: "Open", dueDate: "2025-01-27", isAuto: false },
      { subject: "Day 4 — Objection email [AUTO]", status: "Open", dueDate: "2025-01-28", isAuto: true },
      { subject: "Meeting — Follow-up proposal walkthrough", status: "Open", dueDate: "2025-02-03", isAuto: false },
      { subject: "Meeting+3 — Post-meeting check-in [AUTO]", status: "Open", dueDate: "2025-02-06", isAuto: true },
      { subject: "Meeting+7 — Decision nudge [AUTO]", status: "Open", dueDate: "2025-02-10", isAuto: true },
    ],
    lastActivity: "2025-01-26",
    lastStageChange: "2025-01-26",
    score: 12,
  },
];

const TODAY = new Date("2025-02-01");

function daysDiff(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return Math.floor((TODAY - d) / (1000 * 60 * 60 * 24));
}

function getTask(deal, subjectPrefix) {
  return deal.tasks.find(t => t.subject.startsWith(subjectPrefix));
}

export function computeAttention(deal) {
  const flags = [];

  // Rule 1: Recap email not sent within 24hrs
  const recapTask = getTask(deal, "Day 1");
  if (recapTask && recapTask.status === "Open") {
    const overdue = daysDiff(recapTask.dueDate);
    if (overdue !== null && overdue >= 1) {
      flags.push({
        severity: "high",
        title: "Recap email not sent",
        desc: `Day 1 task overdue by ${overdue} day${overdue > 1 ? "s" : ""}. Prospect is waiting for a follow-up.`,
      });
    }
  }

  // Rule 2: Pricing proposal not sent within 3 days of demo
  const proposalTask = getTask(deal, "Day 2");
  if (proposalTask && proposalTask.status === "Open") {
    const demoDays = daysDiff(deal.demoDate);
    if (demoDays !== null && demoDays >= 3) {
      flags.push({
        severity: "high",
        title: "Pricing proposal not sent",
        desc: `Demo was ${demoDays} days ago. Proposal should have gone out on Day 2.`,
      });
    }
  }

  // Rule 3: ROI email not sent (2+ days overdue)
  const roiTask = getTask(deal, "Day 3");
  if (roiTask && roiTask.status === "Open" && roiTask.dueDate) {
    const overdue = daysDiff(roiTask.dueDate);
    if (overdue !== null && overdue >= 2) {
      flags.push({
        severity: "medium",
        title: "ROI email not sent",
        desc: `Day 3 task is ${overdue} day${overdue > 1 ? "s" : ""} overdue.`,
      });
    }
  }

  // Rule 4: No follow-up meeting booked
  if (!deal.followupMeetingDate) {
    const demoDays = daysDiff(deal.demoDate);
    if (demoDays !== null && demoDays >= 2) {
      flags.push({
        severity: "high",
        title: "No follow-up meeting booked",
        desc: "Follow-up meeting date not set. This should be locked before leaving the demo call.",
      });
    }
  }

  // Rule 5: Follow-up meeting date has passed but stage not updated
  if (deal.followupMeetingDate && deal.stage !== "Follow-up meeting done" && deal.stage !== "Commercial negotiation" && deal.stage !== "Deal won" && deal.stage !== "Deal lost") {
    const daysPast = daysDiff(deal.followupMeetingDate);
    if (daysPast !== null && daysPast > 0) {
      flags.push({
        severity: "high",
        title: "Follow-up meeting overdue",
        desc: `Meeting was scheduled ${daysPast} day${daysPast > 1 ? "s" : ""} ago but stage hasn't moved. Did the meeting happen?`,
      });
    }
  }

  // Rule 6: Deal stuck in same stage 7+ days
  const stuckDays = daysDiff(deal.lastStageChange);
  if (stuckDays !== null && stuckDays >= 7 && !["Deal won", "Deal lost"].includes(deal.stage)) {
    flags.push({
      severity: "medium",
      title: "Deal stuck in stage",
      desc: `Stage unchanged for ${stuckDays} days. No forward movement detected.`,
    });
  }

  // Rule 7: Negotiation stalling 5+ days
  if (deal.stage === "Commercial negotiation") {
    const inactiveDays = daysDiff(deal.lastActivity);
    if (inactiveDays !== null && inactiveDays >= 5) {
      flags.push({
        severity: "medium",
        title: "Negotiation stalling",
        desc: `No activity logged in ${inactiveDays} days during commercial negotiation.`,
      });
    }
  }

  // Rule 8: Grade D still active
  if (deal.grade === "D") {
    const inactiveDays = daysDiff(deal.lastActivity);
    if (inactiveDays !== null && inactiveDays >= 5) {
      flags.push({
        severity: "info",
        title: "Grade D deal — consider closing lost",
        desc: "Weak qualification signal with no recent activity. Review and close if no path forward.",
      });
    }
  }

  // Rule 9: Decision nudge sent, no response
  const nudgeTask = getTask(deal, "Meeting+7");
  if (nudgeTask && nudgeTask.status === "Completed") {
    const daysSince = daysDiff(nudgeTask.dueDate);
    if (daysSince !== null && daysSince >= 3 && deal.stage !== "Deal won" && deal.stage !== "Deal lost") {
      flags.push({
        severity: "medium",
        title: "Decision nudge sent — no response",
        desc: `Nudge email sent ${daysSince} days ago with no stage change or activity logged.`,
      });
    }
  }

  const severityOrder = { high: 0, medium: 1, info: 2 };
  flags.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  const topSeverity = flags.length === 0 ? "ok" : flags[0].severity;
  return { flags, topSeverity };
}

export const SHIPPING_PAINS = {
  s1: "High shipping cost",
  s2: "Poor on-time delivery / SLA",
  s3: "High RTO / return rate",
  s4: "Limited carrier reach / pin code coverage",
  s5: "No shipment visibility for customers",
  s6: "No insurance / loss coverage",
};

export const WAREHOUSING_PAINS = {
  w1: "High warehousing / fulfillment cost",
  w2: "Single warehouse — slow delivery & high cost",
  w3: "Split inventory — DTC vs marketplace",
  w4: "Manual operations / no WMS",
  w5: "No real-time inventory visibility",
  w6: "Scaling to new regions",
  w7: "Returns processing & QC",
};

export const STAGE_ORDER = [
  "Demo done",
  "Proposal sent",
  "Follow-up meeting done",
  "Commercial negotiation",
  "Deal won",
  "Deal lost",
];
