# Development roadmap

This is the execution order for the current beta-to-production work. Each
application change will be implemented and verified before the next dependent
step begins.

## Completed locally

1. **Search and pagination**
   - Added consistent general search and pagination to web/mobile collection
     screens, admin lists, subscription histories, and report result rows.
   - Search/filter changes reset to page one.
   - Standardized result ranges and mobile accessibility labels.
   - Web and mobile typechecks, web production build, and Android Expo bundle
     passed.
   - Local Marble web port is now `3002`; the separate website remains on
     `3000`.

2. **Earlier UI and beta fixes**
   - Web/mobile shell and navigation parity updates.
   - Notification visibility controlled by the shared feature flag.
   - Development API/debug and seeded login hints removed from visible screens.
   - Mobile admin-company import paths corrected.
   - Expo/Metro and local API connectivity fixes completed.

3. **Session and demo-trial foundation**
   - Added persisted server sessions with seven-day absolute and 30-minute idle
     expiry, revocation, logout, and stable session errors.
   - Added web warning/cross-tab handling and mobile foreground/resume handling.
   - Added seven-day demo provisioning, isolated sample data, encrypted
     one-time operator credential handoff, forced first-password change, and
     guarded cleanup dry-run/worker endpoints.
   - Added web/mobile password setup and expired-session/trial handling.
   - Added the exact API contract and integration steps for the separate
     marketing website repository.

The application changes are committed on `main`. The API and web services
still require the Railway rollout and production configuration below.

## Deferred

### Upload storage

Leave `UPLOAD_STORAGE.md` pending for now. Do not change the current upload
directory layout during the following work. Demo cleanup must support the
existing storage layout and require operator confirmation before deleting any
tenant.

## Execution order

### 1. Verification and controlled rollout

- Run the API regression suite with a database role that can create test
  databases.
- Verify demo provisioning, duplicate handling, credential handoff, password
  setup, session expiry, conversion protection, and cleanup dry-run.
- Deploy the API/web foundation from `main` after reviewing the schema update.
- Verify credential email delivery and company-admin trial cancellation.
- Keep destructive demo cleanup disabled until dry-run output is reviewed.

### 2. Website integration

- Give `DEMO_TRIAL_WEBSITE.md` to the website AI agent after the API rollout.
- Add the Enterprise Hub free-trial CTA and form in the separate repository.
- Connect to the production demo-request endpoint through the recommended
  same-origin server proxy.
- Show a safe confirmation and avoid account enumeration.
- Use the controlled beta credential-delivery process.

## Current next development item

The next implementation should be **verification and controlled rollout**,
followed by the separate website integration. Upload storage, backups/recovery,
and Stripe remain outside the current execution queue.
