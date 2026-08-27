# Upcoming: Enterprise Hub name, credit line, and version

Delete this file when branding + version display are done. Index: [README.md](./README.md).

## Copy

- App name: **Enterprise Hub**
- Credit: **Powered by Enterprise Hub at Prequaliq.com**
- Version shown as **v1.0.0** (semver)

Do not rename `@marble/*` packages, git repo, or `x-marble-token`. Keep seed company **Binhaj Marble**.

**Web and mobile both** show name, credit, and version.

---

## Where the version number comes from

**One product version**, not four different `package.json` numbers.

| Source | Role |
| --- | --- |
| `packages/types/src/brand.ts` | **Source of truth** for what the UI prints: `APP_NAME`, `APP_POWERED_BY`, `APP_VERSION` |
| `apps/web/package.json` `"version"` | Keep equal to `APP_VERSION` at release (Next can also expose it as `NEXT_PUBLIC_APP_VERSION` at build) |
| `apps/mobile/app.json` `"expo.version"` | Same number (App Store / Play / Expo Go label) |
| `apps/mobile/package.json` `"version"` | Same number |
| `apps/api/package.json` `"version"` | Same number; optional `GET /health` returns `{ version }` for support |

Today versions are mixed (`0.0.1` vs mobile `1.0.0` in app.json). First release: set **1.0.0** everywhere that users see.

**Do not** take the version from git commit as the main label (Railway hashes change every deploy). Optional extra for support only: env `GIT_SHA` last 7 chars, shown in tiny type next to version, not instead of it.

**How you bump:** change `APP_VERSION` in `brand.ts`, then set web/mobile/api `package.json` + `app.json` to the same string before a release. Semver: patch = fix, minor = features, major = breaking.

---

## How to show it

Same pattern on web and mobile:

```
Enterprise Hub
Powered by Enterprise Hub at Prequaliq.com
v1.0.0
```

Credit and version stay quiet (small, muted). Name stays the heading.

| Surface | What to show |
| --- | --- |
| Web app footer | Credit + `v{APP_VERSION}` |
| Web login | Name, then credit, then version |
| Web sidebar brand | Name `Enterprise Hub` (version stays in footer, not in the big title) |
| Mobile login | Name, credit, version (bottom of the screen is fine) |
| Mobile under **Sign out** | Credit, then version on the next line |
| Future admin shell | Same footer (web + mobile) |
| **PDF first page only** | Existing company/TRN footer on all pages; on **page 1** add credit + `v{APP_VERSION}` |

PDF page 2+ : no powered-by / version line.

---

## Files to touch (when building)

- New: `packages/types/src/brand.ts` + export from `index.ts`
- Web: `app/layout.tsx` title, `AppShell.tsx` footer, `login/page.tsx`, home copy
- Mobile: `login.tsx`, `index.tsx` under Sign out, `app.json` `expo.name` + `expo.version`
- PDF: `packages/pdf/src/elements.ts` first-page footer (`pageNumber === 1`)

---

## Checklist

- [ ] `APP_NAME`, `APP_POWERED_BY`, `APP_VERSION` in `@marble/types`
- [ ] Align web / mobile / api package versions + Expo `version` to `APP_VERSION`
- [ ] Web footer + login show credit and version
- [ ] Mobile login + under Sign out show credit and version
- [ ] Expo display name `Enterprise Hub`
- [ ] PDF first page only: credit + version
- [ ] Optional: `GET /health` returns version
