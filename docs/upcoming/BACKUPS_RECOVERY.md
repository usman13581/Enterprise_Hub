# Upcoming: Production backups and recovery

**Scope:** protect company data, uploaded files, and production access across
web, mobile, API, and Railway.

## Automated backups

- Schedule daily backups for the Railway PostgreSQL volume.
- Enable PostgreSQL point-in-time recovery where available.
- Schedule daily backups for the separate API uploads volume.
- Create daily compressed `pg_dump` exports to external object storage such as
  Cloudflare R2, Amazon S3, or Backblaze B2.
- Retain at least 30 days of database exports and verify that old backups
  expire as intended.

## Data covered

PostgreSQL backups must include:

- Users and companies
- Profiles and industry categories
- Products and product image records
- Customers, quotations, jobs, invoices, advances, and ledger entries
- Subscriptions, renewals, support, and audit logs

File backups must include:

- Product images
- Company logos and signatures
- Deposit proofs
- Support attachments
- Any generated documents stored on the volume

## Secrets and deployment recovery

Store these securely outside Git:

- Production database connection details
- `JWT_SECRET`
- Production bootstrap configuration
- Railway project/service identifiers
- Web/API domains and DNS records
- EAS project and signing access
- External backup storage credentials

Before wider customer rollout, disable bootstrap-token access in production and
remove any bootstrap token from public mobile build configuration. Use normal
email/password session authentication.

## Restore procedure

Document and rehearse this recovery path:

1. Create a replacement Railway project and PostgreSQL service.
2. Restore the latest off-site database export.
3. Restore uploads from object storage or the volume backup.
4. Deploy API and web from GitHub.
5. Reapply production environment variables.
6. Reconnect the domain and configure API CORS.
7. Verify login, permissions, images, PDFs, quotations, invoices, and mobile.

## Acceptance criteria

- A daily backup completes successfully.
- A recent database export can be restored to a clean database.
- At least one uploaded image and one uploaded document can be restored.
- Restore steps are tested without modifying the live production database.
- Backup status and age are visible to the operator.
