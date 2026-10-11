-- 0001 — initial schema
--
-- Data model specified in docs/02-sitemap-and-design-system.md, section 2.
--
-- Conventions used throughout:
--   * `text` rather than varchar(n); length limits are enforced by the Zod
--     schemas on write, where they can produce a useful error message.
--   * `timestamptz`, always UTC. `timestamp` without a zone is a trap.
--   * Publication state is a CHECK constraint rather than a Postgres ENUM
--     type: adding a value to an ENUM is a migration that cannot run inside
--     a transaction on older servers, and a CHECK is trivial to change.
--   * Slugs are unique and lowercase, enforced here as well as in the API.
--   * `updated_at` is maintained by a trigger, so it cannot be forgotten by
--     a caller.

-- ---------------------------------------------------------------------------
-- Shared helpers
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- A slug is lowercase, alphanumeric, hyphen-separated, no leading or
-- trailing hyphen. Matches SLUG_PATTERN in @deetech/shared-types.
CREATE DOMAIN slug AS text
  CHECK (VALUE ~ '^[a-z0-9]+(-[a-z0-9]+)*$');

-- ---------------------------------------------------------------------------
-- admin_users
-- ---------------------------------------------------------------------------

CREATE TABLE admin_users (
  id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email         text        NOT NULL,
  password_hash text        NOT NULL,
  name          text        NOT NULL,
  role          text        NOT NULL DEFAULT 'editor'
                  CHECK (role IN ('admin', 'editor')),
  is_active     boolean     NOT NULL DEFAULT true,
  last_login_at timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Email is matched case-insensitively at login, so uniqueness must be too —
-- otherwise Admin@x.com and admin@x.com become two accounts.
CREATE UNIQUE INDEX admin_users_email_lower_key ON admin_users (lower(email));

CREATE TRIGGER admin_users_updated_at
  BEFORE UPDATE ON admin_users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- pages — generic CMS pages (privacy policy, terms, …)
-- ---------------------------------------------------------------------------

CREATE TABLE pages (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  title           text        NOT NULL,
  slug            slug        NOT NULL UNIQUE,
  body            text        NOT NULL DEFAULT '',
  status          text        NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft', 'published')),
  seo_title       text,
  seo_description text,
  published_at    timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  -- A published row must have a publication date. Without this, "published"
  -- and "published_at IS NULL" can disagree and the blog sort order breaks.
  CONSTRAINT pages_published_has_date
    CHECK (status <> 'published' OR published_at IS NOT NULL)
);

-- Every public read is "published row with this slug"; this index serves it.
CREATE INDEX pages_published_slug_idx ON pages (slug) WHERE status = 'published';

CREATE TRIGGER pages_updated_at
  BEFORE UPDATE ON pages
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- services
-- ---------------------------------------------------------------------------

CREATE TABLE services (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  title           text        NOT NULL,
  slug            slug        NOT NULL UNIQUE,
  summary         text        NOT NULL,
  intro           text        NOT NULL DEFAULT '',

  -- Ordered arrays of {title, body}. Deliberately JSONB rather than two child
  -- tables: nothing ever queries inside them, ordering is free, and the CMS
  -- edits them as one list. Shape is validated by Zod on write and by the
  -- CHECK below, which stops anything that is not an array reaching a reader.
  benefits        jsonb       NOT NULL DEFAULT '[]'::jsonb
                    CHECK (jsonb_typeof(benefits) = 'array'),
  inclusions      jsonb       NOT NULL DEFAULT '[]'::jsonb
                    CHECK (jsonb_typeof(inclusions) = 'array'),

  image_url       text,
  status          text        NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft', 'published')),
  sort_order      integer     NOT NULL DEFAULT 0,
  seo_title       text,
  seo_description text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- `summary` is the card line. The legacy site shipped one identical sentence
-- on all six cards (CQ-3 in the Day 1 audit); this makes that impossible.
CREATE UNIQUE INDEX services_summary_key ON services (summary);

CREATE INDEX services_published_order_idx
  ON services (sort_order, id) WHERE status = 'published';

CREATE TRIGGER services_updated_at
  BEFORE UPDATE ON services
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- brands
-- ---------------------------------------------------------------------------

CREATE TABLE brands (
  id                bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name              text        NOT NULL,
  slug              slug        NOT NULL UNIQUE,

  -- Constrained on purpose. This is a factual claim about company structure,
  -- and the plan forbids using "subsidiary" unless the ownership and legal
  -- structure support it. The displayed wording is derived from this value in
  -- one shared helper (brandRelationshipLabel), never written by hand.
  relationship_type text        NOT NULL
                      CHECK (relationship_type IN (
                        'product_brand', 'division', 'subsidiary',
                        'partner', 'portfolio_company'
                      )),

  tagline           text,
  description       text        NOT NULL DEFAULT '',
  logo_url          text,
  website_url       text,
  status            text        NOT NULL DEFAULT 'draft'
                      CHECK (status IN ('draft', 'published')),
  sort_order        integer     NOT NULL DEFAULT 0,
  seo_title         text,
  seo_description   text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX brands_published_order_idx
  ON brands (sort_order, id) WHERE status = 'published';

CREATE TRIGGER brands_updated_at
  BEFORE UPDATE ON brands
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- products
-- ---------------------------------------------------------------------------

CREATE TABLE products (
  id                bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,

  -- Nullable: a product can belong to the group directly rather than to a
  -- brand. ON DELETE RESTRICT so a brand cannot be removed while products
  -- still point at it; the admin has to decide what happens to them.
  brand_id          bigint      REFERENCES brands (id) ON DELETE RESTRICT,

  name              text        NOT NULL,
  slug              slug        NOT NULL UNIQUE,
  summary           text        NOT NULL,
  description       text        NOT NULL DEFAULT '',
  website_url       text,
  documentation_url text,
  download_url      text,

  -- Lifecycle is separate from publication state on purpose: "draft" is about
  -- whether the page is visible, "coming_soon" is about the product itself.
  -- Overloading one column for both would make a published "coming soon"
  -- product unrepresentable.
  lifecycle         text        NOT NULL DEFAULT 'available'
                      CHECK (lifecycle IN ('available', 'beta', 'coming_soon')),

  status            text        NOT NULL DEFAULT 'draft'
                      CHECK (status IN ('draft', 'published')),
  sort_order        integer     NOT NULL DEFAULT 0,
  seo_title         text,
  seo_description   text,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX products_published_order_idx
  ON products (sort_order, id) WHERE status = 'published';
CREATE INDEX products_brand_idx ON products (brand_id);

CREATE TRIGGER products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- blog_posts
-- ---------------------------------------------------------------------------

CREATE TABLE blog_posts (
  id              bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  title           text        NOT NULL,
  slug            slug        NOT NULL UNIQUE,
  excerpt         text        NOT NULL DEFAULT '',
  body            text        NOT NULL DEFAULT '',

  -- ON DELETE SET NULL: deleting an author must not delete their articles.
  -- The API falls back to a display name when this is null.
  author_id       bigint      REFERENCES admin_users (id) ON DELETE SET NULL,
  author_name     text        NOT NULL DEFAULT 'DeeTech Group',

  category        text,
  featured_image  text,
  status          text        NOT NULL DEFAULT 'draft'
                    CHECK (status IN ('draft', 'published')),
  published_at    timestamptz,
  seo_title       text,
  seo_description text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT blog_posts_published_has_date
    CHECK (status <> 'published' OR published_at IS NOT NULL)
);

-- Serves the paginated listing: published posts, newest first.
CREATE INDEX blog_posts_published_idx
  ON blog_posts (published_at DESC, id DESC) WHERE status = 'published';

CREATE TRIGGER blog_posts_updated_at
  BEFORE UPDATE ON blog_posts
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------------
-- media
-- ---------------------------------------------------------------------------

CREATE TABLE media (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  file_name    text        NOT NULL,
  storage_path text        NOT NULL UNIQUE,
  mime_type    text        NOT NULL,
  size_bytes   bigint      NOT NULL CHECK (size_bytes > 0),
  width        integer,
  height       integer,

  -- NOT NULL with no default. Every one of the 53 media items on the legacy
  -- site has empty alt text (SEO-4); making this required at the schema level
  -- is what stops that happening again.
  alt_text     text        NOT NULL CHECK (length(btrim(alt_text)) > 0),

  uploaded_by  bigint      REFERENCES admin_users (id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX media_created_idx ON media (created_at DESC);

-- ---------------------------------------------------------------------------
-- contact_enquiries
-- ---------------------------------------------------------------------------

CREATE TABLE contact_enquiries (
  id          bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name        text        NOT NULL,
  email       text        NOT NULL,
  company     text,
  phone       text,
  subject     text        NOT NULL,
  message     text        NOT NULL,
  source_page text,

  status      text        NOT NULL DEFAULT 'new'
                CHECK (status IN ('new', 'read', 'replied', 'spam')),

  -- Hashed, never the raw address. Enough to rate-limit and to spot a flood
  -- from one source, without keeping an identifier we have no need for.
  ip_hash     text,
  user_agent  text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX contact_enquiries_created_idx ON contact_enquiries (created_at DESC);
CREATE INDEX contact_enquiries_status_idx
  ON contact_enquiries (status, created_at DESC);
-- Supports the per-IP submission window check in the enquiry endpoint.
CREATE INDEX contact_enquiries_ip_recent_idx ON contact_enquiries (ip_hash, created_at DESC);

-- ---------------------------------------------------------------------------
-- admin_sessions
-- ---------------------------------------------------------------------------

CREATE TABLE admin_sessions (
  -- The session id stored here is a HASH of the cookie value. Anyone who can
  -- read this table must not be able to mint a working cookie from it.
  id              text        PRIMARY KEY,
  user_id         bigint      NOT NULL REFERENCES admin_users (id) ON DELETE CASCADE,
  expires_at      timestamptz NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  last_seen_at    timestamptz NOT NULL DEFAULT now(),
  ip_hash         text,
  user_agent      text
);

CREATE INDEX admin_sessions_user_idx ON admin_sessions (user_id);
CREATE INDEX admin_sessions_expiry_idx ON admin_sessions (expires_at);

-- ---------------------------------------------------------------------------
-- login_attempts — throttling, required by section 8 of the plan
-- ---------------------------------------------------------------------------

CREATE TABLE login_attempts (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  email_lower  text        NOT NULL,
  ip_hash      text,
  succeeded    boolean     NOT NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX login_attempts_email_recent_idx
  ON login_attempts (email_lower, created_at DESC);
CREATE INDEX login_attempts_ip_recent_idx
  ON login_attempts (ip_hash, created_at DESC);
