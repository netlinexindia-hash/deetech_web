import type {
  BlogPost,
  Brand,
  BrandRelationshipType,
  Page,
  Paginated,
  Product,
  ProductLifecycle,
  PublicationStatus,
  Service,
  ServicePoint,
} from "@deetech/shared-types";
import type { DbPool } from "../db/pool.js";

/**
 * Read access to published content.
 *
 * Every query here filters `status = 'published'`. That is deliberately not a
 * caller's responsibility: a public endpoint that forgets the filter would
 * leak drafts, so the filter lives in the only place that talks to the
 * database.
 *
 * All SQL is parameterised. No value from a request is ever concatenated into
 * a statement.
 */

const PUBLISHED: PublicationStatus = "published";

// --- row shapes, as Postgres returns them (snake_case) ---------------------

interface ServiceRow {
  id: number;
  title: string;
  slug: string;
  summary: string;
  intro: string;
  benefits: ServicePoint[];
  inclusions: ServicePoint[];
  image_url: string | null;
  status: PublicationStatus;
  sort_order: number;
  seo_title: string | null;
  seo_description: string | null;
  created_at: Date;
  updated_at: Date;
}

interface BrandRow {
  id: number;
  name: string;
  slug: string;
  relationship_type: BrandRelationshipType;
  tagline: string | null;
  description: string;
  logo_url: string | null;
  website_url: string | null;
  status: PublicationStatus;
  sort_order: number;
  seo_title: string | null;
  seo_description: string | null;
  created_at: Date;
  updated_at: Date;
}

interface ProductRow {
  id: number;
  brand_id: number | null;
  name: string;
  slug: string;
  summary: string;
  description: string;
  website_url: string | null;
  documentation_url: string | null;
  download_url: string | null;
  lifecycle: ProductLifecycle;
  status: PublicationStatus;
  sort_order: number;
  seo_title: string | null;
  seo_description: string | null;
  created_at: Date;
  updated_at: Date;
}

interface PostRow {
  id: number;
  title: string;
  slug: string;
  excerpt: string;
  body: string;
  author_name: string;
  category: string | null;
  featured_image: string | null;
  status: PublicationStatus;
  published_at: Date | null;
  seo_title: string | null;
  seo_description: string | null;
  created_at: Date;
  updated_at: Date;
}

interface PageRow {
  id: number;
  title: string;
  slug: string;
  body: string;
  status: PublicationStatus;
  seo_title: string | null;
  seo_description: string | null;
  published_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

// --- mappers ---------------------------------------------------------------

const iso = (value: Date | null): string | null =>
  value === null ? null : value.toISOString();

function toService(row: ServiceRow): Service {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    summary: row.summary,
    intro: row.intro,
    benefits: row.benefits,
    inclusions: row.inclusions,
    imageUrl: row.image_url,
    status: row.status,
    sortOrder: row.sort_order,
    seoTitle: row.seo_title,
    seoDescription: row.seo_description,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function toBrand(row: BrandRow): Brand {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    relationshipType: row.relationship_type,
    tagline: row.tagline,
    description: row.description,
    logoUrl: row.logo_url,
    websiteUrl: row.website_url,
    status: row.status,
    sortOrder: row.sort_order,
    seoTitle: row.seo_title,
    seoDescription: row.seo_description,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function toProduct(row: ProductRow): Product {
  return {
    id: row.id,
    brandId: row.brand_id,
    name: row.name,
    slug: row.slug,
    summary: row.summary,
    description: row.description,
    websiteUrl: row.website_url,
    documentationUrl: row.documentation_url,
    downloadUrl: row.download_url,
    lifecycle: row.lifecycle,
    status: row.status,
    sortOrder: row.sort_order,
    seoTitle: row.seo_title,
    seoDescription: row.seo_description,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function toPost(row: PostRow): BlogPost {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    excerpt: row.excerpt,
    body: row.body,
    authorName: row.author_name,
    category: row.category,
    featuredImage: row.featured_image,
    status: row.status,
    publishedAt: iso(row.published_at),
    seoTitle: row.seo_title,
    seoDescription: row.seo_description,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function toPage(row: PageRow): Page {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    body: row.body,
    status: row.status,
    seoTitle: row.seo_title,
    seoDescription: row.seo_description,
    publishedAt: iso(row.published_at),
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

// --- repository ------------------------------------------------------------

export const MAX_PER_PAGE = 50;

export class ContentRepository {
  constructor(private readonly pool: DbPool) {}

  async listServices(): Promise<Service[]> {
    const { rows } = await this.pool.query<ServiceRow>(
      `SELECT * FROM services WHERE status = $1 ORDER BY sort_order, id`,
      [PUBLISHED],
    );
    return rows.map(toService);
  }

  async findServiceBySlug(slug: string): Promise<Service | null> {
    const { rows } = await this.pool.query<ServiceRow>(
      `SELECT * FROM services WHERE slug = $1 AND status = $2`,
      [slug, PUBLISHED],
    );
    return rows[0] ? toService(rows[0]) : null;
  }

  async listBrands(): Promise<Brand[]> {
    const { rows } = await this.pool.query<BrandRow>(
      `SELECT * FROM brands WHERE status = $1 ORDER BY sort_order, id`,
      [PUBLISHED],
    );
    return rows.map(toBrand);
  }

  async findBrandBySlug(slug: string): Promise<Brand | null> {
    const { rows } = await this.pool.query<BrandRow>(
      `SELECT * FROM brands WHERE slug = $1 AND status = $2`,
      [slug, PUBLISHED],
    );
    return rows[0] ? toBrand(rows[0]) : null;
  }

  /** `brandId` narrows to one brand's products; omit it for all of them. */
  async listProducts(brandId?: number): Promise<Product[]> {
    const { rows } = await this.pool.query<ProductRow>(
      `SELECT * FROM products
        WHERE status = $1
          AND ($2::bigint IS NULL OR brand_id = $2::bigint)
        ORDER BY sort_order, id`,
      [PUBLISHED, brandId ?? null],
    );
    return rows.map(toProduct);
  }

  async findProductBySlug(slug: string): Promise<Product | null> {
    const { rows } = await this.pool.query<ProductRow>(
      `SELECT * FROM products WHERE slug = $1 AND status = $2`,
      [slug, PUBLISHED],
    );
    return rows[0] ? toProduct(rows[0]) : null;
  }

  async findPageBySlug(slug: string): Promise<Page | null> {
    const { rows } = await this.pool.query<PageRow>(
      `SELECT * FROM pages WHERE slug = $1 AND status = $2`,
      [slug, PUBLISHED],
    );
    return rows[0] ? toPage(rows[0]) : null;
  }

  /**
   * One round trip for the page of rows and the total, so the count cannot
   * disagree with the rows because something was published in between.
   */
  async listPosts(page: number, perPage: number): Promise<Paginated<BlogPost>> {
    const safePerPage = Math.min(Math.max(1, perPage), MAX_PER_PAGE);
    const safePage = Math.max(1, page);
    const offset = (safePage - 1) * safePerPage;

    const { rows } = await this.pool.query<PostRow & { total_count: string }>(
      `SELECT *, count(*) OVER () AS total_count
         FROM blog_posts
        WHERE status = $1 AND published_at IS NOT NULL
        ORDER BY published_at DESC, id DESC
        LIMIT $2 OFFSET $3`,
      [PUBLISHED, safePerPage, offset],
    );

    const total = rows[0] ? Number(rows[0].total_count) : 0;

    return {
      items: rows.map(toPost),
      page: safePage,
      perPage: safePerPage,
      total,
      totalPages: Math.max(1, Math.ceil(total / safePerPage)),
    };
  }

  async listAllPosts(): Promise<BlogPost[]> {
    const { rows } = await this.pool.query<PostRow>(
      `SELECT * FROM blog_posts
        WHERE status = $1 AND published_at IS NOT NULL
        ORDER BY published_at DESC, id DESC`,
      [PUBLISHED],
    );
    return rows.map(toPost);
  }

  async findPostBySlug(slug: string): Promise<BlogPost | null> {
    const { rows } = await this.pool.query<PostRow>(
      `SELECT * FROM blog_posts
        WHERE slug = $1 AND status = $2 AND published_at IS NOT NULL`,
      [slug, PUBLISHED],
    );
    return rows[0] ? toPost(rows[0]) : null;
  }
}
