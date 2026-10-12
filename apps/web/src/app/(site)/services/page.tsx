import type { Metadata } from "next";
import { CTABand } from "@/components/ui/CTABand";
import { LinkCard } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Section } from "@/components/ui/Section";
import { getServices } from "@/lib/content";

export const metadata: Metadata = {
  title: "Services",
  description:
    "Web development, managed IT, network services, business email and web hosting from DeeTech Group. Five services from one accountable team.",
  alternates: { canonical: "/services" },
};

export default async function ServicesPage() {
  const services = await getServices();

  return (
    <>
      <PageHeader
        eyebrow="What we do"
        title="Five services, one accountable team"
        lead="Each one stands on its own, and they work better together. Take what you need now and add the rest when you need it."
        breadcrumbs={{ items: [{ label: "Home", href: "/" }], current: "Services" }}
      />

      <Section>
        {/* The cards are h3s. Without this the document jumps h1 -> h3, which
            reads as a missing level to anyone navigating by heading. */}
        <h2 className="sr-only">All services</h2>

        {services.length > 0 ? (
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {services.map((service) => (
              <li key={service.id} className="flex">
                <LinkCard
                  className="w-full"
                  href={`/services/${service.slug}`}
                  title={service.title}
                  description={service.summary}
                />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            title="No services published yet"
            body="Services will appear here once they are published in the CMS."
          />
        )}
      </Section>

      <CTABand
        title="Not sure which of these you need?"
        lead="Describe the problem rather than the solution and we will tell you what it actually takes to fix it — including when the answer is that you do not need us."
        primaryLabel="Talk it through"
      />
    </>
  );
}
