import type { Metadata } from "next";
import { brandRelationshipLabel } from "@deetech/shared-types";
import { Hero } from "@/components/home/Hero";
import { Button } from "@/components/ui/Button";
import { LinkCard } from "@/components/ui/Card";
import { Section, SectionHeading } from "@/components/ui/Section";
import { getBrands, getServices } from "@/lib/content";
import { capabilities, stats, testimonials } from "@/lib/content/home";
import { excerpt } from "@/lib/text";
import { contact, site } from "@/lib/site";

export const metadata: Metadata = {
  // Overrides the title template on purpose: the homepage title should not
  // read "Home | DeeTech Group".
  title: `${site.name} — IT services, web development and hosting`,
  description: site.description,
  alternates: { canonical: "/" },
};

export default async function HomePage() {
  const services = await getServices();
  const featuredBrands = await getBrands();

  return (
    <>
      <Hero />

      <Section tone="subtle" id="services">
        <SectionHeading
          eyebrow="What we do"
          title="Five services, one accountable team"
          lead="Each one stands on its own, and they work better together. Pick what you need now; add the rest when you do."
        />

        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((service) => (
            <LinkCard
              key={service.id}
              href={`/services/${service.slug}`}
              title={service.title}
              description={service.summary}
            />
          ))}
        </div>

        <div className="mt-10">
          <Button href="/services" variant="secondary">
            See all services
          </Button>
        </div>
      </Section>

      <Section>
        <div className="grid gap-12 lg:grid-cols-2 lg:gap-16">
          <SectionHeading
            eyebrow="About DeeTech Group"
            title="A technology partner, not just a supplier"
            lead="We work with businesses that need their technology to be dependable rather than impressive — and who would rather call one team than coordinate four."
          />

          <ul className="space-y-8">
            {capabilities.map((capability) => (
              <li key={capability.title} className="flex gap-4">
                <span
                  aria-hidden="true"
                  className="mt-1.5 inline-flex size-2.5 shrink-0 rounded-full bg-accent-600"
                />
                <div>
                  <h3 className="text-h3">{capability.title}</h3>
                  <p className="mt-2 text-body">{capability.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Renders only once real figures exist — the legacy counters all read
            "0 +". See CQ-5 in the Day 1 audit. */}
        {stats.length > 0 ? (
          <dl className="mt-16 grid gap-6 border-t border-border pt-12 sm:grid-cols-3">
            {stats.map((stat) => (
              <div key={stat.label}>
                <dt className="sr-only">{stat.label}</dt>
                <dd>
                  <span className="block text-h1 font-bold text-navy-900">
                    {stat.value}
                  </span>
                  <span className="mt-1 block text-muted">{stat.label}</span>
                </dd>
              </div>
            ))}
          </dl>
        ) : null}

        <div className="mt-12">
          <Button href="/about" variant="secondary">
            More about the group
          </Button>
        </div>
      </Section>

      {/* Renders only once brand details are supplied — see Day 8 in
          docs/02-sitemap-and-design-system.md section 5. */}
      {featuredBrands.length > 0 ? (
        <Section tone="subtle">
          <SectionHeading
            eyebrow="Our brands"
            title="Products built inside the group"
            lead="DeeTech Group develops its own products alongside its client work."
          />

          <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {featuredBrands.map((brand) => (
              <LinkCard
                key={brand.id}
                href={`/brands/${brand.slug}`}
                title={brand.name}
                description={excerpt(brand.description, 170)}
                footer={
                  <p className="text-sm font-medium text-muted">
                    {brandRelationshipLabel(brand.relationshipType)}
                  </p>
                }
              />
            ))}
          </div>

          <div className="mt-10">
            <Button href="/brands" variant="secondary">
              View all brands
            </Button>
          </div>
        </Section>
      ) : null}

      <Section tone="subtle">
        <SectionHeading
          eyebrow="Client feedback"
          title="What people say after working with us"
          align="center"
        />

        <ul className="mt-12 grid gap-6 lg:grid-cols-3">
          {testimonials.map((testimonial) => (
            <li
              key={testimonial.name}
              className="flex flex-col rounded-xl border border-border bg-white p-7 shadow-card"
            >
              <blockquote className="flex-1">
                <p className="text-body">&ldquo;{testimonial.quote}&rdquo;</p>
              </blockquote>
              <footer className="mt-6 border-t border-border pt-5">
                <p className="font-semibold text-navy-900">{testimonial.name}</p>
                <p className="mt-0.5 text-sm text-muted">{testimonial.role}</p>
              </footer>
            </li>
          ))}
        </ul>
      </Section>

      <Section tone="navy" className="py-14 md:py-20 lg:py-24">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <h2 className="text-h2 text-white">Tell us what you are trying to build</h2>
            <p className="mt-4 text-lead text-navy-200">
              Send over the details and we will come back with a scope, a timeline and a
              price. {contact.responseTime}
            </p>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row lg:shrink-0">
            <Button href="/contact" size="lg" variant="inverse">
              Start a conversation
            </Button>
            <Button
              href={`mailto:${contact.email}`}
              size="lg"
              variant="ghost"
              className="text-white hover:bg-white/10"
            >
              {contact.email}
            </Button>
          </div>
        </div>
      </Section>
    </>
  );
}
