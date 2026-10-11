import type { EnquiryInput, EnquiryStatus } from "@deetech/shared-types";
import type { DbPool } from "../db/pool.js";

export interface StoredEnquiry {
  id: number;
  name: string;
  email: string;
  subject: string;
  createdAt: string;
}

export interface EnquiryContext {
  ipHash: string | null;
  userAgent: string | null;
}

export class EnquiryRepository {
  constructor(private readonly pool: DbPool) {}

  async create(
    input: EnquiryInput,
    context: EnquiryContext,
    status: EnquiryStatus = "new",
  ): Promise<StoredEnquiry> {
    const { rows } = await this.pool.query<{
      id: number;
      name: string;
      email: string;
      subject: string;
      created_at: Date;
    }>(
      `INSERT INTO contact_enquiries
         (name, email, company, phone, subject, message, source_page,
          status, ip_hash, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id, name, email, subject, created_at`,
      [
        input.name,
        input.email,
        input.company || null,
        input.phone || null,
        input.subject,
        input.message,
        input.sourcePage || null,
        status,
        context.ipHash,
        context.userAgent,
      ],
    );

    const row = rows[0];
    if (!row) throw new Error("Enquiry insert returned no row");

    return {
      id: row.id,
      name: row.name,
      email: row.email,
      subject: row.subject,
      createdAt: row.created_at.toISOString(),
    };
  }

  /**
   * How many enquiries this source has sent inside the window.
   *
   * This is a second layer behind nginx's `limit_req`: nginx protects the
   * server from volume, this protects the inbox from a submitter who gets
   * past it (a rotating proxy still has to re-solve the honeypot, but a
   * single persistent source is caught here).
   */
  async countRecentFrom(ipHash: string, windowMinutes: number): Promise<number> {
    const { rows } = await this.pool.query<{ count: string }>(
      `SELECT count(*) AS count
         FROM contact_enquiries
        WHERE ip_hash = $1
          AND created_at > now() - ($2 || ' minutes')::interval`,
      [ipHash, String(windowMinutes)],
    );
    return Number(rows[0]?.count ?? 0);
  }
}
