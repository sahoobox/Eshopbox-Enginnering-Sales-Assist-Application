// Stage definitions matching the existing backend Zoho stages

export const SME_STAGES = [
  'Qualified To Buy',
  'Demo Call Scheduled',
  'Demo Done',
  'Proposal Sent',
  'Follow up Meeting Done',
  'Deal Approved',
  'Won/Payment Received',
]

export const ENT_STAGES = [
  'Qualified To Buy',
  'Demo Call Scheduled',
  'Demo Done',
  'Proposal Sent',
  'Follow up Meeting Done',
  'Deal Approved',
  'Won/Payment Received',
]

export const TERMINAL_STAGES = ['Won/Payment Received', 'Lost/Dropped']

export const STAGE_DOT_CLASS = {
  'Qualified To Buy':       'kdot-upcoming',
  'Demo Call Scheduled':    'kdot-upcoming',
  'Demo Done':              'kdot-demo',
  'Proposal Sent':          'kdot-proposal',
  'Follow up Meeting Done': 'kdot-meeting',
  'Deal Approved':          'kdot-active',
  'Won/Payment Received':   'kdot-won',
  'Lost/Dropped':           'kdot-lost',
  'Stalled':                'kdot-stalled',
  'On Hold':                'kdot-on_hold',
}

export const STAGE_PILL = {
  'Won/Payment Received':   'pill-ok',
  'Lost/Dropped':           'pill-danger',
  'Stalled':                'pill-warn',
  'On Hold':                'pill-warn',
  'Deal Approved':          'pill-ok',
}

export const ALL_PIPELINE_STAGES = [
  'Qualified To Buy',
  'Demo Call Scheduled',
  'Demo Done',
  'Proposal Sent',
  'Follow up Meeting Done',
  'Deal Approved',
  'Won/Payment Received',
  'Lost/Dropped',
  'Stalled',
  'On Hold',
]

export function getStagePill(stage) {
  return STAGE_PILL[stage] || 'pill-neutral'
}

export function stageColor(stage) {
  if (stage === 'Won/Payment Received' || stage === 'Deal Approved') return 'ok'
  if (stage === 'Lost/Dropped') return 'danger'
  if (stage === 'Stalled' || stage === 'On Hold') return 'warn'
  return 'info'
}

export function initials(name = '') {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
}

export function daysAgo(dateStr) {
  if (!dateStr) return null
  const d = new Date(dateStr)
  const diff = Math.floor((Date.now() - d.getTime()) / 86400000)
  return diff
}

export function formatDate(dateStr) {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: '2-digit' })
}
