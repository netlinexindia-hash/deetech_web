import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  brandRelationshipLabel,
  PRODUCT_LIFECYCLE_LABELS,
} from "@deetech/shared-types";
import { CTABand } from "@/components/ui/CTABand";
import { ExternalLinkList } from "@/components/ui/ExternalLink";
import { LinkCard } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { Section, SectionHeading } from "@/components/ui/Section";
import { getBrandBySlug, getBrands, getProductsByBrand } from "@/lib/content";
import { renderMarkdown } from "@/lib/markdown";
import { excerpt, firstParagraph } from "@/lib/text";
import { SITE_URL } from "@/lib/site";

interface Params {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const brands = await getBrands();
  return brands.map((brand) => ({ slug: brand.slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const brand = await getBrandBySlug(slug);

  if (!brand) {
    return { title: "Brand not found", robots: { index: false, follow: true } };
  }

  const title = brand.seoTitle ?? brand.name;
  const description = brand.seoDescription ?? excerpt(brand.description);
  const canonical = `/brands/${brand.slug}`;

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { type: "profile", title, description, url: canonical },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function BrandDetailPage({ params }: Params) {
  const { slug } = await params;
  const brand = await getBrandBySlug(slug);

  if (!brand) notFound();

  const products = await getProductsByBrand(brand.id);
  const descriptionHtml = await renderMarkdown(brand.description);

  // The relationship wording comes from the enum, never hardcoded — it is a
  // statement about company structure and lives in exactly one place.
  const relationship = brandRelationshipLabel(brand.relationshipType);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Brand",
    name: brand.name,
    description: firstParagraph(brand.description),
    ...(brand.websiteUrl ? { url: brand.websiteUrl } : {}),
    ...(brand.logoUrl ? { logo: brand.logoUrl } : {}),
    parentOrganization: {
      "@type": "Organization",
      name: "DeeTech Group",
      url: SITE_URL,
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <PageHeader
        eyebrow={relationship}
        title={brand.name}
        lead={brand.tagline ?? undefined}
        breadcrumbs={{
          items: [
            { label: "Home", href: "/" },
            { label: "Brands", href: "/brands" },
          ],
          current: brand.name,
        }}
      />

      <Section>
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-16">
          <div
            className="prose-article max-w-prose"
            dangerouslySetInnerHTML={{ __html: descriptionHtml }}
          />

          <aside>
            <div className="rounded-xl border border-border bg-surface-subtle p-6">
              {brand.logoUrl ? (
                <div className="mb-5 flex justify-center rounded-lg bg-white p-5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={brand.logoUrl}
                    alt={`${brand.name} logo`}
                    className="h-24 w-auto"
                    loading="lazy"
                    decoding="async"
                  />
                </div>
              ) : null}

              <h2 className="text-sm font-semibold tracking-[0.12em] text-navy-900 uppercase">
                At a glance
              </h2>

              <dl className="mt-4 space-y-4 text-[0.9375rem]">
                <div>
                  <dt className="font-semibold text-navy-900">
                    Relationship to the group
                  </dt>
                  <dd className="mt-0.5 text-body">{relationship}</dd>
                </div>

                {products.length > 0 ? (
                  <div>
                    <dt className="font-semibold text-navy-900">Products</dt>
                    <dd className="mt-0.5 text-body">{products.length}</dd>
                  </div>
                ) : null}
              </dl>

              {brand.websiteUrl ? (
                <div className="mt-5 border-t border-border pt-5">
                  <ExternalLinkList
                    links={[{ label: "Visit website", href: brand.websiteUrl }]}
                  />
                </div>
              ) : null}
            </div>
          </aside>
        </div>
      </Section>

      {products.length > 0 ? (
        <Section tone="subtle">
          <SectionHeading eyebrow="Products" title={`Built by ${brand.name}`} />

          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((product) => (
              <LinkCard
                key={product.id}
                href={`/products/${product.slug}`}
                title={product.name}
                description={product.summary}
                footer={
                  <p className="text-sm font-medium text-muted">
                    {PRODUCT_LIFECYCLE_LABELS[product.lifecycle]}
                  </p>
                }
              />
            ))}
          </div>
        </Section>
      ) : null}

      <CTABand
        title={`Want to talk about ${brand.name}?`}
        lead="Ask us anything about what it does, who it is for, or how it fits with the rest of the group."
      />
    </>
  );
}
