import type { Metadata } from "next";
import Link from "next/link";
import { brandRelationshipLabel } from "@deetech/shared-types";
import { Button } from "@/components/ui/Button";
import { CTABand } from "@/components/ui/CTABand";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageHeader } from "@/components/ui/PageHeader";
import { Section } from "@/components/ui/Section";
import { getBrands, getProducts } from "@/lib/content";
import { excerpt } from "@/lib/text";

export const metadata: Metadata = {
  title: "Brands & companies",
  description:
    "The brands and companies that make up the DeeTech Group portfolio, and how each one relates to the group.",
  alternates: { canonical: "/brands" },
};

export default async function BrandsPage() {
  const brands = await getBrands();
  const products = await getProducts();

  return (
    <>
      <PageHeader
        eyebrow="Portfolio"
        title="Brands and companies"
        lead="The brands DeeTech Group builds and backs, and exactly how each one relates to the group."
        breadcrumbs={{ items: [{ label: "Home", href: "/" }], current: "Brands" }}
      />

      <Section>
        {brands.length > 0 ? (
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {brands.map((brand) => {
              const count = products.filter((p) => p.brandId === brand.id).length;
              return (
                <li
                  key={brand.id}
                  className="group relative flex flex-col rounded-xl border border-border bg-white p-6 shadow-card transition-[box-shadow,border-color,transform] duration-200 hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-card-hover"
                >
                  {brand.logoUrl ? (
                    <div className="mb-4 flex h-16 items-center">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={brand.logoUrl}
                        alt=""
                        className="h-full w-auto"
                        loading="lazy"
                        decoding="async"
                      />
                    </div>
                  ) : null}

                  <p className="text-xs font-semibold tracking-[0.12em] text-brand-800 uppercase">
                    {brandRelationshipLabel(brand.relationshipType)}
                  </p>

                  <h2 className="mt-3 text-h3">
                    <Link
                      href={`/brands/${brand.slug}`}
                      className="after:absolute after:inset-0 after:content-['']"
                    >
                      {brand.name}
                    </Link>
                  </h2>

                  {brand.tagline ? (
                    <p className="mt-1.5 font-medium text-navy-700">{brand.tagline}</p>
                  ) : null}

                  {/* `description` is Markdown; a card shows a bounded
                      plain-text excerpt rather than markup in a grid cell. */}
                  <p className="mt-3 flex-1 text-body">
                    {excerpt(brand.description, 190)}
                  </p>

                  {count > 0 ? (
                    <p className="mt-5 text-sm text-muted">
                      {count} {count === 1 ? "product" : "products"}
                    </p>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState
            title="The brand directory is not live yet"
            body="DeeTech Group's own brands and products are being written up now. In the meantime, the group's client services are listed under Services, and we are happy to talk about any of it directly."
            action={
              <div className="flex flex-col justify-center gap-3 sm:flex-row">
                <Button href="/services">See our services</Button>
                <Button href="/contact" variant="secondary">
                  Ask us about a brand
                </Button>
              </div>
            }
          />
        )}
      </Section>

      <CTABand
        title="Working on a product of your own?"
        lead="We build and run software for other businesses as well as for ourselves. Tell us what you have in mind."
      />
    </>
  );
}
