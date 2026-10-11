-- 003 — brands and products
--
-- Authored 2026-10-11 from https://anpred.com/ (the site's own homepage,
-- /infrashield and /about pages). Nothing here is inferred: every claim below
-- is one AnPreD makes about itself.
--
-- RELATIONSHIP TO THE GROUP
-- The AnPreD site footer reads: "© 2026 AnPreD. Owned by Dee Tech Group",
-- linking to www.deetechgroup.com. That establishes ownership, but it does
-- NOT establish that AnPreD is a separately incorporated company — and the
-- project plan is explicit that "subsidiary" may only be used when the legal
-- structure supports it. `product_brand` is therefore the accurate and
-- conservative choice; it renders as "A product brand by DeeTech Group".
--
-- If AnPreD IS separately incorporated, this is a one-field change:
--   UPDATE brands SET relationship_type = 'subsidiary' WHERE slug = 'anpred';
-- Do that only with the ownership structure confirmed in writing.
--
-- Idempotent, like every seed: re-running updates the rows in place.

INSERT INTO brands (name, slug, relationship_type, tagline, description,
                    logo_url, website_url, status, sort_order,
                    seo_title, seo_description)
VALUES (
  'AnPreD',
  'anpred',
  'product_brand',
  'Intelligent infrastructure security, management and automation',
  'AnPreD builds self-hosted tooling for teams that run their own server fleets. Its name is its method: Analyzation, Prediction, Remediation and Detection — inventory scanning with drift detection, composite risk scoring, automated patching and provisioning, and CIS/OpenSCAP compliance enforcement, brought together in one platform rather than stitched together from a dozen vendors.

The deliberate constraint is that everything runs on infrastructure you control. Server inventories, SSH keys and vulnerability data never leave your estate, which makes AnPreD usable in fully air-gapped environments where a cloud-dependent tool simply is not an option.',
  '/brand/anpred-logo.png',
  'https://anpred.com/',
  'published',
  1,
  'AnPreD — Infrastructure Security and Automation',
  'AnPreD builds AnPreD InfraShield: self-hosted SSH key management, just-in-time access, CIS compliance and patch automation for server fleets. A product brand by DeeTech Group.'
)
ON CONFLICT (slug) DO UPDATE SET
  name = EXCLUDED.name,
  relationship_type = EXCLUDED.relationship_type,
  tagline = EXCLUDED.tagline,
  description = EXCLUDED.description,
  logo_url = EXCLUDED.logo_url,
  website_url = EXCLUDED.website_url,
  status = EXCLUDED.status,
  sort_order = EXCLUDED.sort_order,
  seo_title = EXCLUDED.seo_title,
  seo_description = EXCLUDED.seo_description;

-- InfraShield is AnPreD's platform, so brand_id is resolved by slug rather
-- than hardcoded — the id depends on insert order and must not be assumed.
INSERT INTO products (brand_id, name, slug, summary, description,
                      website_url, documentation_url, download_url,
                      lifecycle, status, sort_order,
                      seo_title, seo_description)
VALUES (
  (SELECT id FROM brands WHERE slug = 'anpred'),
  'InfraShield',
  'infrashield',
  'Self-hosted infrastructure security for server fleets: SSH key rotation, just-in-time access, CIS compliance scoring and air-gapped patch management in one platform.',
  'AnPreD InfraShield consolidates infrastructure security into a single self-hosted platform of 19+ feature modules, organised around four capabilities.

**Identity and access.** Automated SSH key rotation on a configurable schedule, across server groups, with full key history, verification and one-click rollback. Just-in-time access grants are time-limited and run through bastion-based recorded sessions, so there are no standing privileges and every action is in the audit trail. Role-based access control runs from superuser down to viewer, scoped per module, with ready-to-copy least-privilege sudoers entries.

**Security and compliance.** CIS benchmark profiles run against the fleet through OpenSCAP, with background scans, pass/fail/not-applicable results and score-over-time tracking. Custom SCAP content can be uploaded. A composite risk score from 0 to 100 is calculated across five categories, with PDF and Excel export and a fleet-wide risk spreadsheet.

**Automation and operations.** Vulnerability reports from Tenable and Nessus are ingested, packages fetched with full dependency resolution, and served either from a built-in HTTP repository or as a zip for air-gapped environments. A dry run is mandatory before anything is applied. A cron-based scheduler drives recurring key rotation, inventory scans and compliance checks.

**Infrastructure and monitoring.** Full hardware, OS, software and security inventory scans with historical storage and drift detection. Proxmox provisioning and monitoring are working today, with AWS, Azure, OCI, UpCloud and VMware planned. Zabbix integrates through its API for trend charts and notifications, with link-out to Grafana dashboards.

Deployment is three steps: install on a management server with a single command, add servers over SSH with least-privilege access, then scan, score and automate.',
  'https://anpred.com/infrashield',
  'https://anpred.com/documentation',
  'https://anpred.com/download',
  'available',
  'published',
  1,
  'AnPreD InfraShield — Self-Hosted Infrastructure Security',
  'SSH key rotation, just-in-time access, CIS/OpenSCAP compliance scoring and air-gapped patch management for your whole server fleet. Self-hosted, with no cloud dependency.'
)
ON CONFLICT (slug) DO UPDATE SET
  brand_id = EXCLUDED.brand_id,
  name = EXCLUDED.name,
  summary = EXCLUDED.summary,
  description = EXCLUDED.description,
  website_url = EXCLUDED.website_url,
  documentation_url = EXCLUDED.documentation_url,
  download_url = EXCLUDED.download_url,
  lifecycle = EXCLUDED.lifecycle,
  status = EXCLUDED.status,
  sort_order = EXCLUDED.sort_order,
  seo_title = EXCLUDED.seo_title,
  seo_description = EXCLUDED.seo_description;
