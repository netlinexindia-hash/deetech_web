import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { CTABand } from "@/components/ui/CTABand";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Section } from "@/components/ui/Section";
import { getPosts } from "@/lib/content";
import { formatDate } from "@/lib/format";
import { readingTimeMinutes } from "@/lib/markdown";

export const metadata: Metadata = {
  title: "Blog",
  description:
    "Practical writing on web development, IT, networks, email and hosting from the DeeTech Group team.",
  alternates: {
    canonical: "/blog",
    types: { "application/rss+xml": "/blog/rss.xml" },
  },
};

interface Props {
  searchParams: Promise<{ page?: string }>;
}

export default async function BlogPage({ searchParams }: Props) {
  const { page } = await searchParams;
  const requested = Number.parseInt(page ?? "1", 10);
  const {
    items,
    page: current,
    totalPages,
  } = await getPosts(Number.isNaN(requested) ? 1 : requested);

  return (
    <>
      <PageHeader
        eyebrow="Blog"
        title="Notes from the work"
        lead="Practical writing on the things clients actually ask us about — hosting, email, networks and keeping systems running."
        breadcrumbs={{ items: [{ label: "Home", href: "/" }], current: "Blog" }}
      />

      <Section>
        {items.length > 0 ? (
          <>
            <ul className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {items.map((post) => (
                <li
                  key={post.id}
                  className="group relative flex flex-col rounded-xl border border-border bg-white p-6 shadow-card transition-[box-shadow,border-color,transform] duration-200 hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-card-hover"
                >
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
                    {post.publishedAt ? (
                      <time dateTime={post.publishedAt}>
                        {formatDate(post.publishedAt)}
                      </time>
                    ) : null}
                    {post.category ? (
                      <>
                        <span aria-hidden="true">·</span>
                        <span>{post.category}</span>
                      </>
                    ) : null}
                    <span aria-hidden="true">·</span>
                    <span>{readingTimeMinutes(post.body)} min read</span>
                  </div>

                  <h2 className="mt-3 text-h3">
                    <Link
                      href={`/blog/${post.slug}`}
                      className="after:absolute after:inset-0 after:content-['']"
                    >
                      {post.title}
                    </Link>
                  </h2>

                  <p className="mt-3 flex-1 text-body">{post.excerpt}</p>
                </li>
              ))}
            </ul>

            {totalPages > 1 ? (
              <nav
                aria-label="Blog pagination"
                className="mt-12 flex items-center justify-between gap-4 border-t border-border pt-8"
              >
                {current > 1 ? (
                  <Button
                    href={current === 2 ? "/blog" : `/blog?page=${current - 1}`}
                    variant="secondary"
                  >
                    Newer posts
                  </Button>
                ) : (
                  <span />
                )}

                <p className="text-sm text-muted">
                  Page {current} of {totalPages}
                </p>

                {current < totalPages ? (
                  <Button href={`/blog?page=${current + 1}`} variant="secondary">
                    Older posts
                  </Button>
                ) : (
                  <span />
                )}
              </nav>
            ) : null}
          </>
        ) : (
          <EmptyState
            title="Nothing published yet"
            body="We are writing up the things clients ask us most often. Check back shortly, or ask us directly in the meantime."
            action={<Button href="/contact">Ask us a question</Button>}
          />
        )}
      </Section>

      <CTABand
        title="Got a question we have not written about?"
        lead="Ask it. If the answer is useful to other people, we will write it up."
        primaryLabel="Ask us"
      />
    </>
  );
}
