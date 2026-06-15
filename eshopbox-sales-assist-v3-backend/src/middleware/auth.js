import { verify } from './jwt.js';

export async function requireAuth(c, next) {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ error: 'No token provided' }, 401);
  }

  const token = authHeader.split(' ')[1];
  try {
    const payload = await verify(token, c.env.JWT_SECRET);
    const forceLogoutAfter = await c.env.TOKEN_CACHE.get('force_logout_after');
    if (forceLogoutAfter && payload.iat) {
      const issuedAt = payload.iat * 1000;
      if (issuedAt < parseInt(forceLogoutAfter)) {
        return c.json({ error: 'Session expired. Please log in again.', code: 'SESSION_INVALIDATED' }, 401);
      }
    }
    c.set('user', payload);
    await next();
  } catch {
    return c.json({ error: 'Invalid or expired token' }, 401);
  }
}

export async function requireRole(roles) {
  return async (c, next) => {
    const user = c.get('user');
    if (!user) return c.json({ error: 'Unauthorized' }, 401);
    if (!roles.includes(user.role)) {
      return c.json({ error: 'Insufficient permissions' }, 403);
    }
    await next();
  };
}