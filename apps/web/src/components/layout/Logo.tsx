import Image from "next/image";
import Link from "next/link";
import logo from "../../../public/brand/deetech-logo.png";

/**
 * The raster logo is the highest-resolution copy available on the current
 * site (243x79). Replace `public/brand/deetech-logo.png` with the vector
 * source once it is supplied — see "[NEEDS ADMIN]" in docs/01-wordpress-audit.md.
 */
export function Logo({ className }: { className?: string }) {
  return (
    <Link
      href="/"
      className={className}
      aria-label="DeeTech Group — go to the homepage"
    >
      <Image
        src={logo}
        alt="DeeTech Group"
        width={243}
        height={79}
        priority
        className="h-10 w-auto sm:h-11"
      />
    </Link>
  );
}
