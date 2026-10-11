import type { Service } from "@deetech/shared-types";

/**
 * The five services, rewritten from the live WordPress pages captured in
 * docs/audit/legacy-copy/.
 *
 * Corrections applied against the Day 1 audit (docs/01-wordpress-audit.md):
 *   CQ-1/CQ-16  "MyZeon Tech" removed from the Managed IT and Network intros.
 *   CQ-3        every `summary` is unique; the legacy site shipped one
 *               identical sentence on all six cards.
 *   CQ-14       "Network Service"/"Email service" pluralised and cased
 *               consistently.
 *   CQ-15       Managed IT Services no longer lists web-development
 *               deliverables under "Our Web Development Services Include".
 *   CQ-17       the "why choose us" blocks for Network Services and Web
 *               Hosting no longer repeat the web-development text.
 *   CQ-18       "Dee Tech Group" / "DeeTech Group" normalised to "DeeTech Group".
 *   SEO-2/SEO-8 every service has a distinct seoTitle and seoDescription.
 *
 * These are the Week 3 seed rows for the `services` table.
 */

const now = "2026-10-11T00:00:00.000Z";

export const services: Service[] = [
  {
    id: 1,
    title: "Web Development",
    slug: "web-development",
    summary:
      "Custom websites, web applications and e-commerce platforms, built responsive from the first breakpoint and maintained after launch.",
    intro:
      "Our web development team turns an idea into something people can actually use. We design and build websites and applications that match how your business works — whether that is a corporate site that has to make a first impression, or an e-commerce platform that has to take orders reliably at 2am.",
    benefits: [
      {
        title: "Front to back",
        body: "Responsive interfaces and the server-side systems behind them, built by the same team, so nothing is lost in a handover.",
      },
      {
        title: "Built for your business",
        body: "No two businesses work the same way. We scope against how yours actually operates rather than fitting you to a template.",
      },
      {
        title: "Room to grow",
        body: "A first website and a system carrying real load need different foundations. We build so the second does not mean starting again.",
      },
    ],
    inclusions: [
      {
        title: "Custom website development",
        body: "Built from the ground up against your goals, rather than assembled from a theme.",
      },
      {
        title: "Content management",
        body: "An admin area your team can use to update pages, posts and media without calling us.",
      },
      {
        title: "E-commerce",
        body: "Catalogue, checkout and payment integration, with the order flow built around your fulfilment process.",
      },
      {
        title: "Responsive design",
        body: "Tested at phone, tablet and desktop widths — not scaled down and hoped for.",
      },
      {
        title: "Maintenance and support",
        body: "Dependency updates, security patches and changes after launch, so the site does not quietly rot.",
      },
    ],
    imageUrl: null,
    status: "published",
    sortOrder: 1,
    seoTitle: "Web Development Services",
    seoDescription:
      "Custom website, web application and e-commerce development from DeeTech Group — responsive, maintainable, and supported after launch. Based in Noida, serving businesses across India.",
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 2,
    title: "Managed IT Services",
    slug: "managed-it-services",
    summary:
      "Proactive monitoring and maintenance that catches problems before they interrupt your working day, with real support when something still goes wrong.",
    intro:
      "Businesses depend on their technology more every year, and keeping it running is a job in itself. Our managed IT services take that job on: we monitor and maintain your systems continuously, so most problems are dealt with before anyone in your team notices them.",
    benefits: [
      {
        title: "Prevention over cure",
        body: "Continuous monitoring and scheduled maintenance, so issues are found and fixed before they turn into downtime.",
      },
      {
        title: "One number to call",
        body: "When something does break, you reach people who already know your setup — not a queue that starts from scratch.",
      },
      {
        title: "Predictable cost",
        body: "A managed arrangement instead of unplanned emergency call-outs, so IT spend stops being a surprise.",
      },
    ],
    inclusions: [
      {
        title: "Monitoring and alerting",
        body: "Servers, endpoints and critical services watched continuously, with alerts routed to our team.",
      },
      {
        title: "Patching and updates",
        body: "Operating systems and software kept current on a schedule, so known vulnerabilities do not sit open.",
      },
      {
        title: "Backup and recovery",
        body: "Backups configured, verified and periodically restored — because a backup nobody has tested is a guess.",
      },
      {
        title: "Helpdesk support",
        body: "Day-to-day support for your staff, from a password reset to a failing workstation.",
      },
      {
        title: "Asset and licence tracking",
        body: "A current picture of what hardware and software you have, and when each needs attention.",
      },
    ],
    imageUrl: null,
    status: "published",
    sortOrder: 2,
    seoTitle: "Managed IT Services and Support",
    seoDescription:
      "Proactive IT monitoring, patching, backup and helpdesk support from DeeTech Group. Problems found before they cause downtime, with predictable monthly cost.",
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 3,
    title: "Network Services",
    slug: "network-services",
    summary:
      "Network design, rollout, security and optimisation — including cloud connectivity — so your sites and staff stay reliably connected.",
    intro:
      "A reliable network is the thing everything else sits on, and it is invisible right up until it is not. We design, build and secure business networks: wired and wireless, single site or several, on-premises or extended into the cloud.",
    benefits: [
      {
        title: "Designed, not grown",
        body: "Networks that accumulate by accident become impossible to troubleshoot. We design the topology deliberately and document it.",
      },
      {
        title: "Secured by default",
        body: "Segmentation, firewall rules and access control are part of the build, not something bolted on afterwards.",
      },
      {
        title: "Measured, then tuned",
        body: "We establish what performance you are actually getting before changing anything, so improvements are demonstrable.",
      },
    ],
    inclusions: [
      {
        title: "Network design and rollout",
        body: "Topology, hardware selection, cabling and configuration for new sites or refits.",
      },
      {
        title: "Network security",
        body: "Firewalls, segmentation and access control to limit what an incident can reach.",
      },
      {
        title: "Cloud connectivity",
        body: "Connecting your sites to cloud services and to each other, with the flexibility to scale.",
      },
      {
        title: "Performance optimisation",
        body: "Finding and removing the bottlenecks that make a nominally fast connection feel slow.",
      },
      {
        title: "Ongoing monitoring",
        body: "Continuous visibility of link health and capacity, so congestion is caught before it is reported.",
      },
    ],
    imageUrl: null,
    status: "published",
    sortOrder: 3,
    seoTitle: "Business Network Services and Security",
    seoDescription:
      "Network design, rollout, segmentation, cloud connectivity and performance tuning for businesses, from DeeTech Group in Noida.",
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 4,
    title: "Email Services",
    slug: "email-services",
    summary:
      "Business email hosting, migration, encryption and spam filtering that keep a mission-critical channel available and secure.",
    intro:
      "Email is still where most business actually happens, which makes it both critical and a target. We set up, secure and run business email: hosting on your own domain, migration from whatever you are on now, and the filtering and encryption that keep it trustworthy.",
    benefits: [
      {
        title: "Availability first",
        body: "Email going down stops work. We run it on infrastructure built for uptime, and we monitor it.",
      },
      {
        title: "Secure in transit and at rest",
        body: "Encryption, authentication records and sensible retention, so your correspondence is not casually readable.",
      },
      {
        title: "Migration without a gap",
        body: "Moving providers is where mailboxes get lost. We plan the cutover so history and addresses survive it.",
      },
    ],
    inclusions: [
      {
        title: "Business email hosting",
        body: "Mailboxes on your own domain, with the storage and aliases your team actually needs.",
      },
      {
        title: "Spam and phishing protection",
        body: "Filtering that cuts the noise and catches the messages designed to fool your staff.",
      },
      {
        title: "Encrypted delivery",
        body: "Transport encryption and domain authentication records configured correctly, not left at defaults.",
      },
      {
        title: "Migration",
        body: "Mailboxes, folders and history moved from your current provider with a planned cutover.",
      },
      {
        title: "Collaboration tools",
        body: "Shared calendars, contacts and mailboxes where your team works that way.",
      },
    ],
    imageUrl: null,
    status: "published",
    sortOrder: 4,
    seoTitle: "Business Email Hosting, Security and Migration",
    seoDescription:
      "Business email on your own domain, with spam and phishing protection, encrypted delivery and planned migration from your current provider.",
    createdAt: now,
    updatedAt: now,
  },
  {
    id: 5,
    title: "Web Hosting",
    slug: "web-hosting",
    summary:
      "Shared, cloud and dedicated hosting with backups, monitoring and the headroom to scale when your traffic does.",
    intro:
      "Hosting is the part of your website nobody thinks about until it is slow or offline. We host sites and applications on infrastructure sized to what they actually do, with backups and monitoring included rather than sold separately.",
    benefits: [
      {
        title: "Sized to the workload",
        body: "A brochure site and a busy application have different needs. We recommend the tier that fits, not the biggest one.",
      },
      {
        title: "Backed up and monitored",
        body: "Regular backups and uptime monitoring come as part of the service, not as an add-on you discover you needed.",
      },
      {
        title: "Room to move",
        body: "Traffic is rarely flat. Plans can scale up as demand grows, without rebuilding from scratch.",
      },
    ],
    inclusions: [
      {
        title: "Shared hosting",
        body: "A cost-effective starting point for brochure sites and early-stage projects.",
      },
      {
        title: "Cloud hosting",
        body: "Resources that flex with demand, for sites with uneven or growing traffic.",
      },
      {
        title: "Dedicated servers",
        body: "Full control and reserved resources for high-traffic sites and heavier applications.",
      },
      {
        title: "Backups and restores",
        body: "Scheduled backups kept off the serving host, with restores tested rather than assumed.",
      },
      {
        title: "Uptime monitoring",
        body: "Continuous checks so an outage is noticed by us, not reported by your customers.",
      },
    ],
    imageUrl: null,
    status: "published",
    sortOrder: 5,
    seoTitle: "Web Hosting — Shared, Cloud and Dedicated",
    seoDescription:
      "Managed web hosting from DeeTech Group: shared, cloud and dedicated plans with backups, uptime monitoring and room to scale.",
    createdAt: now,
    updatedAt: now,
  },
];
