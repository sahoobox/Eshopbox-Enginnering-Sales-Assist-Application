export async function getUserByEmail(db, email) {
  const result = await db.prepare(
    'SELECT * FROM users WHERE email = ? AND is_active = 1'
  ).bind(email).first();
  return result;
}

export async function getUserById(db, id) {
  const result = await db.prepare(
    'SELECT * FROM users WHERE id = ? AND is_active = 1'
  ).bind(id).first();
  return result;
}

export async function createUser(db, user) {
  await db.prepare(
    `INSERT INTO users (id, email, name, role, password_hash, invited_by, is_active)
     VALUES (?, ?, ?, ?, ?, ?, 1)`
  ).bind(
    user.id,
    user.email,
    user.name,
    user.role,
    user.password_hash,
    user.invited_by || null
  ).run();
}

export async function updateUserPassword(db, email, passwordHash) {
  await db.prepare(
    'UPDATE users SET password_hash = ? WHERE email = ?'
  ).bind(passwordHash, email).run();
}

export async function getAllUsers(db) {
  const result = await db.prepare(
    'SELECT id, email, name, role, created_at, is_active FROM users WHERE is_active = 1 ORDER BY created_at DESC'
  ).all();
  return result.results;
}

export async function deactivateUser(db, id) {
  await db.prepare(
    'UPDATE users SET is_active = 0 WHERE id = ?'
  ).bind(id).run();
}

export async function updateUserRole(db, id, role) {
  await db.prepare(
    'UPDATE users SET role = ? WHERE id = ?'
  ).bind(role, id).run();
}

export async function createInvite(db, invite) {
  await db.prepare(
    `INSERT INTO invites (id, email, role, invited_by, token, expires_at, accepted)
     VALUES (?, ?, ?, ?, ?, ?, 0)`
  ).bind(
    invite.id,
    invite.email,
    invite.role,
    invite.invited_by,
    invite.token,
    invite.expires_at
  ).run();
}

export async function getInviteByToken(db, token) {
  const result = await db.prepare(
    'SELECT * FROM invites WHERE token = ? AND accepted = 0'
  ).bind(token).first();
  return result;
}

export async function markInviteAccepted(db, token) {
  await db.prepare(
    'UPDATE invites SET accepted = 1 WHERE token = ?'
  ).bind(token).run();
}

export async function getPendingInvites(db) {
  const result = await db.prepare(
    'SELECT * FROM invites WHERE accepted = 0 ORDER BY expires_at DESC'
  ).all();
  return result.results;
}