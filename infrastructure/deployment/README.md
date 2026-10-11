# Deployment

- `generate-redirects.mjs` — compiles `docs/redirects.csv` into
  `infrastructure/nginx/snippets/deetech-redirects.conf`, validating as it goes.
  Run via `npm run redirects:build`. CI fails if the output is out of date.

Still to come:

- `docker-compose.prod.yml` (Day 26) — adds nginx, TLS and restart policies.
- `deploy.sh` (Day 28) — repeatable deploy with migration and health gate.
- `backup.sh` (Day 25) — off-server database and media backup. A Docker volume
  is not a backup.
