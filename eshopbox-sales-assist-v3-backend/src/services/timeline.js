export async function logTimelineEvent(env, dealId, {
  eventType,
  description,
  actorName = '',
  actorEmail = '',
  metadata = {}
}) {
  try {
    const now = new Date()
    const istOffset = 5.5 * 60 * 60 * 1000
    const istTime = new Date(now.getTime() + istOffset)
    const created_at = istTime.toISOString().replace('T', ' ').slice(0, 19)
    await env.DB.prepare(`
      INSERT INTO deal_timeline
      (id, deal_id, event_type, description,
       actor_name, actor_email, metadata, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      crypto.randomUUID(),
      dealId,
      eventType,
      description,
      actorName,
      actorEmail,
      JSON.stringify(metadata),
      created_at
    ).run()
  } catch (e) {
    console.error('Timeline log failed:', e.message)
    // non-blocking — never throw
  }
}
