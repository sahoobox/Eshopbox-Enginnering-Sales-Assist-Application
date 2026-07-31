export const LEAD_STATUS_STYLE = {
  'Connected':      { background: '#F0FFF4', color: '#2F9E44' },
  'Connecting':     { background: '#F0F4FF', color: '#3B5BDB' },
  'Bad Timing':     { background: '#FFF7ED', color: '#C2410C' },
  'New':            { background: 'var(--slate-bg)', color: 'var(--slate)' },
  'Pending Review': { background: 'var(--warn-bg)', color: 'var(--warn)' },
  'Converted':      { background: 'var(--purple-bg)', color: 'var(--purple)' },
  'Disqualified':   { background: 'var(--danger-bg)', color: 'var(--danger)' },
}
export function leadStatusStyle(status) {
  return LEAD_STATUS_STYLE[status] || { background: 'var(--surface-2)', color: 'var(--ink-3)' }
}

export const LEAD_SOURCE_PILL = {
  'Inbound':          'pill-green',
  'Outbound':         'pill-orange',
  'Workspace Signup': 'pill-teal',
  'Meta Ads':         'pill-indigo',
}
export function leadSourcePill(source) {
  return LEAD_SOURCE_PILL[source] || 'pill-neutral'
}

export const CONVERSION_MEDIUM_PILL = {
  'WhatsApp Messaging': 'pill-ok',
  'Phone Call':         'pill-rose',
  'Email':              'pill-indigo',
  'Workspace Signup':   'pill-teal',
  'Cal.com':            'pill-purple',
}
export function conversionMediumPill(medium) {
  return CONVERSION_MEDIUM_PILL[medium] || 'pill-neutral'
}

export const PIPELINE_PILL = {
  'Mid-market':     'pill-info',
  'Enterprise 2.0': 'pill-purple',
}
export function pipelinePillClass(pipeline) {
  return PIPELINE_PILL[pipeline] || 'pill-neutral'
}
export function pipelineLabel(pipeline) {
  return pipeline === 'Enterprise 2.0' ? 'Enterprise' : 'Mid-market'
}
