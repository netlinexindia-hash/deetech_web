import type {
  AdminBlogPostInput,
  AdminBrandInput,
  AdminListQuery,
  AdminPageInput,
  AdminProductInput,
  AdminServiceInput,
  DashboardCounts,
} from "@deetech/shared-types/admin";
import type { Paginated } from "@deetech/shared-types";
import type { DbPool } from "../db/pool.js";

/**
 * Admin read and write access.
 *
 * Separate from `ContentRepository` on purpose. That one filters
 * `status = 'published'` on every query so a public route cannot leak a
 * draft; this one deliberately does not, and is only ever mounted behind
 * `requireAuth`. Keeping them apart means the public filter can never be
 * accidentally relaxed by a change made for the CMS.
 *
 * Every statement is parameterised. Column lists are literals in the source,
 * never built from request data.
 */

/** A row as the admin UI sees it: camelCase, drafts included. */
export type AdminRow = Record<string, unknown>;

function camel(row: Record<string, unknown>): AdminRow {
  const out: AdminRow = {};
  for (const [key, value] of Object.entries(row)) {
    const name = key.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
    out[name] = value instanceof Date ? value.toISOString() : value;
  }
  return out;
}

/**
 * The tables the CMS can edit, with the columns it may write.
 *
 * This map is the allowlist. A request cannot name a table or a column that
 * is not listed here, which is what makes the generic insert/update below
 * safe to build by interpolating identifiers.
 */
const RESOURCES = {
  pages: {
    table: "pages",
    columns: [
      "title",
      "slug",
      "body",
      "status",
      "seo_title",
      "seo_description",
      "published_at",
    ],
    searchColumns: ["title", "slug"],
    orderBy: "updated_at DESC",
  },
  services: {
    table: "services",
    columns: [
      "title",
      "slug",
      "summary",
      "intro",
      "benefits",
      "inclusions",
      "image_url",
      "status",
      "sort_order",
      "seo_title",
      "seo_description",
    ],
    searchColumns: ["title", "slug", "summary"],
    orderBy: "sort_order, id",
  },
  brands: {
    table: "brands",
    columns: [
      "name",
      "slug",
      "relationship_type",
      "tagline",
      "description",
      "logo_url",
      "website_url",
      "status",
      "sort_order",
      "seo_title",
      "seo_description",
    ],
    searchColumns: ["name", "slug"],
    orderBy: "sort_order, id",
  },
  products: {
    table: "products",
    columns: [
      "brand_id",
      "name",
      "slug",
      "summary",
      "description",
      "website_url",
      "documentation_url",
      "download_url",
      "lifecycle",
      "status",
      "sort_order",
      "seo_title",
      "seo_description",
    ],
    searchColumns: ["name", "slug", "summary"],
    orderBy: "sort_order, id",
  },
  blog: {
    table: "blog_posts",
    columns: [
      "title",
      "slug",
      "excerpt",
      "body",
      "author_name",
      "category",
      "featured_image",
      "status",
      "published_at",
      "seo_title",
      "seo_description",
    ],
    searchColumns: ["title", "slug"],
    orderBy: "COALESCE(published_at, created_at) DESC, id DESC",
  },
} as const;

export type ResourceName = keyof typeof RESOURCES;

export const RESOURCE_NAMES = Object.keys(RESOURCES) as ResourceName[];

export function isResourceName(value: string): value is ResourceName {
  return Object.hasOwn(RESOURCES, value);
}

/** camelCase input key -> snake_case column. */
function toColumn(key: string): string {
  return key.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);
}

export type AdminInput =
  | AdminPageInput
  | AdminServiceInput
  | AdminBrandInput
  | AdminProductInput
  | AdminBlogPostInput;

export class UniqueSlugError extends Error {
  constructor(public readonly slug: string) {
    super(`The slug "${slug}" is already in use.`);
    this.name = "UniqueSlugError";
  }
}

export class DuplicateSummaryError extends Error {
  constructor() {
    super("Another service already uses that summary. Each one must be distinct.");
    this.name = "DuplicateSummaryError";
  }
}

/** Postgres unique-violation. */
const UNIQUE_VIOLATION = "23505";
/** Postgres foreign-key violation. */
const FK_VIOLATION = "23503";

export class ForeignKeyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ForeignKeyError";
  }
}

function translate(error: unknown, slug?: string): never {
  const code = (error as { code?: string }).code;
  const constraint = (error as { constraint?: string }).constraint ?? "";

  if (code === UNIQUE_VIOLATION) {
    if (constraint.includes("summary")) throw new DuplicateSummaryError();
    if (slug) throw new UniqueSlugError(slug);
  }
  if (code === FK_VIOLATION) {
    if (constraint.includes("brand")) {
      throw new ForeignKeyError(
        "That brand no longer exists. Pick another, or leave the brand empty.",
      );
    }
    throw new ForeignKeyError("That reference no longer exists.");
  }
  throw error;
}

export class AdminContentRepository {
  constructor(private readonly pool: DbPool) {}

  async list(
    resource: ResourceName,
    query: AdminListQuery,
  ): Promise<Paginated<AdminRow>> {
    const spec = RESOURCES[resource];
    const where: string[] = [];
    const params: unknown[] = [];

    if (query.status !== "all") {
      params.push(query.status);
      where.push(`status = $${params.length}`);
    }
    if (query.q) {
      params.push(`%${query.q}%`);
      const index = params.length;
      where.push(
        `(${spec.searchColumns.map((c) => `${c} ILIKE $${index}`).join(" OR ")})`,
      );
    }

    const clause = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";
    const offset = (query.page - 1) * query.perPage;
    params.push(query.perPage, offset);

    const { rows } = await this.pool.query<Record<string, unknown>>(
      `SELECT *, count(*) OVER () AS total_count
         FROM ${spec.table}
         ${clause}
        ORDER BY ${spec.orderBy}
        LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );

    const total = rows[0] ? Number(rows[0].total_count) : 0;
    return {
      items: rows.map((row) => {
        const { total_count: _total, ...rest } = row;
        return camel(rest);
      }),
      page: query.page,
      perPage: query.perPage,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.perPage)),
    };
  }

  async findById(resource: ResourceName, id: number): Promise<AdminRow | null> {
    const spec = RESOURCES[resource];
    const { rows } = await this.pool.query<Record<string, unknown>>(
      `SELECT * FROM ${spec.table} WHERE id = $1`,
      [id],
    );
    return rows[0] ? camel(rows[0]) : null;
  }

  async create(resource: ResourceName, input: AdminInput): Promise<AdminRow> {
    const spec = RESOURCES[resource];
    const entries = Object.entries(input).filter(([key]) =>
      (spec.columns as readonly string[]).includes(toColumn(key)),
    );

    const columns = entries.map(([key]) => toColumn(key));
    const values = entries.map(([, value]) => serialise(value));
    const placeholders = columns.map((_, i) => `$${i + 1}`);

    try {
      const { rows } = await this.pool.query<Record<string, unknown>>(
        `INSERT INTO ${spec.table} (${columns.join(", ")})
         VALUES (${placeholders.join(", ")})
         RETURNING *`,
        values,
      );
      return camel(rows[0]!);
    } catch (error) {
      return translate(error, (input as { slug?: string }).slug);
    }
  }

  async update(
    resource: ResourceName,
    id: number,
    input: AdminInput,
  ): Promise<AdminRow | null> {
    const spec = RESOURCES[resource];
    const entries = Object.entries(input).filter(([key]) =>
      (spec.columns as readonly string[]).includes(toColumn(key)),
    );

    const assignments = entries.map(([key], i) => `${toColumn(key)} = $${i + 2}`);
    const values = entries.map(([, value]) => serialise(value));

    try {
      const { rows } = await this.pool.query<Record<string, unknown>>(
        `UPDATE ${spec.table} SET ${assignments.join(", ")} WHERE id = $1 RETURNING *`,
        [id, ...values],
      );
      return rows[0] ? camel(rows[0]) : null;
    } catch (error) {
      return translate(error, (input as { slug?: string }).slug);
    }
  }

  async remove(resource: ResourceName, id: number): Promise<boolean> {
    const spec = RESOURCES[resource];
    try {
      const result = await this.pool.query(`DELETE FROM ${spec.table} WHERE id = $1`, [
        id,
      ]);
      return (result.rowCount ?? 0) > 0;
    } catch (error) {
      return translate(error);
    }
  }

  /** Publish / unpublish without resubmitting the whole record. */
  async setStatus(
    resource: ResourceName,
    id: number,
    status: "draft" | "published",
  ): Promise<AdminRow | null> {
    const spec = RESOURCES[resource];
    const needsDate =
      spec.columns.includes("published_at" as never) && status === "published";

    const { rows } = await this.pool.query<Record<string, unknown>>(
      needsDate
        ? `UPDATE ${spec.table}
              SET status = $2,
                  published_at = COALESCE(published_at, now())
            WHERE id = $1 RETURNING *`
        : `UPDATE ${spec.table} SET status = $2 WHERE id = $1 RETURNING *`,
      [id, status],
    );
    return rows[0] ? camel(rows[0]) : null;
  }

  async dashboardCounts(): Promise<DashboardCounts> {
    // One round trip: six counts that are each trivial, but six sequential
    // queries on a dashboard load is three times the latency for no reason.
    const { rows } = await this.pool.query<Record<string, string>>(`
      SELECT
        (SELECT count(*) FROM services   WHERE status='published') AS services_pub,
        (SELECT count(*) FROM services   WHERE status='draft')     AS services_draft,
        (SELECT count(*) FROM brands     WHERE status='published') AS brands_pub,
        (SELECT count(*) FROM brands     WHERE status='draft')     AS brands_draft,
        (SELECT count(*) FROM products   WHERE status='published') AS products_pub,
        (SELECT count(*) FROM products   WHERE status='draft')     AS products_draft,
        (SELECT count(*) FROM pages      WHERE status='published') AS pages_pub,
        (SELECT count(*) FROM pages      WHERE status='draft')     AS pages_draft,
        (SELECT count(*) FROM blog_posts WHERE status='published') AS blog_pub,
        (SELECT count(*) FROM blog_posts WHERE status='draft')     AS blog_draft,
        (SELECT count(*) FROM media)                               AS media,
        (SELECT count(*) FROM contact_enquiries WHERE status='new') AS enq_new,
        (SELECT count(*) FROM contact_enquiries)                    AS enq_total
    `);
    const r = rows[0]!;
    const n = (key: string) => Number(r[key] ?? 0);

    return {
      services: { published: n("services_pub"), draft: n("services_draft") },
      brands: { published: n("brands_pub"), draft: n("brands_draft") },
      products: { published: n("products_pub"), draft: n("products_draft") },
      pages: { published: n("pages_pub"), draft: n("pages_draft") },
      blogPosts: { published: n("blog_pub"), draft: n("blog_draft") },
      media: n("media"),
      enquiries: { new: n("enq_new"), total: n("enq_total") },
    };
  }

  /** Brand id and name, for the product form's brand picker. */
  async brandOptions(): Promise<{ id: number; name: string }[]> {
    const { rows } = await this.pool.query<{ id: number; name: string }>(
      `SELECT id, name FROM brands ORDER BY name`,
    );
    return rows;
  }
}

/** Arrays and objects go to jsonb columns; everything else passes through. */
function serialise(value: unknown): unknown {
  return Array.isArray(value) || (value !== null && typeof value === "object")
    ? JSON.stringify(value)
    : value;
}
