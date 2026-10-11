import { Button } from "@/components/ui/Button";
import { Section } from "@/components/ui/Section";
import { contact } from "@/lib/site";

/**
 * The quote / contact call to action that closes every public page.
 *
 * One component rather than a copy per page, so the wording and the
 * destination stay consistent — the legacy site had a different CTA on
 * almost every page, one of which was an unfinished sentence (CQ-12).
 */
export function CTABand({
  title = "Tell us what you are trying to build",
  lead,
  primaryLabel = "Get a quote",
}: {
  title?: string;
  lead?: string;
  primaryLabel?: string;
}) {
  return (
    <Section tone="navy" className="py-14 md:py-20 lg:py-24">
      <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
        <div className="max-w-2xl">
          <h2 className="text-h2 text-white">{title}</h2>
          <p className="mt-4 text-lead text-navy-200">
            {lead ??
              `Send over the details and we will come back with a scope, a timeline and a price. ${contact.responseTime}`}
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row lg:shrink-0">
          <Button href="/contact" size="lg" variant="inverse">
            {primaryLabel}
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
  );
}
