# Deployment runbook

Everything needed to put this on the VPS and cut over from WordPress.

**Nothing in this document has been executed.** Docker is not installed on
the development machine and there is no VPS access from it, so the compose
files, nginx config and scripts are written and syntax-checked but unrun.
Work through this on a staging hostname first, not straight at production.

---

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
circle by issuing the certificate with a standalone certbot first, while
nothing is on port 80:

```bash
docker run --rm -p 80:80 \
  -v /srv/deetech/certbot-conf:/etc/letsencrypt \
  -v /srv/deetech/certbot-www:/var/www/certbot \
  certbot/certbot certonly --standalone \
  -d www.deetechgroup.com -d deetechgroup.com \
  --email support@deetechgroup.com --agree-tos --no-eff-email
```

If WordPress is still serving on port 80, use the DNS challenge instead
(`--manual --preferred-challenges dns`) so nothing has to stop.

Renewal afterwards is handled by the `certbot` service in the production
compose file, which checks twice a day and is a no-op until a certificate is
within 30 days of expiry. **Verify renewal works before you need it:**

```bash
docker compose -f docker-compose.yml \
  -f infrastructure/deployment/docker-compose.prod.yml \
  run --rm certbot renew --dry-run
```

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

```bash
cd /srv/deetech/site
npm ci                                   # for the redirect generator
npm run redirects:build                  # writes the nginx snippet from docs/redirects.csv
infrastructure/deployment/deploy.sh
```

`deploy.sh` does this, in this order, stopping at the first failure:

1. **Backs up** before anything changes.
2. Starts the database and waits for `pg_isready`.
3. Builds the API image and **runs migrations in a throwaway container**.
4. Starts the API and waits for `/health` to report the database `ok`.
5. **Then** builds web. `next build` prerenders content by calling the API,
   so the build joins the application network to reach it. Building before
   the API is up ships a site with no services, brands or articles **and
   does not fail while doing it**, so the script greps the build output for
   a known page and fails if it is not there.
6. Swaps in web and waits for it to respond.
7. Validates the nginx config with `nginx -t` **before** reloading, because a
   bad config that fails to load takes the site down whereas a failed test
   leaves the running config in place.

### Create the first administrator

```bash
docker compose -f docker-compose.yml \
  -f infrastructure/deployment/docker-compose.prod.yml \
  run --rm api node apps/api/dist/db/create-admin.js \
  --email you@deetechgroup.com --name "Your Name"
```

The password is generated and printed once. Put it in a password manager
immediately. It is deliberately not a command-line argument — argv is
readable by other processes on the machine and lands in shell history.

### Seed the content

```bash
docker compose ... run --rm api node apps/api/dist/db/cli.js seed
```

Seeds are idempotent, so this is safe to re-run.

---

## 5. Verify, before pointing DNS at it

Against the staging hostname:

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
15 2 * * * cd /srv/deetech/site && DATABASE_URL='postgresql://deetech:<pw>@127.0.0.1:5432/deetech' MEDIA_DIR=/var/lib/docker/volumes/deetech_media-data/_data BACKUP_DIR=/srv/deetech/backups infrastructure/deployment/backup.sh /srv/deetech/backups >> /var/log/deetech-backup.log 2>&1
```

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
docker compose ... exec -T db createdb -U deetech restore_test
RESTORE_CONFIRM=restore_test \
  DATABASE_URL=postgresql://deetech:<pw>@127.0.0.1:5432/restore_test \
  infrastructure/deployment/restore.sh /srv/deetech/backups/deetech-db-<stamp>.sql.gz
docker compose ... exec -T db dropdb -U deetech restore_test
```

`restore.sh` refuses to run unless `RESTORE_CONFIRM` matches the target
database name, which is what stops a scratch restore landing on production.

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
| Deploy a change | `infrastructure/deployment/deploy.sh` |
| Roll back | `infrastructure/deployment/rollback.sh` |
| Add a redirect | edit `docs/redirects.csv`, `npm run redirects:build`, deploy |
| Add an admin | `run --rm api node apps/api/dist/db/create-admin.js --email … --name …` |
| Check the site | `node infrastructure/deployment/smoke-test.mjs --base https://www.deetechgroup.com` |
| Restore a backup | `RESTORE_CONFIRM=<db> infrastructure/deployment/restore.sh <dump>` |

### Things that will bite if forgotten

- **Migrations are immutable once applied.** The runner records a checksum
  and refuses to run an edited migration. Add a new one.
- **Migrations run against the old code** during a deploy, so they must be
  backwards compatible. Add a column, deploy, then use it.
- **`next build` needs the API running.** Without it the build succeeds and
  ships empty content pages. `deploy.sh` orders this correctly; a manual
  `docker compose build web` does not.
- **Editing `docs/redirects.csv` is not enough** — regenerate the snippet and
  redeploy. CI fails if they drift.
- **The write schemas are validated twice**, by the server action and again
  by the API, so they must accept their own output. There are round-trip
  tests for this.
