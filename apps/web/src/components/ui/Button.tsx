import Link from "next/link";
import type { ComponentPropsWithoutRef, ReactNode } from "react";
import { cn } from "@/lib/cn";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "inverse";
export type ButtonSize = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 rounded-lg font-semibold " +
  "transition-colors duration-150 " +
  // 44px minimum tap target, per the accessibility rules in the design system.
  "min-h-11 " +
  "disabled:pointer-events-none disabled:opacity-50";

const variants: Record<ButtonVariant, string> = {
  // brand-700 is the lightest cyan that carries white text at 4.58:1. The
  // logo cyan itself (brand-500) is 2.37:1 and is never used as a surface
  // behind text.
  primary: "bg-brand-700 text-white hover:bg-brand-800 active:bg-brand-900",
  secondary:
    "border border-navy-200 bg-white text-navy-800 hover:border-brand-400 hover:bg-brand-50",
  ghost: "text-navy-800 hover:bg-navy-50",
  inverse: "bg-white text-navy-900 hover:bg-navy-50",
};

const sizes: Record<ButtonSize, string> = {
  sm: "px-3.5 py-2 text-sm",
  md: "px-5 py-2.5 text-[0.9375rem]",
  lg: "px-6 py-3 text-base",
};

interface StyleProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  children: ReactNode;
}

type LinkRest = Omit<
  ComponentPropsWithoutRef<typeof Link>,
  "href" | "className" | "children"
>;

type NativeRest = Omit<ComponentPropsWithoutRef<"button">, "className" | "children">;

export type ButtonProps =
  | (StyleProps & { href: string } & LinkRest)
  | (StyleProps & { href?: undefined } & NativeRest);

/**
 * Renders a `<Link>` when `href` is supplied and a `<button>` otherwise, so a
 * navigation control is never faked with a click handler on a button.
 */
export function Button({
  variant = "primary",
  size = "md",
  className,
  children,
  ...rest
}: ButtonProps) {
  const classes = cn(base, variants[variant], sizes[size], className);

  if (rest.href !== undefined) {
    const { href, ...linkProps } = rest as { href: string } & LinkRest;
    return (
      <Link href={href} className={classes} {...linkProps}>
        {children}
      </Link>
    );
  }

  const { type = "button", ...buttonProps } = rest as NativeRest;
  return (
    <button type={type} className={classes} {...buttonProps}>
      {children}
    </button>
  );
}
