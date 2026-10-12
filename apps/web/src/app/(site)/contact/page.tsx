import type { Metadata } from "next";
import { EnquiryForm } from "@/components/forms/EnquiryForm";
import { PageHeader } from "@/components/ui/PageHeader";
import { Section } from "@/components/ui/Section";
import { contact, SITE_URL, site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Contact",
  // Built from `contact` rather than written out: a hardcoded number here
  // survived a change to lib/site.ts once already.
  description:
    `Talk to DeeTech Group about web development, managed IT, networks, business ` +
    `email or hosting. Call ${contact.phone}, email ${contact.email}, or send an enquiry.`,
  alternates: { canonical: "/contact" },
};

function MailIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="size-5 shrink-0 text-brand-700"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 7 9 6 9-6" />
    </svg>
  );
}

function PhoneIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="size-5 shrink-0 text-brand-700"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1" />
    </svg>
  );
}

function PinIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      aria-hidden="true"
      className="size-5 shrink-0 text-brand-700"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  );
}

export default function ContactPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: site.name,
    url: SITE_URL,
    email: contact.email,
    telephone: contact.phoneHref,
    address: {
      "@type": "PostalAddress",
      streetAddress: "A-47, A Block, Sector 2",
      addressLocality: "Noida",
      addressRegion: "Uttar Pradesh",
      postalCode: "201301",
      addressCountry: "IN",
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      <PageHeader
        eyebrow="Contact"
        title="Tell us what you are trying to do"
        lead={`Describe the problem rather than the solution and we will tell you what it actually takes. ${contact.responseTime}`}
        breadcrumbs={{ items: [{ label: "Home", href: "/" }], current: "Contact" }}
      />

      <Section>
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-16">
          <div>
            <h2 className="text-h2">Send an enquiry</h2>
            <p className="mt-3 max-w-prose text-body">
              Fields marked with an asterisk are required. The more you can tell us up
              front, the more useful our first reply will be.
            </p>

            <div className="mt-8 max-w-2xl">
              <EnquiryForm sourcePage="/contact" />
            </div>
          </div>

          <aside className="lg:pt-2">
            <h2 className="text-h3">Reach us directly</h2>

            <ul className="mt-6 space-y-5">
              <li className="flex gap-3">
                <PhoneIcon />
                <div>
                  <p className="text-sm font-semibold text-navy-900">Call us</p>
                  <a
                    href={`tel:${contact.phoneHref}`}
                    className="mt-0.5 inline-flex min-h-8 items-center text-[0.9375rem] text-brand-800 underline underline-offset-4"
                  >
                    {contact.phone}
                  </a>
                </div>
              </li>

              <li className="flex gap-3">
                <MailIcon />
                <div>
                  <p className="text-sm font-semibold text-navy-900">Email us</p>
                  <a
                    href={`mailto:${contact.email}`}
                    className="mt-0.5 inline-flex min-h-8 items-center text-[0.9375rem] break-all text-brand-800 underline underline-offset-4"
                  >
                    {contact.email}
                  </a>
                </div>
              </li>

              {contact.offices.map((office) => (
                <li key={office.label} className="flex gap-3">
                  <PinIcon />
                  <div>
                    <p className="text-sm font-semibold text-navy-900">
                      {office.label}
                    </p>
                    <address className="mt-0.5 text-[0.9375rem] text-body not-italic">
                      {office.lines.map((line) => (
                        <span key={line} className="block">
                          {line}
                        </span>
                      ))}
                    </address>
                  </div>
                </li>
              ))}
            </ul>

            <div className="mt-8 rounded-xl border border-border bg-surface-subtle p-5">
              <p className="text-sm text-body">
                Prefer WhatsApp? Message us on{" "}
                <a
                  href={contact.whatsapp}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-semibold text-brand-800 underline underline-offset-4"
                >
                  {contact.phone}
                </a>
                .
              </p>
            </div>
          </aside>
        </div>
      </Section>
    </>
  );
}
