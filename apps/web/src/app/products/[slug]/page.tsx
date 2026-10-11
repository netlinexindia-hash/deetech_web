import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { brandRelationshipLabel } from "@deetech/shared-types";
import { CTABand } from "@/components/ui/CTABand";
import { ExternalLinkList, type ExternalLinkItem } from "@/components/ui/ExternalLink";
import { LifecycleBadge } from "@/components/ui/LifecycleBadge";
import { PageHeader } from "@/components/ui/PageHeader";
import { Section } from "@/components/ui/Section";
import { getBrands, getProductBySlug, getProducts } from "@/lib/content";
import { SITE_URL } from "@/lib/site";

interface Params {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const products = await getProducts();
  return products.map((product) => ({ slug: product.slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductBySlug(slug);

  if (!product) {
    return { title: "Product not found", robots: { index: false, follow: true } };
  }

  const title = product.seoTitle ?? product.name;
  const description = product.seoDescription ?? product.summary;
  const canonical = `/products/${product.slug}`;

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { type: "website", title, description, url: canonical },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function ProductDetailPage({ params }: Params) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);

  if (!product) notFound();

  const brands = await getBrands();
  const brand =
    product.brandId !== null
      ? (brands.find((b) => b.id === product.brandId) ?? null)
      : null;

  const links: ExternalLinkItem[] = [
    product.websiteUrl ? { label: "Product website", href: product.websiteUrl } : null,
    product.documentationUrl
      ? { label: "Documentation", href: product.documentationUrl }
      : null,
    product.downloadUrl ? { label: "Download", href: product.downloadUrl } : null,
  ].filter((link): link is ExternalLinkItem => link !== null);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: product.name,
    description: product.summary,
    ...(product.websiteUrl ? { url: product.websiteUrl } : {}),
    ...(brand ? { brand: { "@type": "Brand", name: brand.name } } : {}),
    publisher: {
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
        eyebrow="Product"
        title={product.name}
        lead={product.summary}
        breadcrumbs={{
          items: [
            { label: "Home", href: "/" },
            { label: "Products", href: "/products" },
          ],
          current: product.name,
        }}
      >
        <LifecycleBadge lifecycle={product.lifecycle} />
      </PageHeader>

      <Section>
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-16">
          <div className="max-w-prose">
            <p className="text-lead">{product.description}</p>
          </div>

          <aside>
            <div className="rounded-xl border border-border bg-surface-subtle p-6">
              <h2 className="text-sm font-semibold tracking-[0.12em] text-navy-900 uppercase">
                Details
              </h2>

              <dl className="mt-4 space-y-4 text-[0.9375rem]">
                <div>
                  <dt className="font-semibold text-navy-900">Status</dt>
                  <dd className="mt-1">
                    <LifecycleBadge lifecycle={product.lifecycle} />
                  </dd>
                </div>

                {brand ? (
                  <div>
                    <dt className="font-semibold text-navy-900">Brand</dt>
                    <dd className="mt-0.5">
                      <Link
                        href={`/brands/${brand.slug}`}
                        className="text-brand-800 underline underline-offset-4"
                      >
                        {brand.name}
                      </Link>
                      <span className="mt-0.5 block text-sm text-muted">
                        {brandRelationshipLabel(brand.relationshipType)}
                      </span>
                    </dd>
                  </div>
                ) : null}
              </dl>

              {links.length > 0 ? (
                <div className="mt-5 border-t border-border pt-5">
                  <h3 className="sr-only">External links</h3>
                  <ExternalLinkList links={links} />
                </div>
              ) : null}
            </div>
          </aside>
        </div>
      </Section>

      <CTABand
        title={`Questions about ${product.name}?`}
        lead="Ask us what it does, whether it fits your situation, or what it would take to get it running."
      />
    </>
  );
}
