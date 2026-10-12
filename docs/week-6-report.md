# Week 6 Report — Production launch

Days 26–30 of the 30-working-day plan. 2026-10-12.

---

## Read this first

**The site has not been deployed.** This week is different from the previous
five: most of it cannot be done from a development machine.

| Needed | Available here |
|---|---|
| Docker Engine + compose | **Not installed** |
| nginx | **Not installed** |
| SSH to the VPS | **No access** |
| DNS control | **No access** |
| Owner approval to cut over | Not given, and not mine to assume |

So Week 6 delivers **everything that makes the deployment runnable by you**,
plus tooling that runs against whatever URL you point it at. The compose
files, nginx config and shell scripts are written and syntax-checked but
**unexecuted**. Day 29's "approve cutover" and Day 30's "deploy" are yours.

I have not pretended otherwise anywhere in these files.

---

## Day 26 — Production images, compose, nginx, health checks

**`infrastructure/deployment/docker-compose.prod.yml`** — the production
overlay. nginx is added and is the only service exposed; the development
loopback publishes on web and api are **cleared**, so in production nothing
but nginx is reachable. Postgres has no published port in either file.

**nginx was wrong for containers.** The Week 1 draft used `127.0.0.1:3000`
and `127.0.0.1:4000` upstreams, which only work with nginx on the host.
With nginx in a container those are now the service names `web:3000` and
`api:4000`, resolved on the private network. Also added: a `/healthz`
endpoint for the container health check (on both the HTTP and HTTPS servers,
since the check runs over HTTP inside the network), and a `/media/` proxy so
the origin-relative URLs stored in content resolve.

**A certbot sidecar** renews twice a day. First issuance has a chicken-and-egg
problem — nginx will not start without a certificate, and the webroot
challenge needs nginx — so the runbook bootstraps with a standalone certbot
before the stack comes up.

### The build-order problem, solved

Flagged at the end of Week 4: `next build` prerenders content pages **by
calling the API**. With the API down the build still succeeds and ships a
site with no services, no brands and no articles.

Three parts to the fix:

1. The web build **joins the application network** (`build.network:
   deetech_net`), so it resolves `api` by Docker DNS. Host networking would
   not work, because the API has no published port in production.
2. `deploy.sh` starts the API and waits for it to be healthy **before**
   building web.
3. `deploy.sh` then **greps the build output** for a known page and fails if
   it is absent — because a build that could not reach the API exits 0, so
   the exit code cannot be trusted.

My first attempt at this was wrong: I tried to bridge the API to the host
with a socat sidecar, which would not have worked because joining a
container's network namespace does not expose the port on the host. Caught
while writing it down.

## Day 27 — DNS, HTTPS, firewall, secrets, volumes, backups

All in [`docs/06-deployment-runbook.md`](06-deployment-runbook.md), as
commands to run rather than prose. The parts worth knowing before you start:

**Check the VPS first.** Disk, memory, and above all what is already
listening on 80 and 443. If WordPress shares the VPS, those ports are taken
and the new stack goes up on a staging hostname until cutover.

**Docker bypasses ufw.** A published port is reachable even when ufw says it
is blocked, because Docker writes its own iptables rules. That is why the
production overlay publishes only nginx, and why the runbook has you confirm
with `nmap` from another machine that only 22, 80 and 443 answer.

**Backups go off the server.** A Docker volume is not a backup and neither
is a file on the same disk. The runbook has the cron entries, including an
rclone copy, and a monthly restore-into-a-scratch-database drill — because a
backup nobody has restored is a guess.

## Day 28 — Repeatable deployment, logs, uptime, alerts

**`deploy.sh`** does seven steps in an order where every failure leaves the
previous version serving:

1. Back up first — a deploy that goes wrong after a migration needs a
   restore point predating it.
2. Database up, wait for `pg_isready`.
3. Build the API image, run migrations **in a throwaway container**.
4. API up, wait for `/health` to report the database `ok`.
5. Build web (see above).
6. Swap web in, wait for it to respond.
7. `nginx -t` **before** reload — a bad config that fails to load takes the
   site down, whereas a failed test leaves the running config in place.

It also refuses to start if `SESSION_SECRET` is under 32 characters, rather
than letting you discover that after the database is already migrated.

**`rollback.sh`** goes back a commit or to a named ref, and **warns if
migrations were added in between** — migrations are forward-only, so
reverting code does not revert schema. Additive migrations are safe to roll
back past; a drop or rename needs a restore instead, and it says so and
stops for confirmation.

**Logs** are JSON with rotation at 20 MB × 5 per service. **Uptime
monitoring** should watch `/api/v1/health` and alert on the *body*, not just
the status: a degraded database still returns 200, because a degraded
dependency is not a reason to restart the container.

## Day 29 — Acceptance tests

**`smoke-test.mjs`** is black-box — no database access, no host assumptions —
so the same command works against staging and production.

```bash
node infrastructure/deployment/smoke-test.mjs --base https://www.deetechgroup.com
```

**Run against the local stack: 84 checks pass.** It covers every page
responding; title, meta description, canonical and exactly one `<h1>` on
each; sitemap, robots, RSS and icons resolving; **the advertised sitemap
actually existing** (the old site advertised one that 404s); `/admin`
protected and noindex; all four admin API families 401 unauthenticated; no
draft in the public list; every service summary distinct; security headers;
legacy 301s; and unknown URLs 404ing.

It has a `--dev` flag that skips the checks only nginx provides. **The
runbook says not to use it against anything real** — those checks are
precisely how a misconfigured proxy gets caught.

Three things it deliberately does not do, because a script should not:
submit the contact form on production (that creates a real enquiry and sends
a real email), publish content, or look at the site on a phone. Those are
manual items in the runbook.

## Day 30 — Cutover and handover

The runbook has the cutover sequence: the day-before preparation including
**lowering DNS TTL to 300 seconds at least 24 hours ahead**, freezing
WordPress edits, copying `wp-content/uploads` across so old image URLs keep
working; then the cutover itself, testing against the production hostname
via `/etc/hosts` *before* DNS moves; then the first-hour checks.

**The real rollback is DNS.** Keep the WordPress server and its backup
running and untouched for at least two weeks after cutover. It costs almost
nothing and it is the only undo that always works.

Handover is §10: where each document lives, the routine tasks as commands,
and the five things that will bite if forgotten — immutable migrations,
backwards-compatible migrations, the build needing the API, regenerating the
redirect snippet, and the write schemas having to accept their own output.

---

## Verification

| | |
|---|---|
| `bash -n` on all four scripts | OK |
| `smoke-test.mjs` against the local stack | **84 passed, 3 skipped** |
| `verify-redirects.mjs` | 15/15 legacy URLs covered, 11/11 destinations resolve |
| `npm run check` | format, lint, typecheck clean; **215 tests pass** |
| Compose files | No tabs, services parse, nginx snippet references exist |

**Not verified, and cannot be from here:** `docker compose build`, `docker
compose up`, `nginx -t`, certificate issuance, `pg_dump`/`psql`, firewall
rules, DNS. Every one of those is a step in the runbook.

## What is genuinely left

### Blocking launch

| | |
|---|---|
| **SMTP credentials** | Enquiries are saved and appear in `/admin/enquiries`, but nobody is emailed. This is the gap that loses business quietly. |
| **Legal review** of the privacy policy and terms | They ship as drafts; the footer links to them only once published. |

### Needed for the site to be complete, not blocking

- About page facts: real figures, the team roster, the founding year (the
  old page claims both four and seven years)
- Written permission for the four named testimonials
- A GA4 property — the old site has no analytics, so there is no baseline
- Vector logo artwork

### Deployment work, yours to run

Work through [`docs/06-deployment-runbook.md`](06-deployment-runbook.md) on
a staging hostname first. The order that matters: VPS capacity check →
secrets → certificate → firewall → `deploy.sh` → smoke test → *then* think
about DNS.

---

## Where the project stands

Six weeks, six commits, 215 tests.

| | Legacy WordPress | New site |
|---|---|---|
| Homepage HTML | 235 KB | 81 KB |
| Pages with a meta description | 0 of 10 | all |
| Working XML sitemap | No — robots.txt advertised a 404 | Yes, generated from published content |
| Media with alt text | 0 of 53 | Required at upload |
| Duplicate service descriptions | 6 identical | Unique, enforced by a database constraint |
| Placeholder copy live | Yes | None |
| Analytics | None | Ready, pending a property |
| Security headers | None | Full set via nginx |
| Admin | WordPress + 4 plugins | Purpose-built, role-aware, tested |

The 18 content-quality defects found in the Day 1 audit are either fixed or
tracked. The two that remain open are the ones only the owner can answer.
