import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CTABand } from "@/components/ui/CTABand";
import { PageHeader } from "@/components/ui/PageHeader";
import { Section } from "@/components/ui/Section";
import { getPageBySlug } from "@/lib/content";
import { renderMarkdown } from "@/lib/markdown";
import { excerpt } from "@/lib/text";

/**
 * Generic CMS pages — privacy policy, terms, and anything else an editor
 * adds.
 *
 * This is the catch-all, and Next matches it only after every static
 * segment, so it can never shadow /about, /services, /brands, /products,
 * /blog or /contact. The admin's reserved-slug list refuses those names
 * anyway, so the protection is in two places.
 *
 * Not prerendered with generateStaticParams on purpose: pages are the one
 * type an editor creates ad hoc, and a new one should appear without a
 * rebuild. The content layer's revalidate window covers the caching.
 */

interface Params {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const page = await getPageBySlug(slug);

  if (!page) {
    return { title: "Page not found", robots: { index: false, follow: true } };
  }

  const title = page.seoTitle ?? page.title;
  const description = page.seoDescription ?? excerpt(page.body);
  const canonical = `/${page.slug}`;

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { type: "article", title, description, url: canonical },
  };
}

export default async function CmsPage({ params }: Params) {
  const { slug } = await params;
  const page = await getPageBySlug(slug);

  // Covers both "no such page" and "exists but is a draft" — the API only
  // ever returns published rows.
  if (!page) notFound();

  const html = await renderMarkdown(page.body);

  return (
    <>
      <PageHeader
        title={page.title}
        breadcrumbs={{ items: [{ label: "Home", href: "/" }], current: page.title }}
      />

      <Section>
        <article
          className="prose-article mx-auto max-w-prose"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </Section>

      <CTABand />
    </>
  );
}
