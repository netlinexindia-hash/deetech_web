import type { EnquiryInput, EnquiryStatus, Paginated } from "@deetech/shared-types";
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

/** The full record, as the admin inbox shows it. */
export interface EnquiryRecord {
  id: number;
  name: string;
  email: string;
  company: string | null;
  phone: string | null;
  subject: string;
  message: string;
  sourcePage: string | null;
  status: EnquiryStatus;
  createdAt: string;
}

interface EnquiryRow {
  id: number;
  name: string;
  email: string;
  company: string | null;
  phone: string | null;
  subject: string;
  message: string;
  source_page: string | null;
  status: EnquiryStatus;
  created_at: Date;
}

function toRecord(row: EnquiryRow): EnquiryRecord {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    company: row.company,
    phone: row.phone,
    subject: row.subject,
    message: row.message,
    sourcePage: row.source_page,
    status: row.status,
    createdAt: row.created_at.toISOString(),
  };
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

  async list(
    page: number,
    perPage: number,
    status: EnquiryStatus | "all",
  ): Promise<Paginated<EnquiryRecord>> {
    const offset = (page - 1) * perPage;
    const { rows } = await this.pool.query<EnquiryRow & { total_count: string }>(
      `SELECT *, count(*) OVER () AS total_count
         FROM contact_enquiries
        WHERE ($3::text = 'all' OR status = $3::text)
        ORDER BY created_at DESC, id DESC
        LIMIT $1 OFFSET $2`,
      [perPage, offset, status],
    );
    const total = rows[0] ? Number(rows[0].total_count) : 0;
    return {
      items: rows.map(toRecord),
      page,
      perPage,
      total,
      totalPages: Math.max(1, Math.ceil(total / perPage)),
    };
  }

  async findById(id: number): Promise<EnquiryRecord | null> {
    const { rows } = await this.pool.query<EnquiryRow>(
      `SELECT * FROM contact_enquiries WHERE id = $1`,
      [id],
    );
    return rows[0] ? toRecord(rows[0]) : null;
  }

  /**
   * Only the status is writable. The rest is a record of what somebody
   * actually sent and must not be editable after the fact.
   */
  async setStatus(id: number, status: EnquiryStatus): Promise<EnquiryRecord | null> {
    const { rows } = await this.pool.query<EnquiryRow>(
      `UPDATE contact_enquiries SET status = $2 WHERE id = $1 RETURNING *`,
      [id, status],
    );
    return rows[0] ? toRecord(rows[0]) : null;
  }

  async remove(id: number): Promise<boolean> {
    const result = await this.pool.query(
      `DELETE FROM contact_enquiries WHERE id = $1`,
      [id],
    );
    return (result.rowCount ?? 0) > 0;
  }
}
