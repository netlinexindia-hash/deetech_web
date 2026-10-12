import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CTABand } from "@/components/ui/CTABand";
import { PageHeader } from "@/components/ui/PageHeader";
import { Section } from "@/components/ui/Section";
import { getAllPosts, getPostBySlug } from "@/lib/content";
import { formatDate } from "@/lib/format";
import { readingTimeMinutes, renderMarkdown } from "@/lib/markdown";
import { site, SITE_URL } from "@/lib/site";

interface Params {
  params: Promise<{ slug: string }>;
}

export async function generateStaticParams() {
  const posts = await getAllPosts();
  return posts.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const post = await getPostBySlug(slug);

  if (!post) {
    return { title: "Article not found", robots: { index: false, follow: true } };
  }

  const title = post.seoTitle ?? post.title;
  const description = post.seoDescription ?? post.excerpt;
  const canonical = `/blog/${post.slug}`;

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      type: "article",
      title,
      description,
      url: canonical,
      publishedTime: post.publishedAt ?? undefined,
      modifiedTime: post.updatedAt,
      authors: [post.authorName],
      ...(post.featuredImage ? { images: [post.featuredImage] } : {}),
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function ArticlePage({ params }: Params) {
  const { slug } = await params;
  const post = await getPostBySlug(slug);

  if (!post) notFound();

  const html = await renderMarkdown(post.body);
  const minutes = readingTimeMinutes(post.body);

  const others = (await getAllPosts())
    .filter((item) => item.id !== post.id)
    .slice(0, 3);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: post.title,
    description: post.excerpt,
    datePublished: post.publishedAt,
    dateModified: post.updatedAt,
    author: { "@type": "Organization", name: post.authorName },
    publisher: {
      "@type": "Organization",
      name: site.name,
      url: SITE_URL,
      logo: { "@type": "ImageObject", url: `${SITE_URL}/icon.png` },
    },
    mainEntityOfPage: `${SITE_URL}/blog/${post.slug}`,
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <PageHeader
        eyebrow={post.category ?? "Article"}
        title={post.title}
        breadcrumbs={{
          items: [
            { label: "Home", href: "/" },
            { label: "Blog", href: "/blog" },
          ],
          current: post.title,
        }}
      >
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-navy-300">
          <span>{post.authorName}</span>
          {post.publishedAt ? (
            <>
              <span aria-hidden="true">·</span>
              <time dateTime={post.publishedAt}>{formatDate(post.publishedAt)}</time>
            </>
          ) : null}
          <span aria-hidden="true">·</span>
          <span>{minutes} min read</span>
        </p>
      </PageHeader>

      <Section>
        <article
          /* `prose` styling is defined in globals.css so the same rules apply
             to any Markdown the CMS produces from Week 4 onward. */
          className="prose-article mx-auto max-w-prose"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </Section>

      {others.length > 0 ? (
        <Section tone="subtle" className="py-14 md:py-16 lg:py-20">
          <h2 className="text-h3">More from the blog</h2>
          <ul className="mt-6 space-y-4">
            {others.map((item) => (
              <li key={item.id}>
                <Link
                  href={`/blog/${item.slug}`}
                  className="inline-flex min-h-11 items-center font-semibold text-brand-800 underline underline-offset-4"
                >
                  {item.title}
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      <CTABand />
    </>
  );
}
