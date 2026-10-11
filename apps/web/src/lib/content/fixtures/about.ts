/**
 * About page content, rewritten from the live WordPress About page
 * (docs/audit/legacy-copy/page-about.txt).
 *
 * Deliberately omitted, because the source is self-contradictory or
 * unverified — see docs/01-wordpress-audit.md:
 *
 *   CQ-6   The company's age. The legacy page says "over seven years" in one
 *          paragraph and "over the past 4 years" in the next. No year count
 *          appears below until the owner confirms which is right.
 *   CQ-5   The stat counters, which all read "0 +" on the live site.
 *   CQ-9   Three of the four team members look like placeholders ("Jhin",
 *          "Jhan Stalker", and "AK" whose bio describes a different person).
 *          `team` is empty until the real roster is confirmed.
 *   CQ-13  The partner logo strip, which uses generic brand-1..7.png files.
 *
 * Corrected: "MyZeon Tech" removed (CQ-1), "Vission" spelled correctly and
 * the truncated "...through innovatio" sentence completed (CQ-7), and the
 * duplicated 70-word paragraph under both Mission and Vision replaced with
 * distinct text (CQ-8).
 */

export const aboutIntro = {
  eyebrow: "About the group",
  title: "A technology partner, not just a supplier",
  lead: "DeeTech Group is a technology solutions provider working with businesses that need their systems to be dependable. We build and run websites and applications, manage IT and networks, and host the email and infrastructure underneath them.",
  body: [
    "Most of our clients come to us because they are coordinating too many suppliers. One company built the website, another manages the laptops, a third handles email, and when something goes wrong each one points at the others. We do all of it, which means when something breaks there is one team accountable for finding out why.",
    "We work across web development, managed IT, network services, business email and hosting. Those services are sold separately and work well on their own — but they were designed to fit together, and most of the value shows up when they do.",
  ],
};

export const mission = {
  title: "Our mission",
  summary:
    "To use technology to make our clients' businesses measurably easier to run.",
  body: "That means being judged on whether your systems are reliable, your staff are unblocked and your costs are predictable — not on how impressive the technology is. We would rather deliver something simple that runs for five years without attention than something clever that needs us every month.",
};

export const vision = {
  title: "Our vision",
  summary:
    "To be the technology partner our clients call first, and keep earning that position.",
  body: 'We want to be the team a client thinks of before they have fully defined the problem — trusted enough to be asked "is this a good idea?" and not only "can you build this?". That is earned through consistency over years, not won in a pitch.',
};

export interface Value {
  title: string;
  body: string;
}

export const values: Value[] = [
  {
    title: "Say what is actually true",
    body: "If a deadline is at risk or an approach is wrong, you hear it from us early. Bad news does not improve with age.",
  },
  {
    title: "Build it to be handed over",
    body: "Documented, conventional, and maintainable by somebody who is not us. You should never be locked in by obscurity.",
  },
  {
    title: "Security is not a phase",
    body: "Patching, backups, access control and least privilege are part of how we build, not a review at the end.",
  },
  {
    title: "Test the restore",
    body: "A backup nobody has restored is a guess. We verify the things that are supposed to save you.",
  },
];

export interface TeamMember {
  name: string;
  role: string;
  bio: string;
  photoUrl: string | null;
}

/**
 * EMPTY ON PURPOSE — see CQ-9 above. The section renders nothing while this
 * is empty. Supply the real roster to turn it on; no template work is needed.
 */
export const team: TeamMember[] = [];

/** EMPTY ON PURPOSE — see CQ-5 above. */
export const stats: { value: string; label: string }[] = [];

/**
 * EMPTY ON PURPOSE — the legacy "years of journey" narrative is built on the
 * contradictory year count in CQ-6. Populate once the founding year is
 * confirmed.
 */
export const milestones: { year: string; title: string; body: string }[] = [];
