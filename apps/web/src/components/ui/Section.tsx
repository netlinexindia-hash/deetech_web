import type { ElementType, ReactNode } from "react";
import { cn } from "@/lib/cn";

export function Container({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return <div className={cn("container-page", className)}>{children}</div>;
}

type SectionTone = "default" | "subtle" | "navy" | "brand";

const tones: Record<SectionTone, string> = {
  default: "bg-white",
  subtle: "bg-surface-subtle",
  navy: "bg-navy-900 text-navy-100",
  brand: "bg-brand-800 text-white",
};

/**
 * One vertical rhythm for the whole site: py-16 / md:py-24 / lg:py-28.
 * Pages compose Sections rather than inventing their own spacing.
 */
export function Section({
  as: Tag = "section",
  tone = "default",
  className,
  containerClassName,
  id,
  children,
}: {
  as?: ElementType;
  tone?: SectionTone;
  className?: string;
  containerClassName?: string;
  id?: string;
  children: ReactNode;
}) {
  return (
    <Tag id={id} className={cn("py-16 md:py-24 lg:py-28", tones[tone], className)}>
      <Container className={containerClassName}>{children}</Container>
    </Tag>
  );
}

/**
 * Eyebrow + heading + lead. `level` keeps the heading hierarchy correct —
 * a section heading on a page that already has an h1 must be an h2.
 */
export function SectionHeading({
  eyebrow,
  title,
  lead,
  level = 2,
  align = "left",
  tone = "default",
  className,
}: {
  eyebrow?: string;
  title: string;
  lead?: string;
  level?: 1 | 2 | 3;
  align?: "left" | "center";
  tone?: "default" | "inverse";
  className?: string;
}) {
  const Heading = `h${level}` as ElementType;
  const inverse = tone === "inverse";

  return (
    <div
      className={cn(
        "max-w-2xl",
        align === "center" && "mx-auto text-center",
        className,
      )}
    >
      {eyebrow ? (
        <p
          className={cn(
            "mb-3 text-sm font-semibold tracking-[0.14em] uppercase",
            inverse ? "text-brand-200" : "text-brand-800",
          )}
        >
          {eyebrow}
        </p>
      ) : null}

      <Heading
        className={cn(level === 1 ? "text-h1" : "text-h2", inverse && "text-white")}
      >
        {title}
      </Heading>

      {lead ? (
        <p className={cn("mt-4 text-lead", inverse ? "text-navy-200" : "text-body")}>
          {lead}
        </p>
      ) : null}
    </div>
  );
}
