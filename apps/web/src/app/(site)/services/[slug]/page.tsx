import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CTABand } from "@/components/ui/CTABand";
import { PageHeader } from "@/components/ui/PageHeader";
import { Section, SectionHeading } from "@/components/ui/Section";
import { getServiceBySlug, getServices } from "@/lib/content";
import { SITE_URL } from "@/lib/site";

interface Params {
  params: Promise<{ slug: string }>;
}

/** Prerenders all five service pages at build time. */
export async function generateStaticParams() {
  const services = await getServices();
  return services.map((service) => ({ slug: service.slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const service = await getServiceBySlug(slug);

  if (!service) {
    return { title: "Service not found", robots: { index: false, follow: true } };
  }

  const title = service.seoTitle ?? service.title;
  const description = service.seoDescription ?? service.summary;
  const canonical = `/services/${service.slug}`;

  return {
    title,
    description,
    alternates: { canonical },
    openGraph: {
      type: "article",
      title,
      description,
      url: canonical,
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      aria-hidden="true"
      className="mt-1 size-5 shrink-0 text-brand-700"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.25"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 10.5l4 4 8-9" />
    </svg>
  );
}

export default async function ServiceDetailPage({ params }: Params) {
  const { slug } = await params;
  const service = await getServiceBySlug(slug);

  if (!service) notFound();

  const all = await getServices();
  const others = all.filter((item) => item.id !== service.id);

  // Describes the page for search engines. Kept minimal and factual — it
  // claims only what the page itself says.
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: service.title,
    description: service.summary,
    serviceType: service.title,
    provider: {
      "@type": "Organization",
      name: "DeeTech Group",
      url: SITE_URL,
    },
    url: `${SITE_URL}/services/${service.slug}`,
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <PageHeader
        eyebrow="Service"
        title={service.title}
        lead={service.summary}
        breadcrumbs={{
          items: [
            { label: "Home", href: "/" },
            { label: "Services", href: "/services" },
          ],
          current: service.title,
        }}
      />

      <Section>
        <div className="max-w-prose">
          <p className="text-lead">{service.intro}</p>
        </div>
      </Section>

      <Section tone="subtle">
        <SectionHeading
          eyebrow="Why DeeTech Group"
          title={`What you get working with us on ${service.title.toLowerCase()}`}
        />

        <ul className="mt-12 grid gap-6 md:grid-cols-3">
          {service.benefits.map((benefit) => (
            <li
              key={benefit.title}
              className="rounded-xl border border-border bg-white p-6 shadow-card"
            >
              <h3 className="text-h3">{benefit.title}</h3>
              <p className="mt-3 text-body">{benefit.body}</p>
            </li>
          ))}
        </ul>
      </Section>

      <Section>
        <SectionHeading eyebrow="Scope" title="What the service includes" />

        <ul className="mt-10 grid gap-x-10 gap-y-7 md:grid-cols-2">
          {service.inclusions.map((item) => (
            <li key={item.title} className="flex gap-3">
              <CheckIcon />
              <div>
                <h3 className="text-base font-semibold text-navy-900">{item.title}</h3>
                <p className="mt-1.5 text-body">{item.body}</p>
              </div>
            </li>
          ))}
        </ul>
      </Section>

      {others.length > 0 ? (
        <Section tone="subtle" className="py-14 md:py-16 lg:py-20">
          <h2 className="text-h3">Other services</h2>
          <ul className="mt-6 flex flex-wrap gap-3">
            {others.map((item) => (
              <li key={item.id}>
                <Link
                  href={`/services/${item.slug}`}
                  className="inline-flex min-h-11 items-center rounded-full border border-border bg-white px-4 text-[0.9375rem] font-medium text-navy-800 transition-colors hover:border-brand-300 hover:text-brand-800"
                >
                  {item.title}
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      <CTABand
        title={`Need ${service.title.toLowerCase()}?`}
        lead={`Tell us what you are working with and what you need it to do. We will come back with a scope, a timeline and a price.`}
      />
    </>
  );
}
