import { Button } from "@/components/ui/Button";
import { Container } from "@/components/ui/Section";
import { contact } from "@/lib/site";

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-navy-950">
      {/* Decoration only: CSS gradients instead of the ~15 decorative PNGs the
          legacy Elementor homepage loaded. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(60rem 30rem at 15% -10%, rgb(53 122 209 / 0.35), transparent 60%), radial-gradient(40rem 24rem at 95% 0%, rgb(124 182 51 / 0.14), transparent 60%)",
        }}
      />

      <Container className="relative py-20 md:py-28 lg:py-32">
        <div className="max-w-3xl">
          <p className="mb-5 inline-flex items-center rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-sm font-medium text-brand-200">
            {contact.responseTime}
          </p>

          <h1 className="text-display text-white">
            Technology that moves your business forward
          </h1>

          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-navy-200 md:text-xl">
            DeeTech Group builds and runs the systems businesses depend on — websites
            and web applications, managed IT, networks, business email and hosting —
            with one team accountable for all of it.
          </p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Button href="/contact" size="lg" variant="inverse">
              Get a quote
            </Button>
            <Button
              href="/services"
              size="lg"
              variant="ghost"
              className="text-white hover:bg-white/10"
            >
              Explore our services
            </Button>
          </div>

          <p className="mt-8 text-sm text-navy-300">
            Prefer to talk?{" "}
            <a
              href={`tel:${contact.phoneHref}`}
              className="font-semibold text-white underline underline-offset-4 hover:text-brand-200"
            >
              {contact.phone}
            </a>
          </p>
        </div>
      </Container>
    </section>
  );
}
