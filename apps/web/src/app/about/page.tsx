import type { Metadata } from "next";
import { Button } from "@/components/ui/Button";
import { CTABand } from "@/components/ui/CTABand";
import { LinkCard } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { Section, SectionHeading } from "@/components/ui/Section";
import { getServices } from "@/lib/content";
import {
  aboutIntro,
  milestones,
  mission,
  stats,
  team,
  values,
  vision,
} from "@/lib/content/fixtures/about";

export const metadata: Metadata = {
  title: "About",
  description:
    "DeeTech Group builds and runs websites, IT, networks, email and hosting for businesses — one team accountable for all of it. Based in Noida, Uttar Pradesh.",
  alternates: { canonical: "/about" },
};

export default async function AboutPage() {
  const services = await getServices();

  return (
    <>
      <PageHeader
        eyebrow={aboutIntro.eyebrow}
        title={aboutIntro.title}
        lead={aboutIntro.lead}
        breadcrumbs={{ items: [{ label: "Home", href: "/" }], current: "About" }}
      />

      <Section>
        <div className="max-w-prose space-y-6">
          {aboutIntro.body.map((paragraph) => (
            <p key={paragraph.slice(0, 40)} className="text-lead">
              {paragraph}
            </p>
          ))}
        </div>

        {/* Renders only once real figures exist — the legacy counters all
            read "0 +". See CQ-5 in the Day 1 audit. */}
        {stats.length > 0 ? (
          <dl className="mt-14 grid gap-6 border-t border-border pt-12 sm:grid-cols-3">
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
      </Section>

      <Section tone="subtle">
        <div className="grid gap-10 lg:grid-cols-2 lg:gap-12">
          {[mission, vision].map((block) => (
            <div
              key={block.title}
              className="rounded-xl border border-border bg-white p-8 shadow-card"
            >
              <h2 className="text-h3">{block.title}</h2>
              <p className="mt-4 text-lg font-medium text-navy-900">{block.summary}</p>
              <p className="mt-4 text-body">{block.body}</p>
            </div>
          ))}
        </div>
      </Section>

      <Section>
        <SectionHeading
          eyebrow="How we work"
          title="Four things we hold to"
          lead="These are not aspirations. If we fall short of one of them on your project, say so and we will fix it."
        />

        <ul className="mt-12 grid gap-8 md:grid-cols-2 lg:gap-10">
          {values.map((value) => (
            <li key={value.title} className="flex gap-4">
              <span
                aria-hidden="true"
                className="mt-1.5 inline-flex size-2.5 shrink-0 rounded-full bg-accent-600"
              />
              <div>
                <h3 className="text-h3">{value.title}</h3>
                <p className="mt-2 text-body">{value.body}</p>
              </div>
            </li>
          ))}
        </ul>
      </Section>

      {/* Renders only once the founding year is confirmed — the legacy page
          says both "over seven years" and "over the past 4 years" (CQ-6). */}
      {milestones.length > 0 ? (
        <Section tone="subtle">
          <SectionHeading eyebrow="Our history" title="How we got here" />
          <ol className="mt-12 space-y-8 border-l border-border pl-6">
            {milestones.map((milestone) => (
              <li key={milestone.year} className="relative">
                <span
                  aria-hidden="true"
                  className="absolute top-2 -left-[1.9375rem] size-3 rounded-full border-2 border-white bg-brand-600"
                />
                <p className="text-sm font-semibold text-brand-800">{milestone.year}</p>
                <h3 className="mt-1 text-h3">{milestone.title}</h3>
                <p className="mt-2 max-w-prose text-body">{milestone.body}</p>
              </li>
            ))}
          </ol>
        </Section>
      ) : null}

      {/* Renders only once the real roster is confirmed — three of the four
          people on the legacy page look like placeholders (CQ-9). */}
      {team.length > 0 ? (
        <Section>
          <SectionHeading eyebrow="Team" title="The people you will work with" />
          <ul className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {team.map((member) => (
              <li
                key={member.name}
                className="rounded-xl border border-border bg-white p-6 shadow-card"
              >
                <h3 className="text-base font-semibold text-navy-900">{member.name}</h3>
                <p className="mt-0.5 text-sm text-muted">{member.role}</p>
                <p className="mt-3 text-sm text-body">{member.bio}</p>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}

      <Section tone="subtle">
        <SectionHeading
          eyebrow="What we do"
          title="Five services, one accountable team"
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

      <CTABand />
    </>
  );
}
