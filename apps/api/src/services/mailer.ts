import nodemailer, { type Transporter } from "nodemailer";
import type { EnquiryInput } from "@deetech/shared-types";
import type { AppConfig } from "../config.js";
import { logger } from "../logger.js";

/**
 * Outbound email for enquiry notifications.
 *
 * Two deliberate behaviours:
 *
 *   1. When SMTP is not configured the mailer is a no-op that logs and
 *      returns false, rather than throwing. An enquiry that was saved to the
 *      database must not be reported to the visitor as failed just because
 *      the notification could not go out — the lead is not lost, and the
 *      admin list still shows it.
 *   2. Nothing from the submitted message is interpolated into a header.
 *      `replyTo` is the submitter's address, which is validated as an email,
 *      and the subject is built from a field with newlines stripped.
 */

export interface Mailer {
  readonly configured: boolean;
  sendEnquiryNotification(input: EnquiryInput, id: number): Promise<boolean>;
  verify(): Promise<boolean>;
}

/**
 * Header injection guard: no CR/LF, and bounded length.
 *
 * Exported so it can be tested directly. A newline in a header value lets a
 * submitter append their own headers — `Bcc:` being the obvious one.
 */
export function headerSafe(value: string, maxLength = 150): string {
  return value
    .replace(/[\r\n]+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

class NoopMailer implements Mailer {
  readonly configured = false;

  async sendEnquiryNotification(_input: EnquiryInput, id: number): Promise<boolean> {
    logger.warn(
      { enquiryId: id },
      "SMTP is not configured — enquiry was saved but no notification was sent",
    );
    return false;
  }

  async verify(): Promise<boolean> {
    return false;
  }
}

class SmtpMailer implements Mailer {
  readonly configured = true;
  private readonly transporter: Transporter;

  constructor(private readonly config: AppConfig) {
    this.transporter = nodemailer.createTransport({
      host: config.smtp.host!,
      port: config.smtp.port,
      secure: config.smtp.secure,
      auth: config.smtp.user
        ? { user: config.smtp.user, pass: config.smtp.password }
        : undefined,
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 20_000,
    });
  }

  async verify(): Promise<boolean> {
    try {
      await this.transporter.verify();
      return true;
    } catch (error) {
      logger.error({ err: error }, "SMTP verification failed");
      return false;
    }
  }

  async sendEnquiryNotification(input: EnquiryInput, id: number): Promise<boolean> {
    const subject = `New enquiry: ${headerSafe(input.subject)}`;

    const lines = [
      `Name:    ${input.name}`,
      `Email:   ${input.email}`,
      input.company ? `Company: ${input.company}` : null,
      input.phone ? `Phone:   ${input.phone}` : null,
      input.sourcePage ? `Page:    ${input.sourcePage}` : null,
      "",
      `Subject: ${input.subject}`,
      "",
      input.message,
      "",
      `— Enquiry #${id}`,
    ].filter((line): line is string => line !== null);

    try {
      await this.transporter.sendMail({
        from: this.config.smtp.from,
        to: this.config.smtp.notificationTo,
        // So a reply from the inbox goes to the person who wrote in, while
        // `from` stays a domain we are allowed to send as (SPF/DKIM).
        replyTo: `${headerSafe(input.name, 80)} <${input.email}>`,
        subject,
        text: lines.join("\n"),
        html: `<pre style="font:14px/1.6 ui-monospace,monospace;white-space:pre-wrap">${escapeHtml(
          lines.join("\n"),
        )}</pre>`,
      });
      logger.info({ enquiryId: id }, "Enquiry notification sent");
      return true;
    } catch (error) {
      // Logged, not thrown: see note 1 at the top of this file.
      logger.error({ err: error, enquiryId: id }, "Enquiry notification failed");
      return false;
    }
  }
}

export function createMailer(config: AppConfig): Mailer {
  return config.smtp.host ? new SmtpMailer(config) : new NoopMailer();
}
