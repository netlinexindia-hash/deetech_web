/**
 * Site-wide constants: navigation, contact details and canonical metadata.
 *
 * Contact details are kept here rather than in page markup so there is one
 * place to change them.
 */

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const site = {
  name: "DeeTech Group",
  legalName: "DeeTech Group",
  tagline: "Make IT Possible",
  description:
    "DeeTech Group delivers web development, managed IT, network, email and hosting services for businesses across India. Talk to us about your next project.",
  url: SITE_URL,
  locale: "en_IN",
} as const;

/**
 * E.164, and the only place the digits are written.
 *
 * The display format and the WhatsApp link both derive from this. They used
 * to repeat the digits, so changing the number meant editing three strings
 * and noticing all three.
 *
 * Assumes an Indian mobile: +91 and ten national digits, displayed 5 + 5.
 * A number in another format needs `phone` spelled out instead.
 */
const PHONE_E164 = "+919464204018";
const PHONE_NATIONAL = PHONE_E164.slice(3);

export const contact = {
  phone: `+91 ${PHONE_NATIONAL.slice(0, 5)} ${PHONE_NATIONAL.slice(5)}`,
  /** E.164, for tel: and WhatsApp links. */
  phoneHref: PHONE_E164,
  email: "support@deetechgroup.com",
  /** wa.me takes the E.164 digits with no leading `+`. */
  whatsapp: `https://wa.me/${PHONE_E164.slice(1)}`,
  offices: [
    {
      label: "Office",
      lines: ["A-47, A Block, Sector 2", "Noida, Uttar Pradesh 201301"],
    },
    {
      label: "Registered address",
      lines: ["H.N. 1, Siau, Chandpur", "Bijnor, Uttar Pradesh 246725"],
    },
  ],
  responseTime: "We answer every enquiry within one working day.",
} as const;

export interface NavItem {
  label: string;
  href: string;
  description?: string;
  children?: NavItem[];
}

/**
 * Primary navigation. The service children mirror the five services that
 * exist today; from Week 3 this list is sourced from the CMS instead.
 */
export const primaryNav: NavItem[] = [
  {
    label: "Services",
    href: "/services",
    children: [
      {
        label: "Web Development",
        href: "/services/web-development",
        description: "Custom websites, web apps and e-commerce platforms.",
      },
      {
        label: "Managed IT Services",
        href: "/services/managed-it-services",
        description: "Proactive monitoring and day-to-day IT support.",
      },
      {
        label: "Network Services",
        href: "/services/network-services",
        description: "Design, rollout and security for business networks.",
      },
      {
        label: "Email Services",
        href: "/services/email-services",
        description: "Business email setup, security and migration.",
      },
      {
        label: "Web Hosting",
        href: "/services/web-hosting",
        description: "Managed hosting with backups and monitoring.",
      },
      { label: "All services", href: "/services" },
    ],
  },
  { label: "Brands", href: "/brands" },
  { label: "Products", href: "/products" },
  { label: "About", href: "/about" },
  { label: "Blog", href: "/blog" },
  { label: "Contact", href: "/contact" },
];

export const footerNav = {
  services: primaryNav[0]?.children?.slice(0, 5) ?? [],
  company: [
    { label: "About", href: "/about" },
    { label: "Brands", href: "/brands" },
    { label: "Products", href: "/products" },
    { label: "Blog", href: "/blog" },
    { label: "Contact", href: "/contact" },
  ] satisfies NavItem[],
  legal: [
    { label: "Privacy policy", href: "/privacy-policy" },
    { label: "Terms of use", href: "/terms" },
  ] satisfies NavItem[],
};
