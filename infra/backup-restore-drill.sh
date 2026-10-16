#!/usr/bin/env bash
set -Eeuo pipefail

: "${SOURCE_DATABASE_URL:?Set SOURCE_DATABASE_URL to the database to back up}"
: "${RESTORE_DATABASE_URL:?Set RESTORE_DATABASE_URL to a separate, empty restore database}"

command -v python3 >/dev/null || { echo "ERROR: python3 is required to validate PostgreSQL endpoints" >&2; exit 127; }
command -v pg_dump >/dev/null || { echo "ERROR: pg_dump is required" >&2; exit 127; }
command -v pg_restore >/dev/null || { echo "ERROR: pg_restore is required" >&2; exit 127; }
command -v psql >/dev/null || { echo "ERROR: psql is required" >&2; exit 127; }

# This drill is deliberately local-only. Remote recovery must use a separate,
# reviewed operator procedure rather than an environment-variable override here.
assert_loopback_database_url() {
  local variable_name="$1"
  local database_url="$2"

  MICOW_DATABASE_URL_TO_VALIDATE="$database_url" python3 - "$variable_name" <<'PY'
import ipaddress
import os
import sys
from urllib.parse import parse_qsl, urlsplit

variable_name = sys.argv[1]
database_url = os.environ.get("MICOW_DATABASE_URL_TO_VALIDATE", "")

def reject() -> None:
    print(
        f"ERROR: {variable_name} must be a PostgreSQL URI using a loopback IP literal; "
        "remote endpoints and libpq host/service overrides are not allowed by this drill",
        file=sys.stderr,
    )
    raise SystemExit(10)

try:
    parsed = urlsplit(database_url)
    if parsed.scheme not in ("postgres", "postgresql") or not parsed.hostname or parsed.fragment:
        reject()
    if any(key.lower() in {"host", "hostaddr", "service"} for key, _ in parse_qsl(parsed.query, keep_blank_values=True)):
        reject()
    address = ipaddress.ip_address(parsed.hostname)
    _ = parsed.port  # Force validation of malformed ports.
    if not address.is_loopback:
        reject()
except (ValueError, TypeError):
    reject()
PY
}

# Validate both URLs before the first network/database operation.
assert_loopback_database_url SOURCE_DATABASE_URL "$SOURCE_DATABASE_URL"
assert_loopback_database_url RESTORE_DATABASE_URL "$RESTORE_DATABASE_URL"

source_name="$(psql -X -A -t -v ON_ERROR_STOP=1 "$SOURCE_DATABASE_URL" -c 'SELECT current_database()')"
restore_name="$(psql -X -A -t -v ON_ERROR_STOP=1 "$RESTORE_DATABASE_URL" -c 'SELECT current_database()')"

if [[ -z "$source_name" || -z "$restore_name" || "$source_name" == "$restore_name" ]]; then
  echo "ERROR: source and restore must be distinct databases" >&2
  exit 2
fi

source_tables="$(psql -X -A -t -v ON_ERROR_STOP=1 "$SOURCE_DATABASE_URL" -c "SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('indexed_blocks','indexed_events','tokens','trades') AND table_type = 'BASE TABLE'")"
if [[ "$source_tables" != "4" ]]; then
  echo "ERROR: source database is missing one or more expected MICOW base tables" >&2
  exit 3
fi

# Reject any existing user-defined database objects that could conflict with a
# restore, including views/sequences and non-table objects. System catalogs and
# PostgreSQL's default public schema are not treated as user content.
restore_object_count="$(psql -X -A -t -v ON_ERROR_STOP=1 "$RESTORE_DATABASE_URL" -c "
SELECT count(*) FROM (
  SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname !~ '^pg_'
     AND n.nspname <> 'information_schema'
     AND c.relkind IN ('r', 'p', 'v', 'm', 'S', 'f')
  UNION ALL
  SELECT 1
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname !~ '^pg_'
     AND n.nspname <> 'information_schema'
  UNION ALL
  SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
   WHERE n.nspname !~ '^pg_'
     AND n.nspname <> 'information_schema'
     AND t.typtype <> 'b'
  UNION ALL
  SELECT 1
    FROM pg_extension e
    JOIN pg_namespace n ON n.oid = e.extnamespace
   WHERE n.nspname !~ '^pg_'
     AND n.nspname <> 'information_schema'
  UNION ALL
  SELECT 1
    FROM pg_namespace
   WHERE nspname NOT IN ('pg_catalog', 'information_schema', 'public')
     AND nspname !~ '^pg_'
  UNION ALL
  SELECT 1
    FROM pg_collation c
    JOIN pg_namespace n ON n.oid = c.collnamespace
   WHERE n.nspname !~ '^pg_'
     AND n.nspname <> 'information_schema'
  UNION ALL
  SELECT 1
    FROM pg_conversion c
    JOIN pg_namespace n ON n.oid = c.connamespace
   WHERE n.nspname !~ '^pg_'
     AND n.nspname <> 'information_schema'
  UNION ALL
  SELECT 1
    FROM pg_operator o
    JOIN pg_namespace n ON n.oid = o.oprnamespace
   WHERE n.nspname !~ '^pg_'
     AND n.nspname <> 'information_schema'
  UNION ALL
  SELECT 1
    FROM pg_opclass o
    JOIN pg_namespace n ON n.oid = o.opcnamespace
   WHERE n.nspname !~ '^pg_'
     AND n.nspname <> 'information_schema'
  UNION ALL
  SELECT 1
    FROM pg_opfamily o
    JOIN pg_namespace n ON n.oid = o.opfnamespace
   WHERE n.nspname !~ '^pg_'
     AND n.nspname <> 'information_schema'
  UNION ALL
  SELECT 1
    FROM pg_ts_config c
    JOIN pg_namespace n ON n.oid = c.cfgnamespace
   WHERE n.nspname !~ '^pg_'
     AND n.nspname <> 'information_schema'
  UNION ALL
  SELECT 1
    FROM pg_ts_dict d
    JOIN pg_namespace n ON n.oid = d.dictnamespace
   WHERE n.nspname !~ '^pg_'
     AND n.nspname <> 'information_schema'
  UNION ALL
  SELECT 1
    FROM pg_ts_parser p
    JOIN pg_namespace n ON n.oid = p.prsnamespace
   WHERE n.nspname !~ '^pg_'
     AND n.nspname <> 'information_schema'
  UNION ALL
  SELECT 1
    FROM pg_ts_template t
    JOIN pg_namespace n ON n.oid = t.tmplnamespace
   WHERE n.nspname !~ '^pg_'
     AND n.nspname <> 'information_schema'
  UNION ALL SELECT 1 FROM pg_foreign_data_wrapper
  UNION ALL SELECT 1 FROM pg_foreign_server
  UNION ALL SELECT 1 FROM pg_publication
) AS user_objects
")"
if [[ "$restore_object_count" != "0" ]]; then
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
