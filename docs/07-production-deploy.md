# Production deploy — fresh content, no WordPress migration

A single ordered path for the decided setup:

- **nginx on the host**, forwarding to the containers on loopback
- **Content from the seeds** — the pages written in weeks 2–3
- **No WordPress data migrated.** No `wp-content/uploads` copied across

[`06-deployment-runbook.md`](06-deployment-runbook.md) is the reference for
why each step is the way it is, and covers the containerised-nginx
alternative. This file is the checklist.

Every command below was executed on a staging host first, except the four
that need a public hostname: certificate issuance, renewal, HSTS and DNS.

---

## What "no WordPress migration" does and does not mean

**The seeds are not WordPress data.** They are the rewritten content: five
service pages, one article, AnPreD and InfraShield, and two legal pages that
ship as drafts. You need them, or the site is empty — and `deploy.sh` will
correctly refuse to ship an empty site at step 5.

What you are skipping is the copy of the old uploads directory. The
consequence is contained, and was measured rather than assumed:

| | |
|---|---|
| `/wp-content/uploads/<anything>` | **404** — nginx stays valid with no directory present |
| `/wp-login.php`, `/xmlrpc.php`, `/wp-admin/` | **410 Gone**, as intended |
| `/index.php/about/` and the other legacy URLs | **301** to the new pages, unaffected |

So old *page* URLs keep working; old *image* URLs stop. That matters only if
something outside the site hot-links an image from the old uploads — another
site, a PDF, an email campaign. If that is a risk, copy the directory after
all: it is a single `rsync` into `/srv/deetech/legacy-uploads`, and the
nginx rule is already there waiting for it.

**Keep the legacy redirects.** They are URL mappings, not data, and they are
what stops the domain's existing search rankings landing on 404s.

---

## 1. Before you start

| | |
|---|---|
| Server | Ubuntu 22.04 or 24.04, root or sudo, 2+ cores, 4+ GB RAM, 20+ GB free |
| DNS | Access to the zone for `deetechgroup.com` |
| Ports | 22, 80, 443 reachable from the internet |
| SMTP | Host, port, username, password for enquiry notifications |
| Legal | Privacy policy and terms reviewed — they ship as drafts |

**Lower the DNS TTL to 300 seconds at least 24 hours before cutover.** Do it
now, before anything else. TTL changes only take effect after the old value
expires, so this is the one step that cannot be hurried later.

---

## 2. Prepare the server

```bash
# Docker
curl -fsSL https://get.docker.com | sudo sh
sudo docker --version && sudo docker compose version   # compose must be >= 2.24.4

# nginx and certbot on the host
sudo apt-get update
sudo apt-get install -y nginx certbot

sudo mkdir -p /srv/deetech/backups /var/www/certbot
```

Compose **2.24.4 or later** is required for the `!override` tag. An older
version errors rather than ignoring it, so it cannot silently leave ports
exposed.

## 3. Code and secrets

```bash
sudo git clone https://github.com/<owner>/<repo>.git /srv/deetech/site
cd /srv/deetech/site
```

Generate the secrets on the server so they never pass through a terminal
you are reading, a ticket, or a chat window:

```bash
sudo sh -c 'umask 077; cd /srv/deetech/site; \
  PG="$(openssl rand -hex 24)"; \
  SESSION="$(openssl rand -hex 32)"; \
  cat > .env <<EOF
NODE_ENV=production
LOG_LEVEL=info

POSTGRES_DB=deetech
POSTGRES_USER=deetech
POSTGRES_PASSWORD=$PG
DATABASE_URL=postgres://deetech:$PG@db:5432/deetech

SESSION_SECRET=$SESSION
SESSION_TTL_HOURS=12

NEXT_PUBLIC_SITE_URL=https://www.deetechgroup.com
CORS_ALLOWED_ORIGINS=https://www.deetechgroup.com

SMTP_HOST=
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=
SMTP_PASSWORD=
MAIL_FROM="DeeTech Group <no-reply@deetechgroup.com>"
ENQUIRY_NOTIFICATION_TO=support@deetechgroup.com
EOF
chmod 600 .env'
```

Then fill in the five SMTP values with an editor. **Do not skip them.**
With no `SMTP_HOST` the mailer is a deliberate no-op: an enquiry is still
saved and still appears in `/admin/enquiries`, and **no email is sent and
nothing errors**. That is the quietest way this site can lose business.

`NEXT_PUBLIC_SITE_URL` is baked into the build — it sets the canonical URLs
and the sitemap — so it must be the final public URL, not an IP.

## 4. Firewall

```bash
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

With nginx on the host, ufw governs 80 and 443 normally. The "Docker
bypasses ufw" warning still applies to anything Docker publishes — which is
why web and api bind to `127.0.0.1` and not `0.0.0.0`. Confirm from another
machine once the stack is up:

```bash
nmap -Pn -p 22,80,443,3000,4000,5432 <server-ip>
```

Only 22, 80 and 443 may be open.

## 5. Certificate — before DNS moves

DNS still points at WordPress, so the HTTP-01 challenge cannot reach this
server. Use the DNS challenge, which proves control of the domain without
any traffic reaching the box:

```bash
sudo certbot certonly --manual --preferred-challenges dns \
  -d deetechgroup.com -d www.deetechgroup.com \
  --email support@deetechgroup.com --agree-tos --no-eff-email
```

It prints TXT records to add to the zone and waits. Add them, let them
propagate, continue.

This gets you a real certificate on the new server **before** any visitor is
sent there, so TLS works from the first second after cutover. Renewal is
switched to the automated webroot method in §10 — `--manual` cannot renew
unattended.

## 6. nginx

```bash
cd /srv/deetech/site
sudo ln -sfn /srv/deetech/site/infrastructure/nginx/snippets /etc/nginx/deetech
sudo cp infrastructure/nginx/deetechgroup-host.conf /etc/nginx/sites-available/deetech
sudo ln -sfn /etc/nginx/sites-available/deetech /etc/nginx/sites-enabled/deetech
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

`/etc/nginx/deetech` rather than `/etc/nginx/snippets`, which Debian and
Ubuntu already ship. It is a symlink into the checkout, so `git pull`
updates the redirect rules and a reload picks them up.

## 7. First deploy

Seeding comes **before** the first deploy. `deploy.sh` migrates but does not
seed, and its build guard refuses a site with no content. The `build api`
step below is what puts the current seed files in the image — see the note
after this block.

```bash
cd /srv/deetech/site
export COMPOSE="docker compose -f docker-compose.yml -f infrastructure/deployment/docker-compose.hostnginx.yml"

# Schema and content
sudo $COMPOSE up -d db
sudo $COMPOSE build api
sudo $COMPOSE run --rm --no-deps -T api node apps/api/dist/db/cli.js setup

# Your admin account — the password is generated and printed once
sudo $COMPOSE run --rm --no-deps -T api node apps/api/dist/db/create-admin.js \
  --email you@deetechgroup.com --name "Your Name"

# The deploy itself
sudo DEPLOY_MODE=host-nginx infrastructure/deployment/deploy.sh
```

Put that password in a password manager immediately. There are **no admin
users after seeding** — the seeds create none on purpose, so there is no
default account to forget about.

Add `--role editor` for anyone who should manage content but not accounts.

### Where admin credentials are defined

**Nowhere in a file.** Not in `.env`, not in a seed, not in the compose
file. They exist only in the `admin_users` table, and the only thing stored
is an Argon2id hash. The account is created by the command above, at deploy
time, and that is the only place the email is chosen.

The **email** is the `--email` argument. The **password** is generated and
printed once — deliberately not an argument, because argv is readable by
other processes and lands in shell history.

To choose the password yourself, pass it through the environment rather
than the command line:

```bash
read -rsp "Admin password (12+ chars): " ADMIN_PASSWORD; echo
export ADMIN_PASSWORD

sudo -E $COMPOSE run --rm --no-deps -T -e ADMIN_PASSWORD \
  api node apps/api/dist/db/create-admin.js \
  --email you@deetechgroup.com --name "Your Name"

unset ADMIN_PASSWORD
```

Three details that matter, all verified on a real host:

- **`-e ADMIN_PASSWORD` with no `=value`.** That passes the variable through
  from your shell, so the password never appears in the command line.
- **`sudo -E`**, or `sudo` drops the variable and the script silently
  generates one instead.
- **Putting `ADMIN_PASSWORD` in `.env` does not work.** A container does not
  inherit `.env`; compose passes only what the service's `environment:`
  block names, and `ADMIN_PASSWORD` is deliberately not in it — a long-lived
  service environment is readable with `docker inspect`, which is no place
  for an admin password.

### There is no way to change a password in the app

Worth knowing before you hand accounts out: the admin UI has **login only**.
No change-password screen, no reset-by-email, no user management. Creating
accounts is the CLI, and that is the whole story.

So a forgotten password is recovered by deleting the row and creating the
account again:

```bash
sudo $COMPOSE exec -T db psql -U deetech -d deetech \
  -c "DELETE FROM admin_users WHERE lower(email) = lower('you@deetechgroup.com');"
# then re-run create-admin.js as above
```

This is safe — every foreign key to `admin_users` is `ON DELETE SET NULL` or
`ON DELETE CASCADE`, so sessions disappear and nothing else breaks. The one
cost is that the deleted account's authorship is nulled: articles they wrote
and media they uploaded lose the attribution. Re-creating the same email
does not restore it.

`create-admin.js` refuses to overwrite an existing account, so the delete is
not optional.

**If more than one person will have an account, say so and get a
change-password flow built first.** Shared knowledge of a password that
cannot be rotated is not a position to be in once the site is live.

A successful run ends with `Deployed` and, at step 5, a line reading
`N service detail pages prerendered`. If that number is zero the deploy
stops: the build could not reach the API and would have shipped an empty
site.

### Changing a seed later

**The seed SQL lives inside the API image**, not in the checkout. The
Dockerfile copies `database/` in, and `cli.js` reads it from there. So
editing a seed file and re-running `seed` changes nothing until the image
has been rebuilt.

The order is **pull, deploy, then re-seed**:

```bash
git pull
sudo DEPLOY_MODE=host-nginx infrastructure/deployment/deploy.sh
sudo $COMPOSE run --rm --no-deps -T api node apps/api/dist/db/cli.js seed
```

Seeds upsert, so re-running brings approved content back in line rather
than duplicating it. Note that this also **overwrites edits made in the
admin panel** to anything a seed covers.

## 8. Verify — before DNS moves

The site is live on the server but DNS still points at WordPress. Test it
under its real hostname by overriding DNS on your own machine only.

Add to your hosts file — `/etc/hosts`, or
`C:\Windows\System32\drivers\etc\hosts` as Administrator:

```
<server-ip>  deetechgroup.com www.deetechgroup.com
```

Then, from that machine:

```bash
node infrastructure/deployment/smoke-test.mjs  --base https://www.deetechgroup.com
node infrastructure/deployment/verify-redirects.mjs --base https://www.deetechgroup.com
```

Both are black-box HTTP clients and need nothing on the server. **Do not
pass `--dev`** — it skips the security-header and redirect checks, which are
exactly how a misconfigured proxy is caught.

Expect **103 checks passing**, with none skipped over HTTPS.

By hand, because a script should not do these:

- [ ] Submit the contact form with a recognisable subject. Confirm it
      appears in `/admin/enquiries` **and that the email arrives.** This is
      the one test that proves the SMTP settings took effect.
- [ ] Sign in to `/admin`, edit something, publish it, see it on the page.
- [ ] Publish the privacy policy and terms once reviewed. They are drafts,
      and the footer links them only when published.
- [ ] Open the site on a real phone.

**Remove the hosts entries afterwards**, or you will keep seeing the new
site while the world sees the old one.

## 9. Cutover

Only when §8 is clean.

1. Freeze WordPress edits.
2. Point the A/AAAA records for `deetechgroup.com` and `www` at the new
   server.
3. Watch it land: `dig +short www.deetechgroup.com`.
4. Re-run the smoke test, now resolving through real DNS.

**Leave the WordPress server running and untouched for at least two weeks.**
The real rollback is DNS, and it is the only undo that always works. It
costs almost nothing.

## 10. After cutover

Switch renewal to the automated webroot method, now that port 80 reaches
this server:

```bash
sudo certbot certonly --webroot -w /var/www/certbot \
  -d deetechgroup.com -d www.deetechgroup.com --force-renewal
sudo systemctl enable --now certbot.timer
sudo certbot renew --dry-run
```

Add a deploy hook, so a renewed certificate is actually loaded. certbot
renewing without reloading nginx is how a site serves an expired certificate
for ninety days:

```bash
echo -e '#!/bin/sh\nsystemctl reload nginx' \
  | sudo tee /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh
sudo chmod +x /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh
```

Nightly backups (`sudo crontab -e`):

```cron
15 2 * * * cd /srv/deetech/site && infrastructure/deployment/backup.sh /srv/deetech/backups >> /var/log/deetech-backup.log 2>&1
45 2 * * * rclone copy /srv/deetech/backups remote:deetech-backups --max-age 48h
```

No `DATABASE_URL` and no `MEDIA_DIR` — `backup.sh` finds the container
itself. **A Docker volume is not a backup and neither is a file on the same
disk**; the second line is the one that matters.

Then:

- [ ] Point uptime monitoring at `/api/v1/health` and alert on the **body**,
      not just the status. A degraded database still returns 200.
- [ ] Run one restore drill (§6 of the runbook) and diary a monthly repeat.
- [ ] Submit the contact form once more on the real domain.

## 11. If something is wrong

| Scale | Action |
|---|---|
| A bad release | `sudo DEPLOY_MODE=host-nginx infrastructure/deployment/rollback.sh` |
| The site is broken and the fix is not obvious | Point DNS back at WordPress |

`rollback.sh` warns if migrations were added since the target commit.
Migrations are forward-only, so reverting code does not revert schema:
additive migrations are safe to roll back past, a drop or a rename needs a
restore instead, and it says so and stops.

---

## Still outstanding

- **Legal review** of the privacy policy and terms. They are drafts and the
  footer links them only once published.
- **About page facts**: real figures, the team roster, the founding year —
  the old site claimed both four and seven years.
- **Written permission** for the four named testimonials.
- **A GA4 property.** The old site had no analytics, so there is no baseline
  to compare the launch against. Set `NEXT_PUBLIC_GA_MEASUREMENT_ID` and
  redeploy; it is a build argument.
- **Vector logo artwork.**
