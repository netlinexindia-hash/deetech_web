import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import nodemailer from "nodemailer";
import type { EnquiryInput } from "@deetech/shared-types";
import { loadConfig } from "../src/config.js";
import { createMailer, headerSafe } from "../src/services/mailer.js";

/**
 * Enquiry notification email.
 *
 * Nothing here sends mail. Nodemailer's `jsonTransport` builds the real
 * message — same envelope, same header encoding — and hands it back instead
 * of opening a connection, so the headers can be asserted exactly as a mail
 * server would receive them. That is what makes the header-injection test
 * meaningful rather than a test of my own sanitiser in isolation.
 */

const ENQUIRY: EnquiryInput = {
  name: "Priya Sharma",
  email: "priya@example.com",
  company: "Example Ltd",
  phone: "+91 90000 00000",
  subject: "New marketing website",
  message: "We need a new marketing site with a blog and a contact form.",
  sourcePage: "/contact",
};

const SMTP_ENV = {
  NODE_ENV: "test",
  LOG_LEVEL: "silent",
  SMTP_HOST: "smtp.example.com",
  SMTP_PORT: "587",
  SMTP_USER: "mailer",
  SMTP_PASSWORD: "secret",
  MAIL_FROM: "DeeTech Group <no-reply@deetechgroup.com>",
  ENQUIRY_NOTIFICATION_TO: "support@deetechgroup.com",
};

/** Captures what SmtpMailer would have sent. */
let sent: Record<string, unknown>[] = [];

beforeEach(() => {
  sent = [];
  const jsonTransport = nodemailer.createTransport({ jsonTransport: true });
  vi.spyOn(nodemailer, "createTransport").mockImplementation(() => {
    const original = jsonTransport.sendMail.bind(jsonTransport);
    jsonTransport.sendMail = (async (options: Record<string, unknown>) => {
      const info = await original(options as never);
      sent.push(JSON.parse((info as { message: string }).message));
      return info;
    }) as typeof jsonTransport.sendMail;
    return jsonTransport;
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("with no SMTP host configured", () => {
  it("is a no-op that reports failure rather than throwing", async () => {
    const mailer = createMailer(loadConfig({ NODE_ENV: "test", LOG_LEVEL: "silent" }));

    expect(mailer.configured).toBe(false);
    // Must not throw: the enquiry is already saved, and failing the request
    // would make the visitor submit it again.
    await expect(mailer.sendEnquiryNotification(ENQUIRY, 1)).resolves.toBe(false);
    expect(await mailer.verify()).toBe(false);
  });
});

describe("with SMTP configured", () => {
  it("sends to the notification address, from the configured sender", async () => {
    const mailer = createMailer(loadConfig(SMTP_ENV));
    expect(mailer.configured).toBe(true);

    const result = await mailer.sendEnquiryNotification(ENQUIRY, 42);

    expect(result).toBe(true);
    expect(sent).toHaveLength(1);
    expect(sent[0]!.to).toEqual([{ address: "support@deetechgroup.com", name: "" }]);
    expect(sent[0]!.from).toEqual({
      address: "no-reply@deetechgroup.com",
      name: "DeeTech Group",
    });
  });

  it("sets reply-to to the submitter so a reply reaches them", async () => {
    // `from` has to stay a domain we are authorised to send as (SPF/DKIM),
    // so the submitter goes in reply-to instead.
    const mailer = createMailer(loadConfig(SMTP_ENV));
    await mailer.sendEnquiryNotification(ENQUIRY, 42);

    expect(sent[0]!.replyTo).toEqual([
      { address: "priya@example.com", name: "Priya Sharma" },
    ]);
  });

  it("includes every submitted field in the body", async () => {
    const mailer = createMailer(loadConfig(SMTP_ENV));
    await mailer.sendEnquiryNotification(ENQUIRY, 42);

    const text = String(sent[0]!.text);
    expect(text).toContain("Priya Sharma");
    expect(text).toContain("priya@example.com");
    expect(text).toContain("Example Ltd");
    expect(text).toContain("+91 90000 00000");
    expect(text).toContain("/contact");
    expect(text).toContain("We need a new marketing site");
    expect(text).toContain("Enquiry #42");
  });

  it("omits optional fields that were not filled in", async () => {
    const mailer = createMailer(loadConfig(SMTP_ENV));
    await mailer.sendEnquiryNotification(
      { ...ENQUIRY, company: "", phone: "", sourcePage: "" },
      1,
    );

    const text = String(sent[0]!.text);
    expect(text).not.toContain("Company:");
    expect(text).not.toContain("Phone:");
    expect(text).not.toContain("Page:");
  });

  it("escapes the HTML part, so a submitted tag cannot render", async () => {
    const mailer = createMailer(loadConfig(SMTP_ENV));
    await mailer.sendEnquiryNotification(
      { ...ENQUIRY, message: '<img src=x onerror="alert(1)">' },
      1,
    );

    const html = String(sent[0]!.html);
    expect(html).toContain("&lt;img");
    expect(html).not.toContain("<img src=x");
  });

  it("reports failure rather than throwing when the transport errors", async () => {
    // A send that rejects must not propagate: the enquiry is already saved,
    // and failing the request would make the visitor submit it again.
    const failing = nodemailer.createTransport({ jsonTransport: true });
    failing.sendMail = (() => Promise.reject(new Error("connection refused"))) as never;
    vi.spyOn(nodemailer, "createTransport").mockReturnValue(failing);

    const mailer = createMailer(loadConfig(SMTP_ENV));
    await expect(mailer.sendEnquiryNotification(ENQUIRY, 1)).resolves.toBe(false);
  });
});

describe("header injection", () => {
  const CRLF = "\r\n";

  it("strips CR/LF and bounds length", () => {
    expect(headerSafe(`Hello${CRLF}Bcc: attacker@example.com`)).toBe(
      "Hello Bcc: attacker@example.com",
    );
    expect(headerSafe("x".repeat(500)).length).toBe(150);
  });

  it("a newline in the subject does not produce an extra header", async () => {
    const mailer = createMailer(loadConfig(SMTP_ENV));
    await mailer.sendEnquiryNotification(
      { ...ENQUIRY, subject: `Hello${CRLF}Bcc: attacker@example.com` },
      1,
    );

    // The built message is what a mail server would receive. If the newline
    // had survived, this would be two headers and `bcc` would be populated.
    expect(String(sent[0]!.subject)).not.toMatch(/[\r\n]/);
    expect(sent[0]!.bcc).toBeUndefined();
  });

  it("a newline in the name does not escape the reply-to header", async () => {
    const mailer = createMailer(loadConfig(SMTP_ENV));
    await mailer.sendEnquiryNotification(
      { ...ENQUIRY, name: `Priya${CRLF}Bcc: attacker@example.com` },
      1,
    );

    expect(JSON.stringify(sent[0]!.replyTo)).not.toMatch(/\\r|\\n/);
    expect(sent[0]!.bcc).toBeUndefined();
  });
});
