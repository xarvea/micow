#!/usr/bin/env bash
set -Eeuo pipefail

: "${SOURCE_DATABASE_URL:?Set SOURCE_DATABASE_URL to the database to back up}"
: "${RESTORE_DATABASE_URL:?Set RESTORE_DATABASE_URL to a separate, empty restore database}"

command -v pg_dump >/dev/null || { echo "ERROR: pg_dump is required" >&2; exit 127; }
command -v pg_restore >/dev/null || { echo "ERROR: pg_restore is required" >&2; exit 127; }
command -v psql >/dev/null || { echo "ERROR: psql is required" >&2; exit 127; }

source_name="$(psql -X -A -t -v ON_ERROR_STOP=1 "$SOURCE_DATABASE_URL" -c 'SELECT current_database()')"
restore_name="$(psql -X -A -t -v ON_ERROR_STOP=1 "$RESTORE_DATABASE_URL" -c 'SELECT current_database()')"

if [[ -z "$source_name" || -z "$restore_name" || "$source_name" == "$restore_name" ]]; then
  echo "ERROR: source and restore must be distinct databases" >&2
  exit 2
fi

source_tables="$(psql -X -A -t -v ON_ERROR_STOP=1 "$SOURCE_DATABASE_URL" -c "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('indexed_blocks','indexed_events','tokens','trades')")"
if [[ "$source_tables" != "4" ]]; then
  echo "ERROR: source database is missing one or more expected MICOW tables" >&2
  exit 3
fi

restore_table_count="$(psql -X -A -t -v ON_ERROR_STOP=1 "$RESTORE_DATABASE_URL" -c "SELECT count(*) FROM pg_tables WHERE schemaname NOT IN ('pg_catalog','information_schema')")"
if [[ "$restore_table_count" != "0" ]]; then
  echo "ERROR: restore database '$restore_name' is not empty; refusing to overwrite data" >&2
  exit 4
fi

work_dir="$(mktemp -d "${TMPDIR:-/tmp}/micow-backup-restore.XXXXXXXX")"
chmod 700 "$work_dir"
trap 'rm -rf "$work_dir"' EXIT
dump_file="$work_dir/micow.dump"
umask 077

snapshot() {
  psql -X -A -t -v ON_ERROR_STOP=1 "$1" <<'SQL'
SELECT 'indexed_blocks=' || count(*) FROM indexed_blocks
UNION ALL SELECT 'indexed_events=' || count(*) FROM indexed_events
UNION ALL SELECT 'tokens=' || count(*) FROM tokens
UNION ALL SELECT 'trades=' || count(*) FROM trades
UNION ALL SELECT 'max_indexed_block=' || COALESCE(max(block_number)::text, 'NULL') FROM indexed_blocks
ORDER BY 1;
SQL
}

before="$(snapshot "$SOURCE_DATABASE_URL")"
pg_dump --format=custom --no-owner --no-privileges --file "$dump_file" "$SOURCE_DATABASE_URL"
pg_restore --list "$dump_file" >/dev/null
pg_restore --exit-on-error --no-owner --no-privileges --dbname="$RESTORE_DATABASE_URL" "$dump_file"
after="$(snapshot "$RESTORE_DATABASE_URL")"

if [[ "$before" != "$after" ]]; then
  echo "ERROR: restored database verification mismatch" >&2
  echo "Source snapshot:" >&2
  printf '%s\n' "$before" >&2
  echo "Restore snapshot:" >&2
  printf '%s\n' "$after" >&2
  exit 5
fi

echo "PASS: backup restored into separate empty database '$restore_name'; table counts and max indexed block match."
printf '%s\n' "$after"
