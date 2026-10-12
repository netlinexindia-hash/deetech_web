-- 004 — legal pages
--
-- The footer links to /privacy-policy and /terms. Both were 404ing.
--
-- ⚠ THESE ARE DRAFTS AND HAVE NOT BEEN REVIEWED BY A LAWYER.
--
-- They are written to describe accurately what this system actually does —
-- which data the contact form collects, what is stored, what is not, and for
-- how long — rather than being copied from a generic template that claims
-- practices the site does not follow. That makes them a sound starting point
-- and a useful briefing document, but a qualified adviser must review them
-- before launch, particularly for India's Digital Personal Data Protection
-- Act 2023.
--
-- Every factual claim below is checkable against the code:
--   * contact_enquiries columns              → database/migrations/0001
--   * the IP is HMAC-hashed, never stored raw → apps/api/src/services/hash.ts
--   * fonts are self-hosted, no CDN request   → apps/web/src/app/layout.tsx
--   * no analytics is configured              → .env.example
-- If any of those change, this copy has to change with them.
--
-- Published as drafts is deliberate — see the status column. Publish them
-- from the CMS once they have been reviewed.

INSERT INTO pages (title, slug, body, status, published_at, seo_title, seo_description)
VALUES (
  'Privacy policy',
  'privacy-policy',
  '**Draft — pending legal review.** This describes how DeeTech Group handles personal information on this website.

Last reviewed: 12 October 2026.

## Who we are

DeeTech Group, A-47, A Block, Sector 2, Noida, Uttar Pradesh 201301, India. You can reach us at [support@deetechgroup.com](mailto:support@deetechgroup.com) or +91 94642 04018.

## What this website collects

**If you submit the contact form**, we receive and store: your name, your email address, and the subject and message you wrote. If you choose to fill them in, we also store your company name and phone number. We record which page you submitted from, the date and time, and a one-way cryptographic hash of your IP address.

We store a hash of your IP rather than the address itself. It lets us recognise repeated submissions from one source and limit automated abuse, without us holding an identifier we have no other use for.

**If you only browse the site**, we collect nothing. There is no analytics service, no advertising pixel, and no third-party tracking on this website. Fonts are served from our own servers, so loading a page does not tell any other company that you visited.

## Cookies

The public website sets no cookies.

Our content management system at `/admin` sets one session cookie, but only for staff who sign in. It is not set for visitors.

## Why we hold it, and for how long

We use what you send through the contact form for one purpose: to answer your enquiry and, if it leads to work, to carry out that work. We do not sell it, and we do not use it for marketing you did not ask for.

We keep enquiries while they are useful for the relationship they relate to, and we review and remove old ones periodically.

## Who else sees it

Your enquiry is emailed to our own support address and stored on our own servers. We do not share it with third parties for their own purposes.

We use a small number of suppliers to run the site — hosting and email delivery — who necessarily handle the data in order to provide those services, and who are not permitted to use it for anything else.

## Your rights

You can ask us what we hold about you, ask us to correct it, or ask us to delete it. Email [support@deetechgroup.com](mailto:support@deetechgroup.com) and we will respond.

## Changes

If we change how we handle personal information, we will update this page and the date at the top.',
  'draft',
  NULL,
  'Privacy policy',
  'How DeeTech Group handles personal information submitted through this website: what the contact form collects, why we hold it, and your rights.'
),
(
  'Terms of use',
  'terms',
  '**Draft — pending legal review.** These terms cover your use of this website. They do not cover services we deliver under a separate written agreement, which has its own terms.

Last reviewed: 12 October 2026.

## Using this site

You are welcome to read this website and to contact us through it. Please do not attempt to disrupt it, gain access to parts of it that are not public, or use automated tools to submit the contact form.

## What is on it

We try to keep the information on this site accurate and current, but it is provided for general information. Descriptions of our services are an outline, not an offer or a specification — the scope of any work is set out in a written proposal or agreement.

Prices, availability and technical details can change without notice.

## Links to other sites

Where we link to another organisation — a brand in our portfolio, a product site, or a supplier — we are not responsible for that site''s content or its handling of your data. Their terms apply once you leave ours.

## Our material

The text, design, logos and images on this site belong to DeeTech Group or are used with permission. Please do not reproduce substantial parts of them without asking us first. Quoting us with attribution and a link is fine.

## Liability

We provide this website as it is. To the extent the law allows, we are not liable for loss arising from your use of it or from reliance on information published on it.

Nothing here limits liability that cannot lawfully be limited.

## Governing law

These terms are governed by the laws of India, and the courts of Uttar Pradesh have jurisdiction over any dispute arising from them.

## Contact

Questions about these terms: [support@deetechgroup.com](mailto:support@deetechgroup.com).',
  'draft',
  NULL,
  'Terms of use',
  'The terms covering use of the DeeTech Group website, including accuracy of information, links to other sites, and governing law.'
)
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title,
  body = EXCLUDED.body,
  seo_title = EXCLUDED.seo_title,
  seo_description = EXCLUDED.seo_description;
-- Note: `status` and `published_at` are deliberately NOT updated on conflict.
-- Once somebody has reviewed and published these, re-running the seeds must
-- not quietly unpublish them again.
