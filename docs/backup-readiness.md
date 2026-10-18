# Backup readiness

Two things hold SIWESFlow data, and both need a backup: the Postgres database
and the Supabase Storage bucket (`SUPABASE_STORAGE_BUCKET`, default `documents`).
A database restore without the bucket leaves every document row pointing at
nothing; a bucket restore without the database leaves orphaned files.

## What to back up

| Data | Where | How |
| --- | --- | --- |
| Database | Postgres (`DATABASE_URL`) | Daily `pg_dump`, plus the host's point-in-time recovery if the plan offers it |
| Documents | Supabase Storage bucket | Copy the bucket to a second location on the same schedule |
| Secrets | `.env` / host secrets | Stored in the team password manager, never in git |

Take the database dump and the bucket copy as close together as possible, and
store them together under the same date.

## Daily routine

```bash
# 1. sanity check before the backup (counts, migrations, document integrity)
npm run backup:check > backups/$(date +%F)-check.json

# 2. database dump (custom format, restorable with pg_restore)
pg_dump --format=custom --no-owner --file=backups/$(date +%F).dump "$DATABASE_URL"
```

Keep `backups/` out of git. Keep at least 7 daily and 4 weekly copies, in a
location that is not the same account as production.

## Restore drill

Run this once before the pilot and after any schema change, on a scratch
database, never on production:

```bash
createdb siwesflow_restore
pg_restore --no-owner --dbname siwesflow_restore backups/<date>.dump
DATABASE_URL=postgresql://localhost/siwesflow_restore npm run backup:check
```

Compare the `counts` in the new output with the `<date>-check.json` taken before
the dump. They must match. Then run `npm run audit:documents` against the
restored database and the restored bucket: it should report no
`STORAGE_OBJECT_MISSING` or `ORPHAN_STORAGE_OBJECT` issues.

## What the checks tell you

- `backup:check` exits 1 when the database or bucket is unreachable, a migration
  did not finish, or the document audit finds anything.
- `audit:documents` (and `GET /api/admin/integrity/documents`, platform admin
  only) lists each issue with a code: missing or orphaned storage objects, size
  mismatches, owner/type mismatches, extension/format mismatches, and
  verified documents without a reviewer. It is read-only.

## Open items

- Pick the off-site location for dumps and bucket copies and record it here.
- Schedule the daily routine (cron on the host, or a CI scheduled job).
- Decide the retention period for storage objects once a student's SIWES is
  completed.
