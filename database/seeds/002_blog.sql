-- 002 — blog
--
-- One seed article, generated from
-- apps/web/src/lib/content/fixtures/posts.ts. The legacy hello-world post
-- is deliberately NOT migrated; its URL 301s to /blog (docs/redirects.csv).

INSERT INTO blog_posts (title, slug, excerpt, body, author_name, category, status, published_at, seo_title, seo_description)
VALUES
  ('Shared, cloud or dedicated hosting: how to actually choose', 'shared-cloud-or-dedicated-hosting', 'Hosting tiers are usually sold on specifications. The more useful question is what your traffic looks like, what happens when it spikes, and who is responsible when something breaks at 2am.', 'Most hosting comparisons are a table of CPU cores, RAM and storage. That table tells you almost nothing about which tier you should be on, because the thing that decides it is not the specification — it is the shape of your traffic and your tolerance for being offline.

Here is a more useful way to work through it.

## Start with what the site actually does

A brochure site that serves the same ten pages to every visitor is a fundamentally different workload from an application that runs a database query for every request. The first can be cached almost entirely and will sit happily on modest hardware. The second cannot, and its resource use grows with how many people are using it at once.

Before looking at plans, write down:

- How many pages are genuinely dynamic, rather than the same for everyone
- Whether anyone logs in
- Whether anything runs on a schedule — reports, imports, backups
- What the busiest hour of a normal week looks like, and the busiest hour of your worst week

If you cannot answer the last one, that is itself the finding. Add analytics before you add servers.

## Shared hosting

On shared hosting your site runs on a machine alongside many others. You get a slice of its resources, and you do not administer the machine.

**It fits** brochure sites, early-stage projects and anything where an hour of downtime is an annoyance rather than a cost.

**The real constraint** is not usually the advertised limits — it is that you are sharing. A neighbour having a traffic spike can slow you down, and you have no visibility into why. You also cannot install system-level software, which rules out some applications entirely.

## Cloud hosting

Cloud hosting allocates resources that can be adjusted, often quickly and sometimes automatically.

**It fits** sites with uneven traffic: seasonal businesses, anything tied to campaigns, anything growing fast enough that this year''s sizing will be wrong next year.

**The real constraint** is that elasticity is not free and it is not automatic. Scaling only helps if the application can actually use more resources — a site bottlenecked on a single slow database query will be just as slow on four servers as on one. Cloud hosting rewards applications that were designed to scale and punishes the assumption that it will fix a performance problem.

## Dedicated servers

A dedicated server is a physical machine that is yours alone.

**It fits** high and sustained traffic, workloads with specific hardware or compliance requirements, and applications where predictable performance matters more than flexibility.

**The real constraint** is that you now own a machine. Capacity planning, operating-system patching and hardware failure all become your problem unless someone is managing it for you. The hosting is cheaper per unit of performance; the operational responsibility is higher.

## The questions that matter more than the tier

Whichever tier you land on, these decide whether hosting is a problem or not:

**Where do the backups live, and has anyone restored one?** A backup on the same machine as the site is not a backup. An untested backup is a guess. The only way to know a restore works is to have done one.

**Who notices an outage first — you or your customers?** Uptime monitoring is inexpensive and the difference between finding out at 02:10 and finding out in an email at 09:30.

**What is the patching arrangement?** Unpatched software is how most sites are compromised, and "we''ll do it when we remember" is not an arrangement.

**Who is responsible at 2am?** Get this answered before you need it, in writing.

## A reasonable default

If you are genuinely unsure: start on the smallest tier that comfortably handles your worst normal week, make sure backups and monitoring are real, and plan to revisit it in six months with actual numbers. Over-provisioning on day one buys very little. Being unable to restore buys you nothing at all.

---

If you would like a second opinion on what your site actually needs, [get in touch](/contact) — we are happy to look at the numbers with you.', 'DeeTech Group', 'Hosting', 'published', '2026-10-11T09:00:00.000Z', 'Shared, Cloud or Dedicated Hosting: How to Choose', 'A practical guide to choosing a hosting tier — what each one actually fits, where each one bites, and the four questions that matter more than the plan you pick.')
ON CONFLICT (slug) DO UPDATE SET
  title = EXCLUDED.title,
  excerpt = EXCLUDED.excerpt,
  body = EXCLUDED.body,
  author_name = EXCLUDED.author_name,
  category = EXCLUDED.category,
  status = EXCLUDED.status,
  published_at = EXCLUDED.published_at,
  seo_title = EXCLUDED.seo_title,
  seo_description = EXCLUDED.seo_description;
