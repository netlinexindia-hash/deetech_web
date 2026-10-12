import Link from "next/link";
import { Logo } from "@/components/layout/Logo";
import { Container } from "@/components/ui/Section";
import { getPageBySlug } from "@/lib/content";
import { contact, footerNav, site } from "@/lib/site";

function FooterColumn({
  title,
  items,
}: {
  title: string;
  items: { label: string; href: string }[];
}) {
  return (
    <div>
      <h2 className="text-sm font-semibold tracking-[0.14em] text-white uppercase">
        {title}
      </h2>
      <ul className="mt-4 space-y-2.5">
        {items.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className="inline-flex min-h-11 items-center text-[0.9375rem] text-navy-200 transition-colors hover:text-white sm:min-h-9"
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Legal links are rendered only for pages that are actually published.
 *
 * The privacy policy and terms are seeded as drafts, because they are
 * marked "pending legal review" and must not go live just by being seeded.
 * Linking to them unconditionally would put two 404s in the footer of every
 * page until somebody remembers to publish them. This way the link appears
 * the moment the page does, and the launch checklist has one less thing on
 * it that only shows up as a visitor complaint.
 */
async function publishedLegalLinks() {
  const pages = await Promise.all(
    footerNav.legal.map(async (item) => {
      const slug = item.href.replace(/^\//, "");
      const page = await getPageBySlug(slug);
      return page ? { href: item.href, label: page.title } : null;
    }),
  );
  return pages.filter((page): page is { href: string; label: string } => page !== null);
}

export async function Footer() {
  const year = new Date().getFullYear();
  const legalLinks = await publishedLegalLinks();

  return (
    <footer className="mt-auto bg-navy-950 text-navy-200">
      <Container className="py-14 md:py-20">
        <div className="grid gap-10 md:grid-cols-2 lg:grid-cols-4 lg:gap-8">
          <div className="lg:pr-6">
            {/* The mark is transparent and carries no dark ink, so it sits
                directly on the navy background — no white chip needed. */}
            <Logo tone="dark" />
            <p className="mt-5 max-w-sm text-[0.9375rem] leading-relaxed">
              {site.description}
            </p>
          </div>

          <FooterColumn title="Services" items={footerNav.services} />
          <FooterColumn title="Company" items={footerNav.company} />

          <div>
            <h2 className="text-sm font-semibold tracking-[0.14em] text-white uppercase">
              Get in touch
            </h2>
            <ul className="mt-4 space-y-3 text-[0.9375rem]">
              <li>
                <a
                  href={`tel:${contact.phoneHref}`}
                  className="inline-flex min-h-11 items-center transition-colors hover:text-white sm:min-h-9"
                >
                  {contact.phone}
                </a>
              </li>
              <li>
                <a
                  href={`mailto:${contact.email}`}
                  className="inline-flex min-h-11 items-center transition-colors hover:text-white sm:min-h-9"
                >
                  {contact.email}
                </a>
              </li>
            </ul>

            <div className="mt-6 space-y-5">
              {contact.offices.map((office) => (
                <div key={office.label}>
                  <p className="text-xs font-semibold tracking-wider text-navy-300 uppercase">
                    {office.label}
                  </p>
                  <address className="mt-1 text-[0.9375rem] not-italic">
                    {office.lines.map((line) => (
                      <span key={line} className="block">
                        {line}
                      </span>
                    ))}
                  </address>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-4 border-t border-white/10 pt-8 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm">
            &copy; {year} {site.legalName}. All rights reserved.
          </p>
          <ul className="flex flex-wrap gap-x-6 gap-y-2">
            {legalLinks.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="inline-flex min-h-11 items-center text-sm transition-colors hover:text-white sm:min-h-9"
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </Container>
    </footer>
  );
}
