export async function logTimelineEvent(env, dealId, {
  eventType,
  description,
  actorName = '',
  actorEmail = '',
  metadata = {}
}) {
  try {
    await env.DB.prepare(`
      INSERT INTO deal_timeline
      (id, deal_id, event_type, description,
       actor_name, actor_email, metadata, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `).bind(
      crypto.randomUUID(),
      dealId,
      eventType,
      description,
      actorName,
      actorEmail,
      JSON.stringify(metadata)
    ).run()
  } catch (e) {
    console.error('Timeline log failed:', e.message)
    // non-blocking — never throw
  }
}
