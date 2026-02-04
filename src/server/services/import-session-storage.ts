interface ImportSession {
  id: string;
  userId: string;
  rows: Array<Record<string, unknown>>;
  createdAt: Date;
  expiresAt: Date;
}

// Simple in-memory store (can be replaced with Redis later)
const sessions = new Map<string, ImportSession>();

export function createSession(
  id: string,
  userId: string,
  rows: Array<Record<string, unknown>>,
): ImportSession {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 15 * 60 * 1000); // 15 minutes

  const session: ImportSession = {
    id,
    userId,
    rows,
    createdAt: now,
    expiresAt,
  };

  sessions.set(id, session);
  return session;
}

export function getSession(id: string): ImportSession | undefined {
  const session = sessions.get(id);

  // Check expiration
  if (session && session.expiresAt < new Date()) {
    sessions.delete(id);
    return undefined;
  }

  return session;
}

export function deleteSession(id: string): void {
  sessions.delete(id);
}

export function cleanupExpiredSessions(): void {
  const now = new Date();
  for (const [id, session] of sessions.entries()) {
    if (session.expiresAt < now) {
      sessions.delete(id);
    }
  }
}

// Clean up expired sessions every minute
setInterval(cleanupExpiredSessions, 60000);
