/**
 * Homepage content, authored during Week 1 Day 5.
 *
 * This module is the temporary stand-in for the CMS. From Week 3 Day 13 the
 * same shapes are returned by `GET /api/v1/services` and friends, and this
 * file is deleted.
 *
 * Everything here is derived from copy that is already live on
 * www.deetechgroup.com (captured in docs/audit/legacy-copy/). Nothing is
 * invented: where the existing site has only placeholder content, the
 * corresponding array below is intentionally empty so the section renders
 * nothing rather than shipping filler. See docs/01-wordpress-audit.md.
 */

export interface ServiceSummary {
  title: string;
  slug: string;
  /** Unique per service — the fix for CQ-3, where all six cards shared one line. */
  summary: string;
}

export const services: ServiceSummary[] = [
  {
    title: "Web Development",
    slug: "web-development",
    summary:
      "Custom websites, web applications and e-commerce platforms, built responsive from the first breakpoint and maintained after launch.",
  },
  {
    title: "Managed IT Services",
    slug: "managed-it-services",
    summary:
      "Proactive monitoring and maintenance that catches problems before they interrupt your working day, with support when something still goes wrong.",
  },
  {
    title: "Network Services",
    slug: "network-services",
    summary:
      "Network design, rollout, security and optimisation — including cloud connectivity — so your sites and staff stay reliably connected.",
  },
  {
    title: "Email Services",
    slug: "email-services",
    summary:
      "Business email hosting, migration, encryption and spam filtering that keep a mission-critical channel available and secure.",
  },
  {
    title: "Web Hosting",
    slug: "web-hosting",
    summary:
      "Shared, cloud and dedicated hosting with backups, monitoring and the headroom to scale when your traffic does.",
  },
];

export interface CapabilityPoint {
  title: string;
  body: string;
}

export const capabilities: CapabilityPoint[] = [
  {
    title: "One partner, the whole stack",
    body: "Development, hosting, email and the network underneath them come from one team, so nothing falls into a gap between suppliers.",
  },
  {
    title: "Built around your business",
    body: "No two businesses run the same way. We scope each engagement against how you actually work, not against a fixed package.",
  },
  {
    title: "Room to grow",
    body: "From a first website to systems carrying real load, what we build is designed to be extended rather than replaced.",
  },
];

export interface Testimonial {
  quote: string;
  name: string;
  role: string;
}

/**
 * Carried over verbatim from the About page of the live site. Permission to
 * publish is marked [NEEDS ADMIN] in the Day 1 audit — confirm before launch.
 */
export const testimonials: Testimonial[] = [
  {
    quote:
      "I can't express how satisfied I am with DeeTech Group's managed IT services. They've made managing our IT infrastructure a breeze. Their proactive approach to maintenance and their prompt support for any issues have kept our operations running smoothly.",
    name: "Raj Kumar",
    role: "CEO, Fast Track Money Service Pvt. Ltd.",
  },
  {
    quote:
      "As a small business owner, I needed reliable network and email services. DeeTech Group delivered on all fronts. Their network solutions have improved our connectivity, and their email services are both secure and efficient.",
    name: "Abhinav Chalana",
    role: "MD, Skyline Construction and Advisers",
  },
  {
    quote:
      "DeeTech Group has been an invaluable partner in my business's growth. Their web development services took my online presence to the next level. The website they created is not only visually stunning but also incredibly user-friendly.",
    name: "Anil Maurya",
    role: "MD, Loan4wish",
  },
];

export interface FeaturedBrand {
  name: string;
  slug: string;
  relationshipLabel: string;
  summary: string;
}

/**
 * EMPTY ON PURPOSE.
 *
 * AnPreD and InfraShield appear nowhere on the current website, so there is
 * no source for their names, positioning or legal relationship to the group.
 * The section below renders nothing while this is empty. Fill it on Day 8,
 * once the owner has supplied the details and — critically — confirmed the
 * correct `relationshipLabel` wording. Do not guess "subsidiary".
 */
export const featuredBrands: FeaturedBrand[] = [];

/**
 * EMPTY ON PURPOSE.
 *
 * The live site's counters all read "0 +" and its six portfolio tiles share
 * one duplicated description (CQ-4, CQ-5). Shipping either would mean
 * publishing numbers and case studies that do not exist. Populate once real
 * figures and real projects are supplied.
 */
export const stats: { value: string; label: string }[] = [];
