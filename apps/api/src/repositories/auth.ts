import type { DbPool } from "../db/pool.js";

export type AdminRole = "admin" | "editor";

export interface AdminUser {
  id: number;
  email: string;
  name: string;
  role: AdminRole;
  isActive: boolean;
}

interface AdminUserRow {
  id: number;
  email: string;
  password_hash: string;
  name: string;
  role: AdminRole;
  is_active: boolean;
}

export interface SessionRecord {
  user: AdminUser;
  expiresAt: string;
}

export class AuthRepository {
  constructor(private readonly pool: DbPool) {}

  /**
   * Looks a user up for login. Returns the password hash, so this is the one
   * method that must never have its result sent to a client.
   */
  async findForLogin(
    email: string,
  ): Promise<(AdminUser & { passwordHash: string }) | null> {
    const { rows } = await this.pool.query<AdminUserRow>(
      `SELECT * FROM admin_users WHERE lower(email) = lower($1)`,
      [email],
    );
    const row = rows[0];
    if (!row) return null;

    return {
      id: row.id,
      email: row.email,
      name: row.name,
      role: row.role,
      isActive: row.is_active,
      passwordHash: row.password_hash,
    };
  }

  async createUser(input: {
    email: string;
    passwordHash: string;
    name: string;
    role: AdminRole;
  }): Promise<AdminUser> {
    const { rows } = await this.pool.query<AdminUserRow>(
      `INSERT INTO admin_users (email, password_hash, name, role)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [input.email, input.passwordHash, input.name, input.role],
    );
    const row = rows[0]!;
    return {
      id: row.id,
      email: row.email,
      name: row.name,
      role: row.role,
      isActive: row.is_active,
    };
  }

  async countUsers(): Promise<number> {
    const { rows } = await this.pool.query<{ count: string }>(
      `SELECT count(*) AS count FROM admin_users`,
    );
    return Number(rows[0]?.count ?? 0);
  }

  async recordLoginAttempt(
    emailLower: string,
    ipHash: string | null,
    succeeded: boolean,
  ): Promise<void> {
    await this.pool.query(
      `INSERT INTO login_attempts (email_lower, ip_hash, succeeded)
       VALUES ($1, $2, $3)`,
      [emailLower, ipHash, succeeded],
    );
  }

  /**
   * Failed attempts for this email or source inside the window.
   *
   * Counting by email *and* by IP matters: by email alone, an attacker
   * spraying one password across many accounts is never throttled.
   */
  async countRecentFailures(
    emailLower: string,
    ipHash: string | null,
    windowMinutes: number,
  ): Promise<number> {
    const { rows } = await this.pool.query<{ count: string }>(
      `SELECT count(*) AS count
         FROM login_attempts
        WHERE succeeded = false
          AND created_at > now() - ($3 || ' minutes')::interval
          AND (email_lower = $1 OR ($2::text IS NOT NULL AND ip_hash = $2::text))`,
      [emailLower, ipHash, String(windowMinutes)],
    );
    return Number(rows[0]?.count ?? 0);
  }

  /** `sessionId` is already a hash of the cookie value — see services/hash.ts. */
  async createSession(input: {
    sessionId: string;
    userId: number;
    expiresAt: Date;
    ipHash: string | null;
    userAgent: string | null;
  }): Promise<void> {
    await this.pool.query(
      `INSERT INTO admin_sessions (id, user_id, expires_at, ip_hash, user_agent)
       VALUES ($1, $2, $3, $4, $5)`,
      [input.sessionId, input.userId, input.expiresAt, input.ipHash, input.userAgent],
    );
  }

  /**
   * Resolves a session to its user, in one statement.
   *
   * The expiry check and the `is_active` check are both in SQL rather than in
   * the caller, so a deactivated account cannot keep using a live session and
   * an expired session cannot be revived by a forgetful code path.
   */
  async findSession(sessionId: string): Promise<SessionRecord | null> {
    const { rows } = await this.pool.query<AdminUserRow & { expires_at: Date }>(
      `SELECT u.*, s.expires_at
         FROM admin_sessions s
         JOIN admin_users u ON u.id = s.user_id
        WHERE s.id = $1
          AND s.expires_at > now()
          AND u.is_active = true`,
      [sessionId],
    );
    const row = rows[0];
    if (!row) return null;

    return {
      user: {
        id: row.id,
        email: row.email,
        name: row.name,
        role: row.role,
        isActive: row.is_active,
      },
      expiresAt: row.expires_at.toISOString(),
    };
  }

  async touchSession(sessionId: string): Promise<void> {
    await this.pool.query(
      `UPDATE admin_sessions SET last_seen_at = now() WHERE id = $1`,
      [sessionId],
    );
  }

  async deleteSession(sessionId: string): Promise<void> {
    await this.pool.query(`DELETE FROM admin_sessions WHERE id = $1`, [sessionId]);
  }

  /** Called on password change and on logout-everywhere. */
  async deleteSessionsForUser(userId: number): Promise<void> {
    await this.pool.query(`DELETE FROM admin_sessions WHERE user_id = $1`, [userId]);
  }

  async deleteExpiredSessions(): Promise<number> {
    const result = await this.pool.query(
      `DELETE FROM admin_sessions WHERE expires_at <= now()`,
    );
    return result.rowCount ?? 0;
  }

  async markLoggedIn(userId: number): Promise<void> {
    await this.pool.query(
      `UPDATE admin_users SET last_login_at = now() WHERE id = $1`,
      [userId],
    );
  }
}
