import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import type { Express } from "express";
import { API_PREFIX, buildApp } from "../src/app.js";
import { loadConfig } from "../src/config.js";
import { AuthRepository } from "../src/repositories/auth.js";
import { hashPassword } from "../src/services/password.js";
import { SESSION_COOKIE } from "../src/middleware/require-auth.js";
import { startTestDatabase, type TestDatabase } from "./helpers/database.js";

let db: TestDatabase;
let app: Express;
let auth: AuthRepository;

const SECRET = "test-secret-that-is-long-enough-for-the-schema";
const config = loadConfig({
  NODE_ENV: "test",
  LOG_LEVEL: "silent",
  SESSION_SECRET: SECRET,
  SESSION_TTL_HOURS: "12",
});

const EMAIL = "admin@deetechgroup.com";
const PASSWORD = "a-sufficiently-long-test-password";

beforeAll(async () => {
  db = await startTestDatabase(55604);
  app = buildApp({ config, pool: db.pool });
  auth = new AuthRepository(db.pool);
}, 180_000);

afterAll(async () => {
  await db?.stop();
});

beforeEach(async () => {
  await db.reset();
  await auth.createUser({
    email: EMAIL,
    name: "Test Admin",
    role: "admin",
    passwordHash: await hashPassword(PASSWORD),
  });
});

function sessionCookie(res: request.Response): string | undefined {
  const raw = res.headers["set-cookie"];
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return list.find((c) => c.startsWith(`${SESSION_COOKIE}=`));
}

async function signIn(): Promise<string> {
  const res = await request(app)
    .post(`${API_PREFIX}/admin/login`)
    .send({ email: EMAIL, password: PASSWORD });
  expect(res.status).toBe(200);
  const cookie = sessionCookie(res);
  expect(cookie).toBeDefined();
  return cookie!;
}

describe("POST /admin/login", () => {
  it("signs in with correct details and sets a hardened cookie", async () => {
    const res = await request(app)
      .post(`${API_PREFIX}/admin/login`)
      .send({ email: EMAIL, password: PASSWORD });

    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({
      email: EMAIL,
      name: "Test Admin",
      role: "admin",
    });
    // The hash must never be in a response.
    expect(JSON.stringify(res.body)).not.toContain("argon2");

    const cookie = sessionCookie(res)!;
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("SameSite=Strict");
    // `secure` is off outside production so local HTTP development works.
    expect(cookie).not.toContain("Secure");
  });

  it("matches the email case-insensitively", async () => {
    const res = await request(app)
      .post(`${API_PREFIX}/admin/login`)
      .send({ email: "ADMIN@DeeTechGroup.COM", password: PASSWORD });
    expect(res.status).toBe(200);
  });

  it("stores a hash of the cookie value, not the value itself", async () => {
    const cookie = await signIn();
    const token = cookie.split(";")[0]!.split("=")[1]!;

    const { rows } = await db.pool.query<{ id: string }>(
      `SELECT id FROM admin_sessions`,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]!.id).toMatch(/^[0-9a-f]{64}$/);
    expect(rows[0]!.id).not.toBe(token);
  });

  it("rejects a wrong password", async () => {
    const res = await request(app)
      .post(`${API_PREFIX}/admin/login`)
      .send({ email: EMAIL, password: "wrong-password-entirely" });

    expect(res.status).toBe(401);
    expect(sessionCookie(res)).toBeUndefined();
  });

  it("gives an unknown address the same response as a wrong password", async () => {
    const unknown = await request(app)
      .post(`${API_PREFIX}/admin/login`)
      .send({ email: "nobody@example.com", password: PASSWORD });
    const wrong = await request(app)
      .post(`${API_PREFIX}/admin/login`)
      .send({ email: EMAIL, password: "wrong-password-entirely" });

    // Identical status and message, so the response cannot be used to
    // enumerate which addresses have accounts.
    expect(unknown.status).toBe(wrong.status);
    expect(unknown.body.error.message).toBe(wrong.body.error.message);
  });

  it("refuses a deactivated account with the same message", async () => {
    await db.pool.query(`UPDATE admin_users SET is_active = false`);

    const res = await request(app)
      .post(`${API_PREFIX}/admin/login`)
      .send({ email: EMAIL, password: PASSWORD });

    expect(res.status).toBe(401);
    expect(res.body.error.message).toBe("Those sign-in details are not correct.");
  });

  it("records the attempt and stamps last_login_at on success", async () => {
    await signIn();

    const attempts = await db.pool.query<{ succeeded: boolean }>(
      `SELECT succeeded FROM login_attempts`,
    );
    expect(attempts.rows).toEqual([{ succeeded: true }]);

    const user = await db.pool.query<{ last_login_at: Date | null }>(
      `SELECT last_login_at FROM admin_users`,
    );
    expect(user.rows[0]!.last_login_at).not.toBeNull();
  });

  it("throttles after repeated failures", async () => {
    for (let i = 0; i < 8; i++) {
      const res = await request(app)
        .post(`${API_PREFIX}/admin/login`)
        .send({ email: EMAIL, password: `wrong-${i}-and-long-enough` });
      expect(res.status).toBe(401);
    }

    const blocked = await request(app)
      .post(`${API_PREFIX}/admin/login`)
      .send({ email: EMAIL, password: PASSWORD });

    // Even the correct password is refused while throttled.
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe("too_many_requests");
  });

  it("validates the payload", async () => {
    const res = await request(app)
      .post(`${API_PREFIX}/admin/login`)
      .send({ email: "not-an-email", password: "" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("validation_failed");
  });
});

describe("GET /admin/me", () => {
  it("returns the signed-in user", async () => {
    const cookie = await signIn();

    const res = await request(app).get(`${API_PREFIX}/admin/me`).set("Cookie", cookie);

    expect(res.status).toBe(200);
    expect(res.body.user).toEqual({
      id: expect.any(Number),
      email: EMAIL,
      name: "Test Admin",
      role: "admin",
    });
  });

  it("returns the same user shape as the login response", async () => {
    const login = await request(app)
      .post(`${API_PREFIX}/admin/login`)
      .send({ email: EMAIL, password: PASSWORD });
    const me = await request(app)
      .get(`${API_PREFIX}/admin/me`)
      .set("Cookie", sessionCookie(login)!);

    expect(Object.keys(me.body.user).sort()).toEqual(
      Object.keys(login.body.user).sort(),
    );
  });

  it("401s with no cookie", async () => {
    const res = await request(app).get(`${API_PREFIX}/admin/me`);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("unauthorized");
  });

  it("401s with a forged cookie", async () => {
    const res = await request(app)
      .get(`${API_PREFIX}/admin/me`)
      .set("Cookie", `${SESSION_COOKIE}=this-is-not-a-real-token`);
    expect(res.status).toBe(401);
  });

  it("401s when the session id from the database is used as the cookie", async () => {
    // The stored id is a hash of the token. Presenting the hash must not
    // work, or a database read would be enough to impersonate a user.
    await signIn();
    const { rows } = await db.pool.query<{ id: string }>(
      `SELECT id FROM admin_sessions`,
    );

    const res = await request(app)
      .get(`${API_PREFIX}/admin/me`)
      .set("Cookie", `${SESSION_COOKIE}=${rows[0]!.id}`);

    expect(res.status).toBe(401);
  });

  it("401s once the session has expired", async () => {
    const cookie = await signIn();
    await db.pool.query(
      `UPDATE admin_sessions SET expires_at = now() - interval '1 minute'`,
    );

    const res = await request(app).get(`${API_PREFIX}/admin/me`).set("Cookie", cookie);

    expect(res.status).toBe(401);
  });

  it("401s once the account is deactivated, without waiting for expiry", async () => {
    const cookie = await signIn();
    await db.pool.query(`UPDATE admin_users SET is_active = false`);

    const res = await request(app).get(`${API_PREFIX}/admin/me`).set("Cookie", cookie);

    expect(res.status).toBe(401);
  });
});

describe("POST /admin/logout", () => {
  it("deletes the session and clears the cookie", async () => {
    const cookie = await signIn();

    const res = await request(app)
      .post(`${API_PREFIX}/admin/logout`)
      .set("Cookie", cookie);

    expect(res.status).toBe(200);
    const { rowCount } = await db.pool.query(`SELECT 1 FROM admin_sessions`);
    expect(rowCount).toBe(0);

    const after = await request(app)
      .get(`${API_PREFIX}/admin/me`)
      .set("Cookie", cookie);
    expect(after.status).toBe(401);
  });

  it("succeeds without a valid session rather than erroring", async () => {
    const res = await request(app).post(`${API_PREFIX}/admin/logout`);
    expect(res.status).toBe(200);
  });
});

describe("session housekeeping", () => {
  it("deleteExpiredSessions removes only expired rows", async () => {
    await signIn();
    const user = await auth.findForLogin(EMAIL);
    await auth.createSession({
      sessionId: "expired-session-id",
      userId: user!.id,
      expiresAt: new Date(Date.now() - 1000),
      ipHash: null,
      userAgent: null,
    });

    const removed = await auth.deleteExpiredSessions();

    expect(removed).toBe(1);
    const { rowCount } = await db.pool.query(`SELECT 1 FROM admin_sessions`);
    expect(rowCount).toBe(1);
  });

  it("deleteSessionsForUser signs the user out everywhere", async () => {
    await signIn();
    await signIn();
    const user = await auth.findForLogin(EMAIL);

    await auth.deleteSessionsForUser(user!.id);

    const { rowCount } = await db.pool.query(`SELECT 1 FROM admin_sessions`);
    expect(rowCount).toBe(0);
  });
});
