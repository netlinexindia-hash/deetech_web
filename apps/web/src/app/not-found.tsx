import { Button } from "@/components/ui/Button";
import { Section } from "@/components/ui/Section";

export default function NotFound() {
  return (
    <Section className="py-24 md:py-32">
      <div className="mx-auto max-w-xl text-center">
        <p className="text-sm font-semibold tracking-[0.14em] text-brand-800 uppercase">
          404
        </p>
        <h1 className="mt-3 text-h1">We could not find that page</h1>
        <p className="mt-4 text-lead">
          The link may be out of date, or the page may have moved during our site
          rebuild. Try the services index, or get in touch and we will point you in the
          right direction.
        </p>
        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Button href="/">Back to the homepage</Button>
          <Button href="/contact" variant="secondary">
            Contact us
          </Button>
        </div>
      </div>
    </Section>
  );
}
