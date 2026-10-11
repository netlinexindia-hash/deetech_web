import type { Metadata } from "next";
import Link from "next/link";
import { PRODUCT_LIFECYCLE_LABELS } from "@deetech/shared-types";
import { Button } from "@/components/ui/Button";
import { CTABand } from "@/components/ui/CTABand";
import { EmptyState } from "@/components/ui/EmptyState";
import { LifecycleBadge } from "@/components/ui/LifecycleBadge";
import { PageHeader } from "@/components/ui/PageHeader";
import { Section } from "@/components/ui/Section";
import { getBrands, getProducts } from "@/lib/content";

export const metadata: Metadata = {
  title: "Products",
  description:
    "Software products built and supported by DeeTech Group and the brands in its portfolio.",
  alternates: { canonical: "/products" },
};

export default async function ProductsPage() {
  const products = await getProducts();
  const brands = await getBrands();
  const brandName = new Map(brands.map((brand) => [brand.id, brand.name]));

  return (
    <>
      <PageHeader
        eyebrow="Products"
        title="Software we build and run"
        lead="Products developed inside DeeTech Group and by the brands in its portfolio, with links to each one's site, documentation and downloads."
        breadcrumbs={{ items: [{ label: "Home", href: "/" }], current: "Products" }}
      />

      <Section>
        {products.length > 0 ? (
          <ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((product) => (
              <li
                key={product.id}
                className="group relative flex flex-col rounded-xl border border-border bg-white p-6 shadow-card transition-[box-shadow,border-color,transform] duration-200 hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-card-hover"
              >
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-h3">
                    <Link
                      href={`/products/${product.slug}`}
                      className="after:absolute after:inset-0 after:content-['']"
                    >
                      {product.name}
                    </Link>
                  </h2>
                  <LifecycleBadge lifecycle={product.lifecycle} />
                </div>

                {product.brandId !== null && brandName.has(product.brandId) ? (
                  <p className="mt-1.5 text-sm text-muted">
                    by {brandName.get(product.brandId)}
                  </p>
                ) : null}

                <p className="mt-3 flex-1 text-body">{product.summary}</p>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            title="The product directory is not live yet"
            body="DeeTech Group's own products are being written up now. If you are looking for something specific, ask us — we will tell you whether it exists, when it is due, or what we would use instead."
            action={
              <div className="flex flex-col justify-center gap-3 sm:flex-row">
                <Button href="/contact">Ask about a product</Button>
                <Button href="/services" variant="secondary">
                  See our services
                </Button>
              </div>
            }
          />
        )}

        {products.length > 0 ? (
          <p className="mt-8 text-sm text-muted">
            Status key: {Object.values(PRODUCT_LIFECYCLE_LABELS).join(" · ")}
          </p>
        ) : null}
      </Section>

      <CTABand
        title="Need something that does not exist yet?"
        lead="Most of what we build started as a client telling us the off-the-shelf option did not fit."
      />
    </>
  );
}
