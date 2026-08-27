# Upcoming: UI shell, brand tokens, dashboards

Delete this file when the checklist below is done. Index: [README.md](./README.md). Stripe: [STRIPE.md](./STRIPE.md).

**Web and mobile.** Logo mark is **login screens only** (company + platform). In-app chrome uses text brand “Enterprise Hub” / monogram “EH” — never the Prequaliq mark in the sidebar.

## Color tokens (from prequaliq.com)

| Token | Value | Use |
| --- | --- | --- |
| Primary / ink | `#0f2744` | Headings, brand text |
| Primary mid | `#1a3a5c` | Dark accents |
| Accent | `#2563eb` | Active nav, primary buttons, metric bar |
| Accent soft | `#eff6ff` | Active wash, soft surfaces |
| Gold | `#c9a227` | Trial / pending chips only |
| Surface / bg | `#f4f6f9` / `#fafbfc` | Page |
| Card / border | `#ffffff` / `#e8ecf1` | Panels |

Source of truth in app: `apps/web/app/globals.css`, `apps/mobile/lib/ui.ts`.

## Login mark

- Asset: `apps/web/public/brand/prequaliq-mark.png`, `apps/mobile/assets/prequaliq-mark.png` (copied from Prequaliq website `public/images/logo.png`).
- Show above product name on: web `/login`, `/admin/login`; mobile `login.tsx`, `admin-login.tsx`.
- Do **not** put the mark in AppShell, AdminShell, PDF, or module pages.

## Icon-rail sidebar (web)

- Expanded ~260px / collapsed ~72px; toggle; `localStorage` key `eh.sidebar.collapsed`.
- Collapsed: icons + tooltips; brand monogram **EH**.
- Mobile web (&lt;900px): hamburger + drawer overlay (not icon rail).
- Nav groups: Work · Insights · Account (company); Overview · Tenants · Billing · Ops (platform).
- Same pattern on company `AppShell` and platform `AdminShell`.

## Dashboard mosaic

- Company admin Home + platform admin Home: hero strip + metric mosaic + shortcuts.
- Same APIs (`GET /company/dashboard`, `GET /admin/overview`). No chart libraries.
- Members: module launcher tiles on the new surfaces.
- Mobile: hero chip + accent-bar `StatCard` mosaic / shortcuts.

## Checklist

- [x] Prequaliq CSS / mobile color tokens
- [x] Login-only Prequaliq mark (web + mobile, company + admin)
- [x] Icon-rail collapse + drawer (AppShell + AdminShell)
- [x] Nav grouping
- [x] Company admin dashboard mosaic (web)
- [x] Platform admin dashboard mosaic (web)
- [x] Mobile home / admin overview visual parity
- [x] Sign out placed with Support in sidebar / account footer (web + mobile)
- [ ] Optional polish: SVG icon set instead of unicode glyphs; denser PDF report chrome
