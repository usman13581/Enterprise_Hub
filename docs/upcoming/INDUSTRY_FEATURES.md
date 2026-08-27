# Upcoming: company category and special features

Delete this file when this is built. Index: [README.md](./README.md).

**Web and mobile.** Core app is generic. Special screens (Counter Top quotations today) turn on only when platform admin sets a **company category** that is linked to that **feature**. No category = general quotation and all general modules only.

When you say go ahead: implement in the order at the bottom. Do not scatter `if (marble)` in random files — only `hasFeature('quotation.counter_top')`.

## Behaviour

| Admin sets on company | What users see |
| --- | --- |
| Category **empty** | Customers, products, **general** quotations, jobs, invoices, advances, accounts, reports. No Counter Top create. No spec-lookup tab for Counter Top. |
| Category **Marble / stone** | Everything above **plus** Counter Top quotations (web + mobile). |

Existing Counter Top rows for that company stay openable if they already exist. Creating new ones is blocked when the feature is off (API 403 + UI hidden).

Binhaj seed: category `marble`. New companies (Get started): category **null** until admin chooses.

## Data

```
IndustryCategory     code unique (marble, …), name, active
AppFeature           key unique (quotation.counter_top), label, active
AppFeatureOnCategory featureId + categoryId
Company              industryCategoryId nullable
```

Link: `quotation.counter_top` ↔ category `marble`.

Later special: new `AppFeature` + link to a category. No second app.

## API

Session or `GET /company/me` includes:

```json
{
  "industryCategory": { "id": "", "code": "marble", "name": "Marble / stone" },
  "features": ["quotation.counter_top"]
}
```

Generic company: `"industryCategory": null`, `"features": []`.

- `POST`/`PUT` quotation `kind: counter_top` without feature → 403
- `PATCH /admin/companies/:id` `{ "industryCategoryId": "<id>" | null }`
- Never trust the client to send “I am marble”

## UI

Helper: `hasFeature(features, 'quotation.counter_top')`.

- Kind picker: hide Counter Top if false; if only general, skip picker and open general form
- Hide routes `/quotations/counter-top` and mobile `quotations-counter-top` for create; deep link → list + message
- Lookups: hide Counter Top / spec library if false

Files: `apps/web/app/quotations/page.tsx`, `counter-top/page.tsx`, `apps/mobile/app/module/quotations.tsx`, `quotations-counter-top.tsx`, `packages/types/src/enums.ts`.

## Tests

- Company with no category: POST counter_top 403; general quote 201
- Company with marble: POST counter_top 201
- Foreign company cannot enable another tenant’s category by body field

## Build order

1. Prisma + seed marble + feature + Binhaj assigned, others null
2. `features[]` on session / company me
3. API gate on quotation kind
4. Web + mobile hide/show
5. Admin category select (company + Get started approve)
6. Tests

## Out of scope

- Per-user flags
- Renaming `@marble/*`
- New industries until you add a feature row
