import Image from "next/image";
import Link from "next/link";
import mark from "../../../public/brand/deetech-mark.png";
import { cn } from "@/lib/cn";

/**
 * The brand mark is a square Penrose-triangle device. The words "Dee", "Tech"
 * and "Group" are written along its ribbons but are illegible below roughly
 * 120px, so the header and footer pair it with a typeset wordmark rather than
 * relying on the artwork to carry the name.
 *
 * Source artwork: assets/brand/Deetech-logo.png (661x606, raster).
 * Regenerate the trimmed mark and the favicon set with:
 *   python assets/brand/build-icons.py
 */
export function Logo({
  className,
  tone = "light",
  showWordmark = true,
}: {
  className?: string;
  /** `light` = dark text for light backgrounds; `dark` = white text. */
  tone?: "light" | "dark";
  showWordmark?: boolean;
}) {
  return (
    <Link
      href="/"
      className={cn("inline-flex items-center gap-2.5", className)}
      aria-label="DeeTech Group — go to the homepage"
    >
      <Image
        src={mark}
        alt=""
        width={555}
        height={533}
        priority
        sizes="48px"
        className="h-10 w-auto sm:h-11"
      />

      {showWordmark ? (
        <span className="flex flex-col leading-none">
          <span
            className={cn(
              "text-lg font-bold tracking-tight sm:text-xl",
              tone === "dark" ? "text-white" : "text-navy-900",
            )}
          >
            DeeTech Group
          </span>
          <span
            className={cn(
              "mt-1 text-[0.625rem] font-semibold tracking-[0.18em] uppercase",
              tone === "dark" ? "text-navy-300" : "text-muted",
            )}
          >
            Make IT Possible
          </span>
        </span>
      ) : null}
    </Link>
  );
}
