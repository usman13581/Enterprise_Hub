# Enterprise Hub trial form — website integration handoff

**For:** the `prequaliq_website` repository  
**Repository:** `/Users/muhammadusmanfarooqmuhammadusman/Projects/prequaliq_website`  
**Page:** `src/app/products/enterprise-hub/page.tsx`

## Goal

Add a responsive “Start free 7-day trial” form to the Enterprise Hub marketing
page. The marketing website only submits the request and displays a safe
confirmation. The Marble application API creates the company, sample data,
trial subscription, and temporary credentials.

Do not create database records, generate passwords, seed data, or implement
trial expiry in the marketing repository.

## Application API contract

Production API base:

```text
https://marble-api-production.up.railway.app
```

Endpoint:

```text
POST /public/demo-requests
```

Recommended request body:

```json
{
  "companyName": "Example Marble LLC",
  "email": "owner@example.com",
  "contactName": "Optional contact",
  "phone": "+971500000000",
  "emirate": "Dubai",
  "approxUsers": "1-10",
  "note": "Optional note",
  "honeypot": ""
}
```

Only `companyName` and `email` are required. The API trims and normalizes
these values. It ignores a filled honeypot with a safe success response.

Success response for both new and duplicate requests:

```json
{
  "ok": true,
  "message": "Your seven-day Enterprise Hub trial is being prepared. Login details will be delivered separately."
}
```

The browser must never receive a temporary password, tenant ID, company slug,
or duplicate-email status.

## Recommended implementation

Use a same-origin Next.js proxy so the API origin and deployment secrets remain
server-side:

1. Add `MARBLE_API_URL=https://marble-api-production.up.railway.app` to the
   website deployment environment. Do not use `NEXT_PUBLIC_` for this value.
2. Create
   `src/app/api/enterprise-hub/demo-request/route.ts`.
3. Validate and trim `companyName` and `email` in the route.
4. Forward only the allow-listed optional fields to
   `${MARBLE_API_URL}/public/demo-requests`.
5. Apply a short upstream timeout and return a generic error to the browser.
6. Never log the request body, email address, company name, password, or API
   response payload.

Direct browser submission to the API is allowed only if the production API
explicitly allows `https://prequaliq.com` through `CORS_ORIGINS`.

## Website files to change

### Form component

Create:

```text
src/components/products/EnterpriseHubTrialForm.tsx
```

Follow the existing patterns in:

- `src/components/contact/ContactForm.tsx`
- `src/components/ui/Button.tsx`
- `src/components/ui/Modal.tsx`

The component should:

- Use a visible label for every field.
- Require company name and work email.
- Use suitable `autocomplete` values.
- Disable controls during submission.
- Prevent double-submit.
- Preserve values after a recoverable failure.
- Show an accessible success state and a safe general error.
- Include a visually hidden honeypot field.
- Work on mobile, tablet, and desktop widths.

Recommended optional fields are contact name, phone/WhatsApp, country or
emirate, approximate team size, and a short note. Do not ask for a password,
company ID, plan ID, role, or trial duration.

### Enterprise Hub page

Update:

```text
src/app/products/enterprise-hub/page.tsx
```

- Change the hero trial CTA to scroll to or open the trial form.
- Keep the existing `/contact` CTA for implementation and consulting enquiries.
- Place a second form CTA near the pricing/value section only if it fits the
  current page design.
- Do not remove the existing product content.

### Translations

Add English and Swedish copy in:

```text
src/i18n/locales/en.ts
src/i18n/locales/sv.ts
```

Use copy that accurately explains:

- Free seven-day Enterprise Hub trial.
- Sample company data is created automatically.
- No payment is required for the beta.
- Temporary login details are delivered separately.
- The temporary password must be changed at first login.

### Server proxy

Create:

```text
src/app/api/enterprise-hub/demo-request/route.ts
```

The proxy should return a small response shape such as:

```json
{ "ok": true, "message": "..." }
```

For upstream failures, return a generic message and an appropriate 4xx/5xx
status. Do not pass through raw API, database, or validation details.

## UX and privacy requirements

- Link to the existing privacy policy and terms.
- Explain how submitted company/contact information is used.
- Do not reveal whether an email already belongs to an account.
- Do not record form payloads in analytics.
- If analytics is used, record only anonymous `trial_form_view`,
  `trial_form_submit`, and `trial_form_success` events.
- Keep the form keyboard accessible and announce errors/success to assistive
  technology.
- Use the website’s existing rounded inputs, accent colors, spacing, and
  responsive layout conventions.

## Credential handoff

The application API generates a cryptographically random temporary password
and sends it after provisioning through its configured Resend mailer. The
message contains the canonical web-app URL, mobile-app URL, username,
temporary password, trial end date, and the first-login password-change
instruction. The website must not generate, display, or email credentials.

If provider delivery fails, the API retains an encrypted, one-time admin
handoff so the platform operator can deliver the details manually. The
website should direct users to support if the email does not arrive.

The website success message should say:

> Your seven-day Enterprise Hub trial is being prepared. You will receive
> login details and must change the temporary password at first login.

The API service must have `RESEND_API_KEY`, `MAIL_FROM`, `MAIL_REPLY_TO`,
`WEB_APP_URL`, and `MOBILE_APP_URL` configured. These are API/Railway
variables; do not place the Resend key in the marketing website or browser
bundle.

## Testing checklist

- New valid request submits exactly once.
- Company name is required.
- Email is required and validated.
- Optional fields do not block submission.
- Double-click does not create duplicate requests.
- Duplicate email receives the same safe success state.
- API timeout preserves entered values.
- API failure shows a generic accessible error.
- No password or private API data appears in browser logs or analytics.
- CTA and form work at mobile, tablet, and desktop widths.
- Keyboard navigation and screen-reader labels are correct.
- Production proxy uses server-only `MARBLE_API_URL`.
- The final request reaches:
  `https://marble-api-production.up.railway.app/public/demo-requests`.
