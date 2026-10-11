import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import type { Express } from "express";
import type { EnquiryInput } from "@deetech/shared-types";
import { API_PREFIX, buildApp } from "../src/app.js";
import { loadConfig } from "../src/config.js";
import type { Mailer } from "../src/services/mailer.js";
import { headerSafe } from "../src/services/mailer.js";
import { startTestDatabase, type TestDatabase } from "./helpers/database.js";

let db: TestDatabase;
let app: Express;

/** Records what would have been sent, and can be made to fail on demand. */
class FakeMailer implements Mailer {
  readonly configured = true;
  sent: { input: EnquiryInput; id: number }[] = [];
  shouldFail = false;

  async sendEnquiryNotification(input: EnquiryInput, id: number) {
    if (this.shouldFail) return false;
    this.sent.push({ input, id });
    return true;
  }

  async verify() {
    return true;
  }
}

const mailer = new FakeMailer();

const config = loadConfig({
  NODE_ENV: "test",
  LOG_LEVEL: "silent",
  SESSION_SECRET: "test-secret-that-is-long-enough-for-the-schema",
  ENQUIRY_MAX_PER_WINDOW: "3",
  ENQUIRY_WINDOW_MINUTES: "60",
});

const valid = {
  name: "Priya Sharma",
  email: "priya@example.com",
  company: "Example Ltd",
  subject: "New marketing website",
  message:
    "We need a new marketing site with a blog and a contact form, roughly ten pages, live before the end of the quarter.",
  sourcePage: "/contact",
};

beforeAll(async () => {
  db = await startTestDatabase(55603);
  app = buildApp({ config, pool: db.pool, mailer });
}, 180_000);

afterAll(async () => {
  await db?.stop();
});

beforeEach(async () => {
  await db.reset();
  mailer.sent = [];
  mailer.shouldFail = false;
});

describe("POST /enquiries", () => {
  it("stores a valid enquiry and notifies by email", async () => {
    const res = await request(app).post(`${API_PREFIX}/enquiries`).send(valid);

    expect(res.status).toBe(201);
    expect(res.body.ok).toBe(true);

    const { rows } = await db.pool.query(
      `SELECT name, email, company, subject, source_page, status, ip_hash
         FROM contact_enquiries`,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      name: "Priya Sharma",
      email: "priya@example.com",
      company: "Example Ltd",
      source_page: "/contact",
      status: "new",
    });
    expect(mailer.sent).toHaveLength(1);
  });

  it("hashes the client IP rather than storing it", async () => {
    await request(app)
      .post(`${API_PREFIX}/enquiries`)
      .set("X-Forwarded-For", "203.0.113.42")
      .send(valid);

    const { rows } = await db.pool.query<{ ip_hash: string | null }>(
      `SELECT ip_hash FROM contact_enquiries`,
    );
    expect(rows[0]!.ip_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(rows[0]!.ip_hash).not.toContain("203.0.113");
  });

  it("rejects an invalid payload with field-level detail", async () => {
    const res = await request(app)
      .post(`${API_PREFIX}/enquiries`)
      .send({ name: "A", email: "nope", subject: "x", message: "short" });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("validation_failed");
    expect(Object.keys(res.body.error.details)).toEqual(
      expect.arrayContaining(["name", "email", "subject", "message"]),
    );

    const { rowCount } = await db.pool.query(`SELECT 1 FROM contact_enquiries`);
    expect(rowCount).toBe(0);
  });

  it("still reports success when the notification fails, because the enquiry is saved", async () => {
    mailer.shouldFail = true;

    const res = await request(app).post(`${API_PREFIX}/enquiries`).send(valid);

    expect(res.status).toBe(201);
    const { rowCount } = await db.pool.query(`SELECT 1 FROM contact_enquiries`);
    expect(rowCount).toBe(1);
  });

  it("does not echo the submitted content back", async () => {
    const res = await request(app).post(`${API_PREFIX}/enquiries`).send(valid);
    const body = JSON.stringify(res.body);
    expect(body).not.toContain("Priya");
    expect(body).not.toContain("priya@example.com");
  });
});

describe("honeypot", () => {
  it("accepts a trapped submission indistinguishably, stores it as spam, and sends nothing", async () => {
    const res = await request(app)
      .post(`${API_PREFIX}/enquiries`)
      .send({ ...valid, website: "http://spam.example.com" });

    // Identical shape to a real success, so a bot learns nothing.
    expect(res.status).toBe(201);
    expect(res.body.ok).toBe(true);

    const { rows } = await db.pool.query<{ status: string }>(
      `SELECT status FROM contact_enquiries`,
    );
    expect(rows[0]!.status).toBe("spam");
    expect(mailer.sent).toHaveLength(0);
  });

  it("treats whitespace in the honeypot as empty", async () => {
    await request(app)
      .post(`${API_PREFIX}/enquiries`)
      .send({ ...valid, website: "   " });

    const { rows } = await db.pool.query<{ status: string }>(
      `SELECT status FROM contact_enquiries`,
    );
    expect(rows[0]!.status).toBe("new");
    expect(mailer.sent).toHaveLength(1);
  });
});

describe("per-source throttling", () => {
  it("rejects a fourth enquiry from the same source inside the window", async () => {
    const ip = "198.51.100.7";
    const send = (n: number) =>
      request(app)
        .post(`${API_PREFIX}/enquiries`)
        .set("X-Forwarded-For", ip)
        .send({ ...valid, subject: `Enquiry number ${n}` });

    expect((await send(1)).status).toBe(201);
    expect((await send(2)).status).toBe(201);
    expect((await send(3)).status).toBe(201);

    const fourth = await send(4);
    expect(fourth.status).toBe(429);
    expect(fourth.body.error.code).toBe("too_many_requests");

    const { rowCount } = await db.pool.query(`SELECT 1 FROM contact_enquiries`);
    expect(rowCount).toBe(3);
  });

  it("does not throttle a different source", async () => {
    for (let n = 1; n <= 3; n++) {
      await request(app)
        .post(`${API_PREFIX}/enquiries`)
        .set("X-Forwarded-For", "198.51.100.8")
        .send({ ...valid, subject: `From A ${n}` });
    }

    const other = await request(app)
      .post(`${API_PREFIX}/enquiries`)
      .set("X-Forwarded-For", "198.51.100.9")
      .send({ ...valid, subject: "From B" });

    expect(other.status).toBe(201);
  });

  it("counts a spam submission towards the throttle", async () => {
    const ip = "198.51.100.10";
    for (let n = 1; n <= 3; n++) {
      await request(app)
        .post(`${API_PREFIX}/enquiries`)
        .set("X-Forwarded-For", ip)
        .send({ ...valid, subject: `Spam ${n}`, website: "http://spam.test" });
    }

    const res = await request(app)
      .post(`${API_PREFIX}/enquiries`)
      .set("X-Forwarded-For", ip)
      .send({ ...valid, subject: "Now a real one" });

    expect(res.status).toBe(429);
  });
});

describe("header injection", () => {
  const CRLF = "\r\n";

  it("strips CR/LF from a value used as a mail header", () => {
    expect(headerSafe(`Hello${CRLF}Bcc: attacker@example.com`)).toBe(
      "Hello Bcc: attacker@example.com",
    );
    expect(headerSafe("a\nb\rc")).not.toMatch(/[\r\n]/);
  });

  it("bounds the length, so a huge subject cannot carry a payload", () => {
    expect(headerSafe("x".repeat(500)).length).toBe(150);
    expect(headerSafe("x".repeat(500), 80).length).toBe(80);
  });

  it("accepts a submission containing newlines without the header escaping", async () => {
    const res = await request(app)
      .post(`${API_PREFIX}/enquiries`)
      .send({ ...valid, subject: `Hello${CRLF}Bcc: attacker@example.com` });

    expect(res.status).toBe(201);
    expect(mailer.sent).toHaveLength(1);
    // The raw value is stored as submitted — it is only dangerous in a
    // header, and that is where it is sanitised.
    expect(headerSafe(mailer.sent[0]!.input.subject)).not.toMatch(/[\r\n]/);
  });
});
