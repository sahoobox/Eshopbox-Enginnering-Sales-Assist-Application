export function calculateGrade(formData) {
  let score = 0;

  // Pain clarity: Clear=3, Vague=1, None=0
  if (formData.painClarity === 'clear') score += 3;
  else if (formData.painClarity === 'vague') score += 1;

  // DM present: Yes=3, Champion=1, Unknown=0
  if (formData.dmPresent === 'yes') score += 3;
  else if (formData.dmPresent === 'champion') score += 1;

  // Budget signal: Confirmed=2, Implied=1, None=0
  if (formData.budgetSignal === 'confirmed') score += 2;
  else if (formData.budgetSignal === 'implied') score += 1;

  // Timeline — matches form values exactly
  if (formData.purchaseTimeline === 'month') score += 3;
  else if (formData.purchaseTimeline === 'quarter') score += 2;
  else if (formData.purchaseTimeline === '6m') score += 1;

  // Engagement: High=2, Medium=1, Low=0
  if (formData.engagementLevel === 'high') score += 2;
  else if (formData.engagementLevel === 'medium') score += 1;

  // Brand type + procurement/champion
  if (formData.brandType === 'enterprise') {
    if (formData.championStrength === 'strong') score += 2;
    else if (formData.championStrength === 'weak') score += 1;
  } else {
    if (formData.procurementInvolved === 'no') score += 2;
    else if (formData.procurementInvolved === 'likely') score += 1;
  }

  // Next step: Booked=2, Vague=1, None=0
  if (formData.nextStep === 'booked') score += 2;
  else if (formData.nextStep === 'vague') score += 1;

  // Demo format bonus
  if (formData.demoFormat === 'inperson') {
    if (formData.meetingLocation === 'warehouse') score += 3;
    else score += 2;
  }

  // Grade thresholds — matches frontend exactly
  let grade;
  if (score >= 14) grade = 'A';
  else if (score >= 9) grade = 'B';
  else if (score >= 5) grade = 'C';
  else grade = 'D';

  const probabilities = { A: '55-70%', B: '30-50%', C: '10-25%', D: '<10%' };

  // Segment logic
  let segment;
  if (formData.brandType === 'enterprise') segment = 'Enterprise';
  else if (formData.brandType === 'scaling') segment = 'Mid-Market';
  else segment = 'SMB';

  return {
    score,
    grade,
    maxScore: 20,
    probability: probabilities[grade],
    segment,
  };
}

export function recalculateWithF2F(currentScore) {
  return currentScore;
}

export function scoreToGrade(score) {
  if (score >= 14) return 'A';
  if (score >= 9) return 'B';
  if (score >= 5) return 'C';
  return 'D';
}