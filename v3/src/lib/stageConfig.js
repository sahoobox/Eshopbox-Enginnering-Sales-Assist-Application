// Stage definitions matching the existing backend Zoho stages

export const SME_STAGES = [
  'Upcoming Demo',
  'Demo Done',
  'Proposal Sent',
  'Account Setup In Progress',
  'Awaiting First Shipment',
  'First Shipment Done',
  'Active',
  'On Hold',
  'Won/Payment Received',
  'Lost/Dropped',
]

export const ENT_STAGES = [
  'Upcoming Demo',
  'Demo Done',
  'Proposal Sent',
  'Follow up Meeting Done',
  'On Hold',
  'Won/Payment Received',
  'Lost/Dropped',
]

export const TERMINAL_STAGES = ['Won/Payment Received', 'Lost/Dropped']

export const STAGE_DOT_CLASS = {
  'Upcoming Demo':              'kdot-upcoming',
  'Demo Done':                  'kdot-demo',
  'Proposal Sent':              'kdot-proposal',
  'Account Setup In Progress':  'kdot-active',
  'Awaiting First Shipment':    'kdot-active',
  'First Shipment Done':        'kdot-meeting',
  'Active':                     'kdot-won',
  'Follow up Meeting Done':     'kdot-meeting',
  'On Hold':                    'kdot-stalled',
  'Won/Payment Received':       'kdot-won',
  'Lost/Dropped':               'kdot-lost',
}

export const STAGE_PILL = {
  'Won/Payment Received': 'pill-ok',
  'Lost/Dropped':         'pill-danger',
  'On Hold':              'pill-warn',
  'Active':               'pill-ok',
}

export const ALL_PIPELINE_STAGES = [
  'Upcoming Demo',
  'Demo Done',
  'Proposal Sent',
  'Account Setup In Progress',
  'Awaiting First Shipment',
  'First Shipment Done',
  'Active',
  'Follow up Meeting Done',
  'On Hold',
  'Won/Payment Received',
  'Lost/Dropped',
]

export function getStagePill(stage) {
  return STAGE_PILL[stage] || 'pill-neutral'
}

export function stageColor(stage) {
  if (stage === 'Won/Payment Received' || stage === 'Active') return 'ok'
  if (stage === 'Lost/Dropped') return 'danger'
  if (stage === 'On Hold') return 'warn'
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
