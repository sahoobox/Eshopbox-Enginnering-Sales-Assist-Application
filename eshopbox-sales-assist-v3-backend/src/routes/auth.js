import { Hono } from 'hono';
import { sign } from '../middleware/jwt.js';
import {
  getUserByEmail,
  createUser,
  createInvite,
  getInviteByToken,
  markInviteAccepted,
  getAllUsers,
  deactivateUser,
  updateUserRole,
  getPendingInvites,
} from '../db/users.js';

const auth = new Hono();

// Simple bcrypt-like password hashing using Web Crypto
async function hashPassword(password) {
  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey(
    'raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    keyMaterial, 256
  );
  const hashArray = Array.from(new Uint8Array(bits));
  const saltArray = Array.from(salt);
  return JSON.stringify({ salt: saltArray, hash: hashArray });
}

async function verifyPassword(password, stored) {
  const encoder = new TextEncoder();
  const { salt, hash } = JSON.parse(stored);
  const keyMaterial = await crypto.subtle.importKey(
    'raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: new Uint8Array(salt), iterations: 100000, hash: 'SHA-256' },
    keyMaterial, 256
  );
  const newHash = Array.from(new Uint8Array(bits));
  return JSON.stringify(newHash) === JSON.stringify(hash);
}

function generateId() {
  return crypto.randomUUID();
}

// POST /auth/login
auth.post('/login', async (c) => {
  try {
    const { email, password } = await c.req.json();

    if (!email || !password) {
      return c.json({ error: 'Email and password required' }, 400);
    }

    if (!email.endsWith('@eshopbox.com')) {
      return c.json({ error: 'Access restricted to @eshopbox.com accounts' }, 403);
    }

    const user = await getUserByEmail(c.env.DB, email);
    if (!user) {
      return c.json({ error: 'Invalid email or password' }, 401);
    }

    if (!user.password_hash) {
      return c.json({ error: 'Account not activated. Check your invite email.' }, 401);
    }

    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) {
      return c.json({ error: 'Invalid email or password' }, 401);
    }

    const token = await sign(
      { id: user.id, email: user.email, name: user.name, role: user.role },
      c.env.JWT_SECRET
    );

    return c.json({
      token,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    });
  } catch (err) {
    return c.json({ error: 'Login failed', details: err.message }, 500);
  }
});

// POST /auth/invite — admin sends invite (protected, called from Settings page)
auth.post('/invite', async (c) => {
  try {
    const user = c.get('user');
    if (user?.role !== 'Admin') {
      return c.json({ error: 'Only admins can invite team members' }, 403);
    }

    const { email, role, name } = await c.req.json();

    if (!email.endsWith('@eshopbox.com')) {
      return c.json({ error: 'Only @eshopbox.com emails can be invited' }, 400);
    }

    const existing = await getUserByEmail(c.env.DB, email);
    if (existing) {
      return c.json({ error: 'User already exists' }, 400);
    }

    const token = generateId();
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    await createInvite(c.env.DB, {
      id: generateId(),
      email,
      role: role || 'Sales rep',
      invited_by: user.email,
      token,
      expires_at: expiresAt,
    });

    // TODO: Send invite email via Zoho SMTP when credentials are available
    // For now return the invite link so admin can share manually
    const inviteLink = `${c.env.FRONTEND_URL}/accept-invite?token=${token}`;

    return c.json({
      success: true,
      message: `Invite created for ${email}`,
      inviteLink,
    });
  } catch (err) {
    return c.json({ error: 'Failed to create invite', details: err.message }, 500);
  }
});

// POST /auth/accept-invite — new member sets password
auth.post('/accept-invite', async (c) => {
  try {
    const { token, password, name } = await c.req.json();

    if (!token || !password || !name) {
      return c.json({ error: 'Token, name and password required' }, 400);
    }

    if (password.length < 8) {
      return c.json({ error: 'Password must be at least 8 characters' }, 400);
    }

    const invite = await getInviteByToken(c.env.DB, token);
    if (!invite) {
      return c.json({ error: 'Invalid or expired invite link' }, 400);
    }

    if (new Date(invite.expires_at) < new Date()) {
      return c.json({ error: 'Invite link has expired. Ask admin to resend.' }, 400);
    }

    const passwordHash = await hashPassword(password);

    await createUser(c.env.DB, {
      id: generateId(),
      email: invite.email,
      name,
      role: invite.role,
      password_hash: passwordHash,
      invited_by: invite.invited_by,
    });

    await markInviteAccepted(c.env.DB, token);

    const user = await getUserByEmail(c.env.DB, invite.email);
    const jwtToken = await sign(
      { id: user.id, email: user.email, name: user.name, role: user.role },
      c.env.JWT_SECRET
    );

    return c.json({
      success: true,
      token: jwtToken,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    });
  } catch (err) {
    return c.json({ error: 'Failed to accept invite', details: err.message }, 500);
  }
});

// GET /auth/team — get all team members (admin only)
auth.get('/team', async (c) => {
  try {
    const user = c.get('user');
    if (!['Admin', 'Manager'].includes(user?.role)) {
      return c.json({ error: 'Insufficient permissions' }, 403);
    }
    const users = await getAllUsers(c.env.DB);
    const invites = await getPendingInvites(c.env.DB);
    return c.json({ users, pendingInvites: invites });
  } catch (err) {
    return c.json({ error: 'Failed to fetch team', details: err.message }, 500);
  }
});

// PUT /auth/team/:id/role — change role (admin only)
auth.put('/team/:id/role', async (c) => {
  try {
    const user = c.get('user');
    if (user?.role !== 'Admin') {
      return c.json({ error: 'Only admins can change roles' }, 403);
    }
    const { role } = await c.req.json();
    const validRoles = ['Admin', 'Manager', 'Sales rep'];
    if (!validRoles.includes(role)) {
      return c.json({ error: 'Invalid role' }, 400);
    }
    await updateUserRole(c.env.DB, c.req.param('id'), role);
    return c.json({ success: true });
  } catch (err) {
    return c.json({ error: 'Failed to update role', details: err.message }, 500);
  }
});

// DELETE /auth/team/:id — remove member (admin only)
auth.delete('/team/:id', async (c) => {
  try {
    const user = c.get('user');
    if (user?.role !== 'Admin') {
      return c.json({ error: 'Only admins can remove members' }, 403);
    }
    await deactivateUser(c.env.DB, c.req.param('id'));
    return c.json({ success: true });
  } catch (err) {
    return c.json({ error: 'Failed to remove member', details: err.message }, 500);
  }
});

export default auth;