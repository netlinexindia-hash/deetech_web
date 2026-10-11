"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Logo } from "@/components/layout/Logo";
import { cn } from "@/lib/cn";
import { contact, primaryNav, type NavItem } from "@/lib/site";

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

function ChevronDown({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 20 20"
      aria-hidden="true"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 8l5 5 5-5" />
    </svg>
  );
}

/** Desktop dropdown. Opens on hover *and* on click, closes on Escape. */
function NavDropdown({ item, pathname }: { item: NavItem; pathname: string }) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    function onPointerDown(event: PointerEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false);
    }

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  return (
    <div
      ref={wrapperRef}
      className="relative"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((value) => !value)}
        className={cn(
          "inline-flex items-center gap-1 rounded-md px-3 py-2 text-[0.9375rem] font-medium transition-colors",
          isActive(pathname, item.href)
            ? "text-brand-800"
            : "text-navy-800 hover:text-brand-800",
        )}
      >
        {item.label}
        <ChevronDown
          className={cn("size-4 transition-transform", open && "rotate-180")}
        />
      </button>

      <div
        id={menuId}
        className={cn(
          "absolute top-full left-0 z-50 w-80 pt-2",
          open ? "block" : "hidden",
        )}
      >
        <ul className="rounded-xl border border-border bg-white p-2 shadow-overlay">
          {item.children?.map((child) => (
            <li key={child.href}>
              <Link
                href={child.href}
                onClick={() => setOpen(false)}
                className="block min-h-11 rounded-lg px-3 py-2.5 hover:bg-brand-50"
              >
                <span className="block text-[0.9375rem] font-semibold text-navy-900">
                  {child.label}
                </span>
                {child.description ? (
                  <span className="mt-0.5 block text-sm text-muted">
                    {child.description}
                  </span>
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function Header() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const drawerId = useId();

  const closeMenu = useCallback(() => {
    setMenuOpen(false);
    toggleRef.current?.focus();
  }, []);

  /**
   * Closing on navigation is done in the links' own onClick rather than in an
   * effect on `pathname`. An effect would set state during render-commit on
   * every route change and trigger a cascading render; the click is the real
   * cause, so that is where the state change belongs.
   */
  const closeMenuWithoutRefocus = useCallback(() => setMenuOpen(false), []);

  // Escape closes; focus is trapped inside the drawer; the page behind it
  // does not scroll.
  useEffect(() => {
    if (!menuOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeMenu();
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = drawerRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable || focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (!first || !last) return;

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    drawerRef.current?.querySelector<HTMLElement>("a, button")?.focus();

    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [menuOpen, closeMenu]);

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-border bg-white/95 backdrop-blur supports-[backdrop-filter]:bg-white/80">
        <div className="container-page flex h-18 items-center justify-between gap-4">
          <Logo className="shrink-0" />

          <nav aria-label="Primary" className="hidden lg:block">
            <ul className="flex items-center gap-1">
              {primaryNav.map((item) =>
                item.children ? (
                  <li key={item.href}>
                    <NavDropdown item={item} pathname={pathname} />
                  </li>
                ) : (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={isActive(pathname, item.href) ? "page" : undefined}
                      className={cn(
                        "inline-flex items-center rounded-md px-3 py-2 text-[0.9375rem] font-medium transition-colors",
                        isActive(pathname, item.href)
                          ? "text-brand-800"
                          : "text-navy-800 hover:text-brand-800",
                      )}
                    >
                      {item.label}
                    </Link>
                  </li>
                ),
              )}
            </ul>
          </nav>

          <div className="hidden items-center gap-3 lg:flex">
            <a
              href={`tel:${contact.phoneHref}`}
              className="inline-flex min-h-11 items-center text-sm font-medium text-navy-700 hover:text-brand-800"
            >
              {contact.phone}
            </a>
            <Button href="/contact" size="sm">
              Get a quote
            </Button>
          </div>

          <button
            ref={toggleRef}
            type="button"
            aria-expanded={menuOpen}
            aria-controls={drawerId}
            onClick={() => setMenuOpen((value) => !value)}
            className="-mr-2 inline-flex size-11 items-center justify-center rounded-lg text-navy-800 hover:bg-navy-50 lg:hidden"
          >
            <span className="sr-only">{menuOpen ? "Close menu" : "Open menu"}</span>
            <svg
              viewBox="0 0 24 24"
              aria-hidden="true"
              className="size-6"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              {menuOpen ? (
                <path d="M6 6l12 12M18 6L6 18" />
              ) : (
                <path d="M4 7h16M4 12h16M4 17h16" />
              )}
            </svg>
          </button>
        </div>
      </header>

      {/* The drawer sits OUTSIDE <header> on purpose. `backdrop-blur` makes the
          header a containing block for fixed-position descendants, which would
          collapse `inset-x-0 top-18 bottom-0` to the header's own 72px box. */}
      {menuOpen ? (
        <>
          <div
            className="fixed inset-0 top-18 z-40 bg-navy-950/40 lg:hidden"
            onClick={closeMenu}
            aria-hidden="true"
          />
          <div
            ref={drawerRef}
            id={drawerId}
            role="dialog"
            aria-modal="true"
            aria-label="Site menu"
            className="fixed inset-x-0 top-18 bottom-0 z-50 overflow-y-auto border-t border-border bg-white lg:hidden"
          >
            <nav aria-label="Primary (mobile)" className="container-page py-6">
              <ul className="space-y-1">
                {primaryNav.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={closeMenuWithoutRefocus}
                      aria-current={isActive(pathname, item.href) ? "page" : undefined}
                      className={cn(
                        "flex min-h-11 items-center rounded-lg px-3 text-base font-semibold",
                        isActive(pathname, item.href)
                          ? "bg-brand-50 text-brand-800"
                          : "text-navy-900 hover:bg-navy-50",
                      )}
                    >
                      {item.label}
                    </Link>

                    {item.children ? (
                      <ul className="mt-1 mb-2 ml-3 space-y-0.5 border-l border-border pl-3">
                        {item.children.map((child) => (
                          <li key={child.href}>
                            <Link
                              href={child.href}
                              onClick={closeMenuWithoutRefocus}
                              className="flex min-h-11 items-center rounded-lg px-3 text-[0.9375rem] text-body hover:bg-navy-50"
                            >
                              {child.label}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </li>
                ))}
              </ul>

              <div className="mt-6 space-y-3 border-t border-border pt-6">
                <Button
                  href="/contact"
                  size="lg"
                  className="w-full"
                  onClick={closeMenuWithoutRefocus}
                >
                  Get a quote
                </Button>
                <a
                  href={`tel:${contact.phoneHref}`}
                  className="flex min-h-11 items-center justify-center rounded-lg border border-border text-[0.9375rem] font-semibold text-navy-800"
                >
                  Call {contact.phone}
                </a>
              </div>
            </nav>
          </div>
        </>
      ) : null}
    </>
  );
}
