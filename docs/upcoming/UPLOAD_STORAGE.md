# Upcoming: Segmented upload storage

**Scope:** web and mobile uploads use the same API and storage layout.

## Goal

Keep the current Railway volume for now, but stop writing every file into one
flat directory. Every new upload should be grouped by company, purpose, and
date so the volume stays manageable and can later map directly to S3/R2 keys.

## Target layout

```text
<UPLOADS_DIR>/
└── companies/
    └── <companyId>/
        └── <purpose>/
            └── <YYYY>/
                └── <MM>/
                    └── <uuid>.<extension>
```

Supported purposes:

- `product`
- `logo`
- `signature`
- `deposit`
- `support`

## Upload limits and image quality

The API must enforce these limits; web and mobile should show the same rules
before upload:

- Product images: maximum **2 images per product** — one default image and one
  extra image. The first image becomes default automatically. The second is
  extra. A third upload is rejected until an existing image is removed.
- Product images: maximum **5 MB per source image**, normalized to JPEG or WebP
  at a maximum 2560px long edge and quality around 82–85. The stored image
  should normally be approximately **0.5–2 MB**, while retaining enough
  resolution for quotation and invoice printing.
- Company logo and signature: maximum **2 MB per image**, normalized to a
  maximum 1600px long edge and a target of approximately **0.2–1 MB**.
- Deposit proofs and support images: maximum **5 MB per image**.
- PDF or other supported documents: maximum **12 MB per file**.
- Every upload purpose has an explicit allowed MIME list, maximum size, and
  count rule. These rules must be checked again by the API so client-side
  validation cannot be bypassed.

Image normalization should happen before storage where practical. The
original client filename must never determine the stored path or extension.
If transparency is required for a logo, retain PNG within the same size limit;
otherwise prefer JPEG or WebP.

## API work

- Add a validated upload-purpose allow-list.
- Resolve the company directory from the authenticated session, never from
  client input.
- Create nested directories recursively before writing with Multer.
- Keep MIME allow-listing, size limits, UUID filenames, and safe path handling.
- Enforce product-image count and default-image rules transactionally.
- Return nested `/static/...` URLs while continuing to serve existing legacy
  root-level URLs.
- Update file deletion to tolerate both nested and legacy URLs.

Primary files:

- `apps/api/src/uploads/uploads.constants.ts`
- `apps/api/src/uploads/uploads.controller.ts`
- `apps/api/src/products/products.service.ts`

## Client work

- Send the upload purpose from web and mobile.
- Carry purpose through offline image-sync records.
- Cover product images, company logo/signature, deposit proof, and support
  attachments.
- Show size, format, and remaining product-image count before upload.
- Keep product image ordering/default controls consistent on web and mobile.

Primary files:

- `apps/web/lib/api.ts`
- `apps/web/app/products/page.tsx`
- `apps/web/app/profile/page.tsx`
- `apps/web/app/subscription/page.tsx`
- `apps/mobile/lib/api.ts`
- `apps/mobile/lib/offline/syncEngine.ts`

## Compatibility and migration

- Do not move existing files in the first release.
- Add a dry-run inventory command for legacy files and database references.
- Move legacy files only after a verified volume and off-site backup.
- Keep the URL contract stable for existing product and profile records.

## Verification

- Test purpose validation, company isolation, path traversal protection,
  recursive directory creation, upload URLs, deletion, size limits, image
  normalization, and MIME rejection.
- Test that a product accepts exactly two images, rejects a third, and always
  has at most one default image.
- Smoke-test each purpose on web and mobile.
- Configure backups for the API uploads volume before any file migration.

## Future storage backend

When volume growth or backup requirements justify it, replace the filesystem
writer with S3/R2 object storage. The company/purpose/date key format should
remain unchanged.
