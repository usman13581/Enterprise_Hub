# Upcoming: Stripe billing (deferred)

Delete this file when Stripe is scheduled and shipped. Index: [README.md](./README.md).

**Do not implement until explicitly scheduled.** Manual renewals + bank deposit remain the live path.

## Later scope

- `stripePriceId` on `Plan`
- Stripe customer / subscription ids on `CompanySubscription`
- Checkout session for company admin or public upgrade
- Customer portal for payment method updates
- Webhooks: invoice paid, subscription updated, past_due, cancelled
- Map webhook events → subscription status + in-app notifications to company admins
- Env: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, publishable key for web/mobile if needed

## Locked until then

- `billingChannel` stays `manual`
- No Stripe buttons on Get started or subscription screens
- Platform admin still records manual payments and approves renewal deposits
