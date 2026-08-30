# Upcoming: Website demo-trial request form

**Audience:** website AI agent.

**Target page:** `https://prequaliq.com/products/enterprise-hub`

**Dependency:** complete and deploy the application/API work in
`DEMO_TRIAL_APPLICATION.md` before enabling this form for public traffic.
For the beta, controlled credential delivery may be handled manually; OTP
verification is not required.

**Application API status:** the application repository now exposes
`POST https://marble-api-production.up.railway.app/public/demo-requests`.
Confirm the production API origin at deployment time rather than hard-coding
the local development URL.

## Goal

Add a visible “Start free 7-day trial” or “Request a free demo” call to action
to the Enterprise Hub product page. The visitor submits basic company details,
the application API provisions a demo tenant, and the visitor receives
controlled temporary login details.

The website must remain a marketing frontend. It must not create database
records, generate passwords, seed data, or implement trial expiry itself.

## CTA and placement

- Add the CTA near the Enterprise Hub hero section and repeat it near the
  pricing/value section if that matches the existing design system.
- Use wording that accurately describes the offer: seven-day free trial,
  company workspace, sample data, and no payment required for the beta.
- Keep existing sign-in and contact/demo options distinct.
- Link to an accessible form section, modal, or dedicated trial-request route
  without losing the product-page context.
- Make the CTA work on desktop, tablet, and mobile widths.

## Form fields

Keep the first form short:

Required:

- Company name.
- Work email.

Optional, only if useful to the website's lead workflow:

- Contact name.
- Phone/WhatsApp.
- Country or emirate.
- Approximate team size.
- Short note about the business.

Do not request a password. Do not request a company ID, plan ID, trial length,
role, or any internal application field.

Use the website's existing labels, validation, spacing, typography, and
accessible error styles. Every field must have a visible label, keyboard
support, appropriate autocomplete, and a clear required/optional state.

## Submission contract

Submit over HTTPS to the application API's public endpoint:

```text
POST /public/demo-requests
```

Request JSON:

```json
{
  "companyName": "Required company name",
  "email": "Required work email",
  "contactName": "Optional contact name",
  "phone": "Optional phone or WhatsApp",
  "emirate": "Optional emirate or country",
  "approxUsers": "Optional team size",
  "note": "Optional short note",
  "honeypot": "Optional hidden spam field"
}
```

The API returns HTTP 201 with the same safe response for a new or duplicate
request:

```json
{
  "ok": true,
  "message": "Your seven-day Enterprise Hub trial is being prepared. Login details will be delivered separately."
}
```

The website agent must not hard-code a local API URL or expose private API
credentials in browser JavaScript. Prefer a same-origin Next.js route proxy
with a server-only `MARBLE_API_URL` environment variable; a direct browser
request is acceptable only when the production API CORS origin is configured.

Client-side behavior:

- Trim values and validate company name and email before submission.
- Disable the submit button while the request is in progress.
- Prevent duplicate submissions caused by double-clicks or retries.
- Show field-level errors where possible and a safe general error otherwise.
- Preserve entered values after a recoverable network error.
- Include the site's spam-control field or token if the API contract requires
  one, but never treat client-side spam controls as sufficient protection.

## Success and duplicate-email behavior

Show a clear confirmation after a successful request:

> Your seven-day Enterprise Hub trial is being prepared. You will receive
> login details and must change the temporary password at first login.

Explain that the user must change the temporary password before using the
application. Do not show or generate credentials in the browser.

For an email that already belongs to a user or has already claimed a trial,
the API should return the same public response to avoid account enumeration and
send the appropriate sign-in, activation, or password-reset message. If the
business requires an explicit “company already exists” prompt, only show it
after the email owner has been verified.

The page should provide a “Resend details” path with rate limiting, not create
another company or extend the trial.

## Credential delivery handoff

The application owns credential generation and delivery status. After the
demo company is committed, the API sends the web-app URL, mobile-app URL,
username, temporary complex password, and trial end date through its configured
mailer. The website must:

- Use the canonical login URL supplied by the application team.
- Never generate, display, or log the temporary password.
- Display a support/contact path if the credentials do not arrive.
- Never log passwords, form payloads, or private delivery notes in analytics.

If provider delivery fails, the application keeps an encrypted admin fallback.
The website must not send a second set of credentials or implement OTP
independently. The Resend key and sender configuration belong only in the API
repository/environment.

## Privacy, consent, and abuse controls

- Add the website's privacy-policy/terms link and consent copy appropriate to
  collecting company and contact information.
- Explain that submitted data is used to create and support the requested
  beta workspace.
- Include bot protection, rate limiting, and a honeypot as supported by the
  API.
- Do not expose API error details, database IDs, tenant slugs, or whether an
  email exists.
- Add a success/failure event to the existing analytics system without
  recording email addresses or company names.

## Website acceptance criteria

- The CTA is visible and usable on the Enterprise Hub product page.
- The form works on desktop and mobile and meets the website accessibility
  standard.
- Company name and email are mandatory; optional fields do not block a
  submission.
- A successful submission produces one API request and one safe confirmation.
- The user receives login details from the application mailer and is forced to
  change the temporary password at first login.
- Duplicate clicks, retries, existing emails, and API failures do not create
  duplicate companies or reveal account existence.
- The website points to the production API over HTTPS with the required CORS
  origin configured.
- The form is released only after the application API, controlled credential
  delivery, trial cleanup, backups, and monitoring have been verified.

## Integration plan for `/Users/muhammadusmanfarooqmuhammadusman/Projects/prequaliq_website`

The marketing repository is Next.js App Router with Tailwind, English/Swedish
i18n, and reusable `Button`/contact-form patterns. Implement only the
marketing integration there:

1. Add a small client component such as
   `src/components/products/EnterpriseHubTrialForm.tsx` using the existing
   rounded input, button, error, and success styles.
2. Add a same-origin server route at
   `src/app/api/enterprise-hub/demo-request/route.ts`. It should validate and
   trim the two required fields, forward the allow-listed payload to
   `${MARBLE_API_URL}/public/demo-requests`, apply a short request timeout, and
   return only a generic success/error result to the browser.
3. Add `MARBLE_API_URL=https://marble-api-production.up.railway.app` to the
   website deployment environment, never to client-exposed variables.
4. Update
   `src/app/products/enterprise-hub/page.tsx` so the hero CTA scrolls to or
   opens the trial form, while retaining the existing `/contact` CTA for
   implementation discussions.
5. Add English and Swedish labels/messages in
   `src/i18n/locales/en.ts` and `src/i18n/locales/sv.ts`. Do not expose API
   IDs, duplicate-email details, temporary passwords, or raw API errors.
6. Add privacy/terms consent copy and a hidden honeypot field consistent with
   the website's existing contact experience. Do not log email, company name,
   or response payload in analytics.

The application API creates the workspace and temporary credentials. The
website only submits the request and displays the safe confirmation:

> Your seven-day Enterprise Hub trial is being prepared. You will receive
> login details and must change the temporary password at first login.

## Handoff checklist for the website agent

- Confirm the production API base URL and endpoint schema above.
- Confirm the login URL, credential-delivery process, and wording supplied by
  the application team.
- If using the recommended same-origin proxy, confirm the proxy is deployed
  and `MARBLE_API_URL` is server-only. If using direct browser requests,
  confirm the API CORS origin for `https://prequaliq.com`.
- Add the CTA and form without changing unrelated product-page content.
- Test a new email, duplicate email, malformed email, blank company name,
  double-submit, API timeout, and mobile layout.
- Provide the application team with the deployed form URL and a timestamped
  test request ID, without sharing any password or delivery secret.
