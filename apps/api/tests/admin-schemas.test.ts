import { describe, expect, it } from "vitest";
import {
  adminBlogPostSchema,
  adminBrandSchema,
  adminPageSchema,
  adminProductSchema,
  adminServiceSchema,
  resolvePublishedAt,
  slugField,
} from "@deetech/shared-types/admin";
import { RESERVED_SLUGS } from "@deetech/shared-types";

/**
 * The admin write schemas are parsed TWICE on every save: once by the
 * Next.js server action against the submitted form, and again by the
 * Express route against what the action forwards. The second parse sees the
 * FIRST parse's output.
 *
 * So these schemas must be idempotent. They were not: optional fields
 * normalised "" to `null` on the way out but only accepted `""` or
 * `undefined` on the way in, so every save with an empty optional field
 * passed in the browser and was rejected by the API with a bare
 * "The request did not pass validation."
 *
 * The round-trip tests below are the guard against that returning.
 */

const BASE = {
  page: {
    title: "Privacy policy",
    slug: "privacy-policy",
    body: "Some body text.",
    status: "draft" as const,
  },
  service: {
    title: "Web Development",
    slug: "web-development",
    summary: "A sufficiently long and distinct card summary for this service.",
    intro: "Intro paragraph.",
    benefits: [{ title: "Front to back", body: "Both halves, one team." }],
    inclusions: [{ title: "Custom build", body: "Built against your goals." }],
    status: "published" as const,
    sortOrder: 1,
  },
  brand: {
    name: "AnPreD",
    slug: "anpred",
    relationshipType: "product_brand" as const,
    description: "A description.",
    status: "published" as const,
    sortOrder: 1,
  },
  product: {
    name: "InfraShield",
    slug: "infrashield",
    summary: "A sufficiently long and distinct card summary for this product.",
    description: "A description.",
    lifecycle: "available" as const,
    status: "published" as const,
    sortOrder: 1,
  },
  blog: {
    title: "An article",
    slug: "an-article",
    excerpt: "An excerpt.",
    body: "Body.",
    authorName: "DeeTech Group",
    status: "draft" as const,
  },
};

const SCHEMAS = [
  ["page", adminPageSchema, BASE.page],
  ["service", adminServiceSchema, BASE.service],
  ["brand", adminBrandSchema, BASE.brand],
  ["product", adminProductSchema, BASE.product],
  ["blog", adminBlogPostSchema, BASE.blog],
] as const;

describe("admin schemas are idempotent", () => {
  it.each(SCHEMAS)(
    "%s: parsing a schema's own output succeeds and is stable",
    (_name, schema, input) => {
      const first = schema.parse(input);

      // This is the step that used to fail: the output carries nulls for
      // every unset optional field, and the API re-parses exactly this.
      const second = schema.parse(first);

      expect(second).toEqual(first);
    },
  );

  it.each(SCHEMAS)("%s: a third pass is still stable", (_name, schema, input) => {
    const once = schema.parse(input);
    expect(schema.parse(schema.parse(once))).toEqual(once);
  });
});

describe("optional fields", () => {
  it("normalise empty strings to null", () => {
    const result = adminBrandSchema.parse({
      ...BASE.brand,
      tagline: "",
      logoUrl: "",
      websiteUrl: "",
      seoTitle: "",
      seoDescription: "",
    });
    expect(result.tagline).toBeNull();
    expect(result.logoUrl).toBeNull();
    expect(result.websiteUrl).toBeNull();
    expect(result.seoTitle).toBeNull();
    expect(result.seoDescription).toBeNull();
  });

  it("accept null as input, not only as output", () => {
    expect(() =>
      adminBrandSchema.parse({
        ...BASE.brand,
        tagline: null,
        logoUrl: null,
        websiteUrl: null,
        seoTitle: null,
        seoDescription: null,
      }),
    ).not.toThrow();
  });

  it("still reject a malformed URL", () => {
    const result = adminBrandSchema.safeParse({
      ...BASE.brand,
      websiteUrl: "not-a-url",
    });
    expect(result.success).toBe(false);
  });

  it("reject a non-http(s) URL scheme", () => {
    const result = adminBrandSchema.safeParse({
      ...BASE.brand,
      websiteUrl: "javascript:alert(1)",
    });
    expect(result.success).toBe(false);
  });
});

describe("SEO length limits", () => {
  // These are defensive bounds, not the ~155-character guideline. The
  // guideline as a hard error blocked saving the seeded 182-character
  // description, which was a bug in the rule, not in the content.
  it("accepts a description longer than the display guideline", () => {
    const result = adminServiceSchema.safeParse({
      ...BASE.service,
      seoDescription: "x".repeat(182),
    });
    expect(result.success).toBe(true);
  });

  it("rejects one that is implausibly long", () => {
    const result = adminServiceSchema.safeParse({
      ...BASE.service,
      seoDescription: "x".repeat(400),
    });
    expect(result.success).toBe(false);
  });
});

describe("slug validation", () => {
  it.each(["Web-Development", "web development", "-lead", "trail-", "a--b", ""])(
    "rejects %j",
    (slug) => {
      expect(slugField.safeParse(slug).success).toBe(false);
    },
  );

  it.each(RESERVED_SLUGS.filter((s) => /^[a-z0-9-]+$/.test(s)))(
    "rejects the reserved slug %s, which a route already owns",
    (slug) => {
      const result = slugField.safeParse(slug);
      expect(result.success).toBe(false);
    },
  );

  it("accepts an ordinary slug", () => {
    expect(slugField.parse("my-new-page")).toBe("my-new-page");
  });
});

describe("resolvePublishedAt", () => {
  it("stamps now when publishing with no date and none stored", () => {
    const result = resolvePublishedAt("published", null, null);
    expect(result).not.toBeNull();
    expect(Date.parse(result!)).toBeGreaterThan(Date.now() - 5_000);
  });

  it("leaves a draft with no date undated", () => {
    expect(resolvePublishedAt("draft", null, null)).toBeNull();
  });

  it("keeps the existing date when returning to draft", () => {
    // Otherwise unpublishing and republishing would silently move an
    // article to the top of the blog.
    const existing = "2026-01-01T00:00:00.000Z";
    expect(resolvePublishedAt("draft", null, existing)).toBe(existing);
    expect(resolvePublishedAt("published", null, existing)).toBe(existing);
  });

  it("prefers an explicitly chosen date over the stored one", () => {
    const chosen = "2026-05-05T12:00:00.000Z";
    expect(resolvePublishedAt("published", chosen, "2026-01-01T00:00:00.000Z")).toBe(
      chosen,
    );
  });
});

describe("product brand association", () => {
  it("treats an empty brand as the group owning the product directly", () => {
    expect(
      adminProductSchema.parse({ ...BASE.product, brandId: "" }).brandId,
    ).toBeNull();
    expect(
      adminProductSchema.parse({ ...BASE.product, brandId: null }).brandId,
    ).toBeNull();
  });

  it("coerces a numeric string from the form select", () => {
    expect(adminProductSchema.parse({ ...BASE.product, brandId: "3" }).brandId).toBe(3);
  });
});
