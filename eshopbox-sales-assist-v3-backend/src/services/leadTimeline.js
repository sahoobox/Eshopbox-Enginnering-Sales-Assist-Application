export async function logLeadTimelineEvent(env, leadId, {
  eventType,
  description,
  actorName = '',
  actorEmail = '',
  metadata = {}
}) {
  try {
    const now = new Date()
    const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000)
    const created_at = ist.toISOString()
      .replace('T', ' ').slice(0, 19)

    await env.DB.prepare(`
      INSERT INTO lead_timeline
      (id, lead_id, event_type, description,
       actor_name, actor_email, metadata, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      crypto.randomUUID(),
      leadId,
      eventType,
      description,
      actorName,
      actorEmail,
      JSON.stringify(metadata),
      created_at
    ).run()
  } catch (e) {
    console.error('Lead timeline log failed:', e.message)
  }
}
