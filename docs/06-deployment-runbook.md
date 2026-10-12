# Deployment runbook

Everything needed to put this on the VPS and cut over from WordPress.

**Nothing in this document has been executed.** Docker is not installed on
the development machine and there is no VPS access from it, so the compose
files, nginx config and scripts are written and syntax-checked but unrun.
Work through this on a staging hostname first, not straight at production.

---

> **Deploying to production with fresh content and no WordPress data?**
> [`07-production-deploy.md`](07-production-deploy.md) is that path as a
> single ordered checklist. This file stays the reference for why each
> step is the way it is, and covers the containerised-nginx alternative.

## 0. Before you start

You need:

| | |
|---|---|
| VPS | root or sudo, Docker Engine 24+ with the compose plugin |
| DNS | control of `deetechgroup.com` |
| A staging hostname | e.g. `staging.deetechgroup.com`, pointed at the VPS |
| SMTP credentials | still outstanding — see §9 |
| The WordPress server | SSH or cPanel access, to take the final backup |

### Check the VPS before changing anything

Section 9 of the plan asks for this first, and it is the step most likely to
save you an outage:

```bash
df -h                      # free disk: the database, media and backups all live here
free -m                    # free memory: Postgres + two Node processes + nginx
nproc                      # cores
ss -tlnp                   # what is already listening — 80 and 443 are the ones that matter
docker ps                  # anything already running?
systemctl status nginx     # is there a host nginx that will fight for port 80?
```

**If WordPress is on this same VPS**, ports 80 and 443 are already taken. Do
not stop it yet. Bring the new stack up on a staging hostname with the
containerised nginx bound to different ports, or on a separate host, and
only take 80/443 at cutover (§8).

---

## 1. Get the code and the secrets onto the server

```bash
sudo mkdir -p /srv/deetech && sudo chown "$USER" /srv/deetech
cd /srv/deetech
git clone <your-remote> site && cd site

cp .env.example .env
```

Fill in `.env`. The values that matter:

```bash
NODE_ENV=production

POSTGRES_DB=deetech
POSTGRES_USER=deetech
POSTGRES_PASSWORD=$(openssl rand -base64 24)
DATABASE_URL=postgresql://deetech:<that password>@db:5432/deetech

SESSION_SECRET=$(openssl rand -base64 48)   # at least 32 chars or the API refuses to start

NEXT_PUBLIC_SITE_URL=https://www.deetechgroup.com
API_BASE_URL=http://api:4000
CORS_ALLOWED_ORIGINS=https://www.deetechgroup.com

SMTP_HOST=...                                # see §9
SMTP_USER=...
SMTP_PASSWORD=...
MAIL_FROM="DeeTech Group <no-reply@deetechgroup.com>"
ENQUIRY_NOTIFICATION_TO=support@deetechgroup.com

MEDIA_STORAGE_PATH=/var/lib/deetech/media
BACKUP_DIR=/srv/deetech/backups
LEGACY_UPLOADS_DIR=/srv/deetech/legacy-uploads
```

```bash
chmod 600 .env
```

`.env` is git-ignored and must stay off the repository. It is the one file
on the server that must never be committed, pasted into a ticket, or copied
into a Dockerfile.

---

## 2. TLS, first time only

The nginx config references a certificate, so nginx cannot start until one
exists — and certbot's webroot challenge needs nginx running. Break the
circle by issuing the certificate before enabling the site config.

**This needs a public DNS name pointing at the box.** Let's Encrypt
validates from the internet, so a LAN address cannot be certified at all —
on a staging box, use `staging-local.conf` and plain HTTP instead, and leave
TLS to the real host.

### host-nginx (the default topology)

certbot runs on the host and owns renewal:

```bash
sudo apt-get install -y certbot
sudo mkdir -p /var/www/certbot

# Nothing on port 80 yet, so standalone:
sudo certbot certonly --standalone \
  -d www.deetechgroup.com -d deetechgroup.com \
  --email support@deetechgroup.com --agree-tos --no-eff-email
```

Then enable the site config (§4) and switch renewal to the webroot, so
renewals never need to stop nginx:

```bash
sudo certbot certonly --webroot -w /var/www/certbot \
  -d www.deetechgroup.com -d deetechgroup.com --force-renewal
sudo systemctl enable --now certbot.timer
sudo certbot renew --dry-run
```

Add a deploy hook so a renewed certificate is actually picked up —
certbot renewing without reloading nginx is a classic way to serve an
expired certificate for ninety days:

```bash
echo -e '#!/bin/sh\nsystemctl reload nginx' \
  | sudo tee /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh
sudo chmod +x /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh
```

### container-nginx

Issue with a standalone certbot container while nothing is on port 80:

```bash
docker run --rm -p 80:80 \
  -v deetech_certbot-conf:/etc/letsencrypt \
  -v deetech_certbot-www:/var/www/certbot \
  certbot/certbot certonly --standalone \
  -d www.deetechgroup.com -d deetechgroup.com \
  --email support@deetechgroup.com --agree-tos --no-eff-email
```

Renewal is then the `certbot` service in `docker-compose.prod.yml`, which
checks twice a day and is a no-op until a certificate is within 30 days of
expiry. **Verify renewal works before you need it:**

```bash
docker compose -f docker-compose.yml \
  -f infrastructure/deployment/docker-compose.prod.yml \
  run --rm certbot renew --dry-run
```

If WordPress is still serving on port 80 in either case, use the DNS
challenge (`--manual --preferred-challenges dns`) so nothing has to stop.

---

## 3. Firewall

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp          # restrict to your own IP if you have a static one
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
sudo ufw status verbose
```

Nothing else is opened. Postgres has no published port at all, the API and
web are only reachable on the private Docker network, and nginx is the only
way in.

> **Docker bypasses ufw.** Docker writes its own iptables rules, so a
> published port is reachable even if ufw says it is blocked. That is why
> the production compose file publishes **only** nginx's 80 and 443, and
> removes the loopback publishes the base file uses for development. After
> deploying, confirm from another machine:
>
> ```bash
> nmap -Pn -p 22,80,443,3000,4000,5432 <vps-ip>
> ```
>
> Only 22, 80 and 443 should be open.

---

## 4. Deploy

### Choose the topology first

Two are supported, and they are not interchangeable. `deploy.sh` takes
`DEPLOY_MODE`, defaulting to `host-nginx`.

| | `host-nginx` (default) | `container-nginx` |
|---|---|---|
| nginx runs | on the host | in compose |
| web and api | published on `127.0.0.1` | publish nothing |
| nginx upstreams | `127.0.0.1:3000` / `:4000` | `web:3000` / `api:4000` |
| server config | `deetechgroup-host.conf` | `deetechgroup.conf` |
| compose overlay | `docker-compose.hostnginx.yml` | `docker-compose.prod.yml` |
| TLS and renewal | host certbot | the `certbot` container |

**The upstreams are the whole difference and getting them wrong fails
confusingly.** Host nginx cannot resolve `web:3000` — that name only exists
on the Docker network. Container nginx pointed at `127.0.0.1:3000` reaches
only itself. The routing is shared between both configs via
`infrastructure/nginx/snippets/deetech-locations.conf` so they cannot drift,
but the upstream block belongs to each config and is yours to get right.

The loopback publishes in `host-nginx` are bound to `127.0.0.1`, never
`0.0.0.0`. That is what makes them unreachable from off the box — **not**
ufw, which Docker bypasses. Verify with `nmap` from another machine as in §3.

### Host nginx: one-time setup

Skip this for `container-nginx`.

```bash
sudo apt-get install -y nginx
sudo ln -sfn /srv/deetech/site/infrastructure/nginx/snippets /etc/nginx/deetech
sudo cp /srv/deetech/site/infrastructure/nginx/deetechgroup-host.conf \
        /etc/nginx/sites-available/deetech
sudo ln -sfn /etc/nginx/sites-available/deetech /etc/nginx/sites-enabled/deetech
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

`/etc/nginx/deetech` rather than `/etc/nginx/snippets` because Debian and
Ubuntu already ship the latter. It is a symlink into the checkout, so
`git pull` updates the redirect rules and a reload picks them up.

On a box with no domain and no certificate — a LAN or staging host — use
`staging-local.conf` instead. It is the same topology over plain HTTP on
`server_name _`, so the stack can be verified end to end before anything
real is involved.

### Run it

```bash
cd /srv/deetech/site
DEPLOY_MODE=host-nginx infrastructure/deployment/deploy.sh
```

**The server does not need Node installed.** Everything builds inside
Docker, and the nginx redirect snippet
(`infrastructure/nginx/snippets/deetech-redirects.conf`) is **generated and
committed** — CI fails if it drifts from `docs/redirects.csv`. Regenerate it
on a development machine when you change the CSV, not here.

**On a first deploy, seed before deploying** — see below. `deploy.sh` runs
migrations but not seeds, so against an empty database step 5 correctly
refuses to ship a site with no content.

`deploy.sh` does this, in this order, stopping at the first failure:

1. **Backs up** before anything changes.
2. Starts the database and waits for the container to report **healthy** —
   not merely for `pg_isready`, which answers during `initdb` on a first
   deploy while the server is about to restart.
3. Builds the API image and **runs migrations in a throwaway container**.
4. Starts the API and waits for `/health` to report the database `ok`.
5. **Then** builds web. `next build` prerenders content by calling the API.
   Building before the API is up ships a site with no services, brands or
   articles **and does not fail while doing it**, so the script counts the
   prerendered service **detail** pages in the image and fails if there are
   none. (Grepping the HTML for a service slug does not work — the slugs are
   in the hardcoded navigation, so they match even in an empty build.)

   Reaching the API from a build takes two things, and `deploy.sh` does both.
   It builds with a **buildx builder attached to `deetech_net`**, because
   `build.network` in a compose file is a classic-builder feature that
   buildkit rejects outright. And it passes the API container's address
   through `build.extra_hosts`, because buildkit replaces resolv.conf inside
   `RUN` sandboxes with public DNS, so `api` does not resolve even from a
   builder that is on the network.

6. Swaps in web and waits for it to respond.
7. Validates the nginx config with `nginx -t` **before** reloading, because a
   bad config that fails to load takes the site down whereas a failed test
   leaves the running config in place. In `host-nginx` mode it reloads the
   host service with `systemctl reload nginx`; nginx is never restarted by a
   deploy, so no connection is dropped.

### Seed the content

Run this **before the first `deploy.sh`**, against the empty database.
`deploy.sh` migrates but does not seed, and its build guard will refuse a
site with no content — correctly.

```bash
cd /srv/deetech/site
COMPOSE="docker compose -f docker-compose.yml -f infrastructure/deployment/docker-compose.hostnginx.yml"

$COMPOSE up -d db
$COMPOSE build api
$COMPOSE run --rm --no-deps -T api node apps/api/dist/db/cli.js setup
```

`setup` is migrate then seed. Seeds are idempotent, so it is safe to re-run;
`seed` alone works once the schema exists.

### Create the first administrator

There are **no admin users after seeding** — the seeds deliberately create
none, so there is no default account to forget about.

```bash
$COMPOSE run --rm --no-deps -T api node apps/api/dist/db/create-admin.js \
  --email you@deetechgroup.com --name "Your Name"
```

The password is generated and printed once. Put it in a password manager
immediately. It is deliberately not a command-line argument — argv is
readable by other processes on the machine and lands in shell history.

---

## 5. Verify, before pointing DNS at it

Both scripts are black-box HTTP clients, so run them **from your own
machine** — anywhere with Node and network access to the host. They need
nothing on the server.

```bash
node infrastructure/deployment/smoke-test.mjs --base https://staging.deetechgroup.com
node infrastructure/deployment/verify-redirects.mjs --base https://staging.deetechgroup.com
```

The smoke test covers 80-odd checks: every page responds, every page has a
title, meta description, canonical and exactly one `<h1>`, the sitemap and
robots and RSS resolve, the advertised sitemap actually exists, `/admin` is
protected and noindex, all four admin API families are 401 unauthenticated,
no draft leaks into the public list, every service summary is distinct, the
security headers are present, legacy URLs 301 correctly, and unknown URLs
404.

**Do not pass `--dev` against anything real.** It skips the security-header
and redirect checks, which is exactly how a misconfigured proxy gets caught.

### By hand, because a script should not do these

- [ ] Submit the contact form with a recognisable subject, e.g.
      `LAUNCH CHECK <today's date>`. Confirm it appears in `/admin/enquiries`
      **and** that the notification email arrives.
- [ ] Sign in to `/admin`, edit something, publish it, see the change on the
      public page.
- [ ] Open the site on a real phone. The emulator is not the same thing.
- [ ] Check the logo and favicon render in a browser tab and a link preview.

---

## 6. Backups

```bash
sudo mkdir -p /srv/deetech/backups
```

Add to root's crontab (`sudo crontab -e`):

```cron
# Database and media, nightly at 02:15 UTC
15 2 * * * cd /srv/deetech/site && infrastructure/deployment/backup.sh /srv/deetech/backups >> /var/log/deetech-backup.log 2>&1
```

**No `DATABASE_URL` and no `MEDIA_DIR`.** `backup.sh` finds the db container
by compose label and runs `pg_dump` inside it, and archives the media
volume through a throwaway container. Both are necessary rather than tidy:
`DATABASE_URL` names `db:5432`, which is Docker's internal DNS and does not
resolve on the host, and the database publishes no port in either topology —
so a cron passing `DATABASE_URL` would have failed every night, silently,
until the day someone needed a restore. Media is a Docker volume, not a
directory; reaching into `/var/lib/docker/volumes/.../_data` happens to work
as root on Linux but is unsupported and not guaranteed to keep working.

Running `pg_dump` inside the container also keeps the client version equal
to the server version, which is a common way to produce a dump that will not
restore.

`BACKUP_MODE=host` forces the old behaviour for a development machine.

**A Docker volume is not a backup, and neither is a file on the same disk.**
Copy the backups off the VPS — rclone to object storage, or `rsync` to
another host:

```cron
45 2 * * * rclone copy /srv/deetech/backups remote:deetech-backups --max-age 48h
```

### Prove the backup works

A backup you have not restored is a guess. Monthly, restore the latest dump
into a scratch database and check the counts:

```bash
cd /srv/deetech/site
$COMPOSE exec -T db createdb -U deetech restore_test

POSTGRES_DB=restore_test RESTORE_CONFIRM=restore_test \
  infrastructure/deployment/restore.sh /srv/deetech/backups/deetech-db-<stamp>.sql.gz

$COMPOSE exec -T db dropdb -U deetech restore_test
```

`restore.sh` detects the container the same way `backup.sh` does, so
`POSTGRES_DB` is what points it at the scratch database. It refuses to run
unless `RESTORE_CONFIRM` matches that name, which is what stops a scratch
restore landing on production.

**This drill has been run against a real deployment**, not just written
down: a service row was deleted, the dump restored, and the row confirmed
back. Do it on your own data too — a restore path that has only ever been
read is not a restore path.

---

## 7. Logging, uptime and alerts

**Logs** are JSON, rotated by Docker: 20 MB × 5 files per service, set in the
production compose file. To read them:

```bash
docker compose ... logs -f api
docker compose ... logs --since 1h nginx
```

The API redacts `authorization`, `cookie`, `set-cookie`, `*.password` and
`*.token`, and never logs enquiry contents.

**Uptime monitoring.** Point an external monitor at:

| URL | Expect |
|---|---|
| `https://www.deetechgroup.com/` | 200 |
| `https://www.deetechgroup.com/api/v1/health` | 200 with `"status":"ok"` and `"database":"ok"` |

The health endpoint reports `degraded` when the database check fails, and
still returns 200 — a degraded dependency is not a reason to restart the
container. Alert on the body, not just the status code.

Free options that work: UptimeRobot, Better Stack, or a cron on another host
running the smoke test.

**Certificate expiry.** Alert at 14 days. The renewal container should
handle it, but silent renewal failure is how sites go down on a Sunday.

**Disk.** Alert at 80%. Backups, Docker images and Postgres all grow.

---

## 8. Cutover

Do this when §5 passes on staging and the content is approved.

### The day before

- [ ] **Take a full WordPress backup and verify it opens.** Database,
      `wp-content/uploads`, themes, plugins, `wp-config.php`. This is the
      rollback if the new site has to be abandoned.
- [ ] Copy `wp-content/uploads` to `/srv/deetech/legacy-uploads` on the new
      server. nginx serves it read-only so existing image URLs keep working.
- [ ] Lower the DNS TTL on `deetechgroup.com` and `www` to **300 seconds**.
      Do this at least 24 hours ahead or it will not have propagated.
- [ ] Freeze WordPress edits. Anything changed after this is lost.

### Cutover

1. Take a final WordPress backup — content may have changed since yesterday.
2. Final `deploy.sh` on the new stack, with the production hostname in
   `NEXT_PUBLIC_SITE_URL`.
3. Re-run the smoke test and redirect check against the **production**
   hostname, using `/etc/hosts` to point at the new server before DNS moves.
4. Stop WordPress, freeing 80 and 443 if it shares the VPS.
5. Start the production stack on 80/443.
6. Point DNS at the new server.
7. Watch: `docker compose ... logs -f nginx api`.

### Within the first hour

- [ ] `smoke-test.mjs` and `verify-redirects.mjs` against the live hostname
- [ ] Submit the contact form for real and confirm the email arrives
- [ ] Spot-check 10 legacy URLs in a browser
- [ ] Submit `https://www.deetechgroup.com/sitemap.xml` in Google Search
      Console and request indexing of the homepage
- [ ] Confirm HTTPS has no mixed-content warnings (the old site had `http://`
      asset URLs on an HTTPS page — SEO-5 in the Day 1 audit)

### Rolling back

**Code only:**

```bash
infrastructure/deployment/rollback.sh          # one commit back
infrastructure/deployment/rollback.sh <ref>    # to a known-good commit
```

It warns if migrations were added in between, because migrations are
forward-only and reverting code does not revert schema. Additive migrations
are safe to roll back past; a drop or rename is not, and needs a restore.

**All the way back to WordPress:** repoint DNS. Keep the WordPress server
and its backup running and untouched for **at least two weeks** after
cutover. This is the real rollback and it costs almost nothing to keep.

---

## 9. Still outstanding

| | Blocks |
|---|---|
| **SMTP credentials** | Enquiry notifications. Enquiries are saved and visible in `/admin/enquiries` without it, but nobody is emailed. This is the one gap that loses business quietly. |
| **Legal review** of the privacy policy and terms | Publishing them. They are seeded as drafts; the footer links to them only once published. |
| About page facts — real figures, team roster, founding year | Three hidden sections |
| Written permission for the four named testimonials | The homepage testimonials |
| A GA4 property | Any analytics at all. The old site has none, so there is no baseline either way. |
| Vector logo artwork | Crisper rendering at large sizes |

---

## 10. Handover

| What | Where |
|---|---|
| How the project is laid out, how to run it | `README.md` |
| What the old site contained and what was wrong with it | `docs/01-wordpress-audit.md` |
| URL scheme, content model, design tokens, accessibility rules | `docs/02-sitemap-and-design-system.md` |
| What each week delivered and what was verified | `docs/week-1-report.md` … `week-6-report.md` |
| Schema decisions and how to run migrations | `database/README.md` |
| Legacy URL map | `docs/redirects.csv` (edit this, never the generated snippet) |
| This runbook | `docs/06-deployment-runbook.md` |

### Routine tasks

| Task | Command |
|---|---|
| Deploy a change | `DEPLOY_MODE=host-nginx infrastructure/deployment/deploy.sh` |
| Roll back | `DEPLOY_MODE=host-nginx infrastructure/deployment/rollback.sh` |
| Back up now | `infrastructure/deployment/backup.sh /srv/deetech/backups` |
| Add a redirect | edit `docs/redirects.csv`, `npm run redirects:build` **on a dev machine**, commit, deploy |
| Add an admin | `run --rm api node apps/api/dist/db/create-admin.js --email … --name …` |
| Check the site | `node infrastructure/deployment/smoke-test.mjs --base https://www.deetechgroup.com` |
| Restore a backup | `RESTORE_CONFIRM=<db> infrastructure/deployment/restore.sh <dump>` |

### Things that will bite if forgotten

- **Migrations are immutable once applied.** The runner records a checksum
  and refuses to run an edited migration. Add a new one.
- **Migrations run against the old code** during a deploy, so they must be
  backwards compatible. Add a column, deploy, then use it.
- **`next build` needs the API running.** Without it the build succeeds and
  ships empty content pages. `deploy.sh` orders this correctly, and builds
  through a network-attached buildx builder with the API's address in
  `extra_hosts`; a manual `docker compose build web` does neither and will
  quietly produce an empty site.
- **The nginx upstreams depend on the topology.** Host nginx cannot resolve
  `web:3000`; container nginx pointed at `127.0.0.1:3000` reaches itself.
  Use the config that matches `DEPLOY_MODE`.
- **`backup.sh` and `restore.sh` must run on the host with Docker
  available**, not with a `DATABASE_URL` pointing at `127.0.0.1:5432`. The
  database publishes no port; they work by finding the container.
- **Editing `docs/redirects.csv` is not enough** — regenerate the snippet and
  redeploy. CI fails if they drift.
- **The write schemas are validated twice**, by the server action and again
  by the API, so they must accept their own output. There are round-trip
  tests for this.
