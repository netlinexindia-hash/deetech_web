import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import type { Express } from "express";
import { API_PREFIX, buildApp } from "../src/app.js";
import { loadConfig } from "../src/config.js";
import { AuthRepository } from "../src/repositories/auth.js";
import { hashPassword } from "../src/services/password.js";
import { SESSION_COOKIE } from "../src/middleware/require-auth.js";
import { startTestDatabase, type TestDatabase } from "./helpers/database.js";

/**
 * Server-side authorization for the CMS.
 *
 * The admin UI hides controls an editor may not use, but that is cosmetic —
 * anything can POST to these routes directly. These tests drive the API with
 * no UI involved, which is the only way to prove the control is real.
 */

let db: TestDatabase;
let app: Express;
let auth: AuthRepository;

const config = loadConfig({
  NODE_ENV: "test",
  LOG_LEVEL: "silent",
  SESSION_SECRET: "test-secret-that-is-long-enough-for-the-schema",
});

const PASSWORD = "a-sufficiently-long-test-password";
const ADMIN = "admin@deetechgroup.com";
const EDITOR = "editor@deetechgroup.com";

beforeAll(async () => {
  db = await startTestDatabase(55605);
  app = buildApp({ config, pool: db.pool });
  auth = new AuthRepository(db.pool);
}, 180_000);

afterAll(async () => {
  await db?.stop();
});

beforeEach(async () => {
  await db.reset();
  await db.applySeeds();
  const passwordHash = await hashPassword(PASSWORD);
  await auth.createUser({
    email: ADMIN,
    name: "An Admin",
    role: "admin",
    passwordHash,
  });
  await auth.createUser({
    email: EDITOR,
    name: "An Editor",
    role: "editor",
    passwordHash,
  });
});

async function signIn(email: string): Promise<string> {
  const res = await request(app)
    .post(`${API_PREFIX}/admin/login`)
    .send({ email, password: PASSWORD });
  expect(res.status).toBe(200);

  const raw = res.headers["set-cookie"];
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const cookie = list.find((c) => c.startsWith(`${SESSION_COOKIE}=`));
  expect(cookie).toBeDefined();
  return cookie!;
}

/** Every admin surface, so a new one cannot be added unprotected unnoticed. */
const ADMIN_ROUTES = [
  ["GET", "/admin/dashboard"],
  ["GET", "/admin/brand-options"],
  ["GET", "/admin/content/services"],
  ["GET", "/admin/content/services/1"],
  ["POST", "/admin/content/services"],
  ["PATCH", "/admin/content/services/1"],
  ["POST", "/admin/content/services/1/status"],
  ["DELETE", "/admin/content/services/1"],
  ["GET", "/admin/media"],
  ["POST", "/admin/media"],
  ["PATCH", "/admin/media/1"],
  ["DELETE", "/admin/media/1"],
  ["GET", "/admin/enquiries"],
  ["GET", "/admin/enquiries/1"],
  ["PATCH", "/admin/enquiries/1"],
  ["DELETE", "/admin/enquiries/1"],
] as const;

/** Picks the supertest method for a verb, so the call site reads cleanly. */
function verb(method: (typeof ADMIN_ROUTES)[number][0]) {
  const agent = request(app);
  return agent[method.toLowerCase() as "get"].bind(agent);
}

describe("every admin route requires a session", () => {
  it.each(ADMIN_ROUTES)("%s %s is 401 without a cookie", async (method, path) => {
    const call = verb(method);
    const res = await call(`${API_PREFIX}${path}`).send({});
    expect(res.status).toBe(401);
  });

  it.each(ADMIN_ROUTES)("%s %s is 401 with a forged cookie", async (method, path) => {
    const call = verb(method);
    const res = await call(`${API_PREFIX}${path}`)
      .set("Cookie", `${SESSION_COOKIE}=not-a-real-token`)
      .send({});
    expect(res.status).toBe(401);
  });
});

describe("an editor", () => {
  it("can read content", async () => {
    const cookie = await signIn(EDITOR);
    const res = await request(app)
      .get(`${API_PREFIX}/admin/content/services`)
      .set("Cookie", cookie);
    expect(res.status).toBe(200);
    expect(res.body.items.length).toBeGreaterThan(0);
  });

  it("can publish and unpublish", async () => {
    const cookie = await signIn(EDITOR);
    const res = await request(app)
      .post(`${API_PREFIX}/admin/content/services/1/status`)
      .set("Cookie", cookie)
      .send({ status: "draft" });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("draft");
  });

  it("can edit content", async () => {
    const cookie = await signIn(EDITOR);
    const existing = await request(app)
      .get(`${API_PREFIX}/admin/content/services/1`)
      .set("Cookie", cookie);

    const res = await request(app)
      .patch(`${API_PREFIX}/admin/content/services/1`)
      .set("Cookie", cookie)
      .send({ ...existing.body, intro: "Edited by an editor." });

    expect(res.status).toBe(200);
    expect(res.body.intro).toBe("Edited by an editor.");
  });

  it("CANNOT delete content", async () => {
    const cookie = await signIn(EDITOR);
    const res = await request(app)
      .delete(`${API_PREFIX}/admin/content/services/1`)
      .set("Cookie", cookie);

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("forbidden");

    // And the row is still there.
    const check = await db.pool.query(`SELECT 1 FROM services WHERE id = 1`);
    expect(check.rowCount).toBe(1);
  });

  it("CANNOT delete media", async () => {
    const cookie = await signIn(EDITOR);
    const res = await request(app)
      .delete(`${API_PREFIX}/admin/media/1`)
      .set("Cookie", cookie);
    expect(res.status).toBe(403);
  });

  it("CANNOT delete an enquiry", async () => {
    const cookie = await signIn(EDITOR);
    const res = await request(app)
      .delete(`${API_PREFIX}/admin/enquiries/1`)
      .set("Cookie", cookie);
    expect(res.status).toBe(403);
  });
});

describe("an admin", () => {
  it("can delete content", async () => {
    const cookie = await signIn(ADMIN);
    const res = await request(app)
      .delete(`${API_PREFIX}/admin/content/services/1`)
      .set("Cookie", cookie);

    expect(res.status).toBe(200);
    const check = await db.pool.query(`SELECT 1 FROM services WHERE id = 1`);
    expect(check.rowCount).toBe(0);
  });

  it("is refused a delete that would orphan products", async () => {
    const cookie = await signIn(ADMIN);
    // The seed links InfraShield to AnPreD, and the FK is ON DELETE RESTRICT.
    const res = await request(app)
      .delete(`${API_PREFIX}/admin/content/brands/1`)
      .set("Cookie", cookie);

    expect(res.status).toBe(400);
    expect(res.body.error.message).toMatch(/brand/i);

    const check = await db.pool.query(`SELECT 1 FROM brands WHERE id = 1`);
    expect(check.rowCount).toBe(1);
  });
});

describe("draft content stays out of the public API", () => {
  it("is invisible publicly the moment it is unpublished", async () => {
    const cookie = await signIn(EDITOR);

    const before = await request(app).get(`${API_PREFIX}/services`);
    expect(before.body.items).toHaveLength(5);

    await request(app)
      .post(`${API_PREFIX}/admin/content/services/1/status`)
      .set("Cookie", cookie)
      .send({ status: "draft" });

    const after = await request(app).get(`${API_PREFIX}/services`);
    expect(after.body.items).toHaveLength(4);

    const detail = await request(app).get(`${API_PREFIX}/services/web-development`);
    expect(detail.status).toBe(404);

    // But the editor can still see it in the CMS.
    const adminView = await request(app)
      .get(`${API_PREFIX}/admin/content/services/1`)
      .set("Cookie", cookie);
    expect(adminView.status).toBe(200);
    expect(adminView.body.status).toBe("draft");
  });
});

describe("content validation is enforced at the API, not only the form", () => {
  it("rejects a reserved slug submitted directly", async () => {
    const cookie = await signIn(EDITOR);
    const res = await request(app)
      .post(`${API_PREFIX}/admin/content/pages`)
      .set("Cookie", cookie)
      .send({ title: "Sneaky", slug: "services", body: "", status: "draft" });

    expect(res.status).toBe(400);
    expect(JSON.stringify(res.body)).toMatch(/reserved/i);
  });

  it("rejects a duplicate slug", async () => {
    const cookie = await signIn(EDITOR);
    const res = await request(app)
      .post(`${API_PREFIX}/admin/content/services`)
      .set("Cookie", cookie)
      .send({
        title: "Duplicate",
        slug: "web-development",
        summary: "A distinct summary that is long enough to pass validation.",
        intro: "",
        benefits: [],
        inclusions: [],
        status: "draft",
        sortOrder: 9,
      });

    expect(res.status).toBe(400);
    expect(res.body.error.details?.slug).toBeDefined();
  });

  it("rejects a duplicate service summary", async () => {
    // The unique index exists because the legacy site shipped one identical
    // sentence on all six service cards.
    const cookie = await signIn(EDITOR);
    const existing = await request(app)
      .get(`${API_PREFIX}/admin/content/services/1`)
      .set("Cookie", cookie);

    const res = await request(app)
      .post(`${API_PREFIX}/admin/content/services`)
      .set("Cookie", cookie)
      .send({
        title: "Copycat",
        slug: "copycat",
        summary: existing.body.summary,
        intro: "",
        benefits: [],
        inclusions: [],
        status: "draft",
        sortOrder: 9,
      });

    expect(res.status).toBe(400);
    expect(res.body.error.details?.summary).toBeDefined();
  });
});

describe("the enquiry inbox", () => {
  it("lets a signed-in user change only the status", async () => {
    const cookie = await signIn(EDITOR);

    await db.pool.query(
      `INSERT INTO contact_enquiries (name, email, subject, message)
       VALUES ('Priya', 'priya@example.com', 'Hello', 'A message body.')`,
    );

    const res = await request(app)
      .patch(`${API_PREFIX}/admin/enquiries/1`)
      .set("Cookie", cookie)
      .send({ status: "replied", message: "tampered", email: "attacker@example.com" });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("replied");
    // The content is a record of what somebody sent; it must not be editable.
    expect(res.body.message).toBe("A message body.");
    expect(res.body.email).toBe("priya@example.com");
  });

  it("rejects an unknown status", async () => {
    const cookie = await signIn(EDITOR);
    await db.pool.query(
      `INSERT INTO contact_enquiries (name, email, subject, message)
       VALUES ('Priya', 'priya@example.com', 'Hello', 'A message body.')`,
    );

    const res = await request(app)
      .patch(`${API_PREFIX}/admin/enquiries/1`)
      .set("Cookie", cookie)
      .send({ status: "archived" });

    expect(res.status).toBe(400);
  });
});
