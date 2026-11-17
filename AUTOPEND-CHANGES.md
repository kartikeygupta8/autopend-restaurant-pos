# Changes made by AutoPend

Date of first change: 2026-11-06. Maintainer: AutoPend (Kartikey Gupta, hello@autopend.com).
Upstream: https://github.com/Raktim94/nodedr-restaurant-pos (commit history before this file is theirs).

Branding and contact details only; no business logic was changed.

- `apps/web/**` (45 files): visible product name "OrderRestro" / "Nodedr OrderRestro" changed to "AutoPend POS"
  in page text, titles, footers and docs pages; support link now mailto:hello@autopend.com; source link
  in Settings and the install snippet now point at this repository; footer credit states the modification.
- `apps/web/public/logo.png`, `brand-lockup.png`, `icons/*`: replaced with AutoPend marks (the Nodedr logo is
  not licensed by the AGPL, see TRADEMARK_POLICY.md). `manifest.json`: app name.
- `package.json` files: author is AutoPend; the original author is listed under `contributors`;
  repository/bugs/homepage point at AutoPend.
- `COPYRIGHT`, `NOTICE`, `README.md`: modification notice added. Original copyright lines unchanged.

Deliberately NOT changed (internal names; changing them breaks compatibility or stored data):
workspace package names `@nodedr-restaurant/*`, the `nodedr_session` cookie, `X-OrderRestro-*` webhook
headers, the `orderrestro-integration-secrets` encryption context, backup file names, database names,
Docker/CasaOS/deb/Windows packaging files, upstream docs (ARCHITECTURE, ROADMAP, CONTRIBUTING, MAINTAINERS),
`apps/web/app/docs/compliance-india/page.tsx` (describes the upstream's self-hosted model, needs a rewrite
for AutoPend-hosted deployments), and the mobile app in `mobile/`.

## 2026-11-17: AutoPend hosting controls (new, additive)

Added so AutoPend can host many restaurants and manage them from its admin portal. Nothing here changes what a
restaurant can do while its subscription is in order, and a server with no `AUTOPEND_ADMIN_KEY` and no licence
record (every self-hosted install) behaves exactly as before.

- `apps/backend/src/autopend/` (new module):
  - `GET /api/v1/autopend/stats`: the restaurant's own numbers (orders and revenue today / 7 / 30 days, open orders,
    staff, tables, menu items, last activity, version). No customer, staff or payment details are included.
  - `GET|PUT /api/v1/autopend/license`: the portal sets whether the subscription is active, its end date and grace days.
  - Both need the `X-AutoPend-Key` header to match `AUTOPEND_ADMIN_KEY` (32+ characters, compared in constant time).
    Without the variable the routes answer 404.
  - `GET /api/v1/license-status`: any signed-in person can see whether the subscription needs attention.
  - A global guard that, only when a licence says the account is suspended or past its grace period, refuses requests
    that change data with HTTP 402. Reading, exporting, signing in and payment-gateway notices keep working.
    If the licence cannot be read the request is allowed.
- `apps/backend/prisma/`: new table `autopend_license` (one row) and its migration.
- `apps/web/components/layout/license-banner.tsx`: a banner shown to staff when the subscription is ending or inactive.
