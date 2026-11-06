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
