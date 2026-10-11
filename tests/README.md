# Cross-service tests

- `integration/` — API + database tests that need a live PostgreSQL (Week 3).
- `end-to-end/` — Playwright suite covering the public site and the admin CMS
  (Week 5, Day 24).

Unit tests live beside the code they test, in each workspace's own `tests/`
directory. `apps/api/tests` is the only one populated so far.
