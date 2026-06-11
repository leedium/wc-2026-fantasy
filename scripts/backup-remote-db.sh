#!/usr/bin/env bash
# Dump a full snapshot of a remote Supabase Postgres database to the local
# filesystem. READ-ONLY: this only runs SELECT/COPY against the remote (no
# resets, no writes) and writes the dump files under supabase/backups/.
#
# Produces the Supabase-recommended 3-file restorable snapshot in a
# timestamped folder:
#   roles.sql   — database roles            (--role-only)
#   schema.sql  — schema / DDL              (default dump)
#   data.sql    — table data via COPY       (--data-only --use-copy)
#
# The connection string is NEVER read from git — pass it via the
# SUPABASE_DB_URL env var or as the first argument. Get it from the Supabase
# Dashboard → Project Settings → Database → Connection string. Use the
# direct/session connection (port 5432), NOT the transaction pooler (6543),
# so the dump can hold a consistent read.
#
# Examples:
#   SUPABASE_DB_URL='postgresql://postgres:...@db.<ref>.supabase.co:5432/postgres' \
#     scripts/backup-remote-db.sh
#
#   scripts/backup-remote-db.sh 'postgresql://postgres:...@db.<ref>.supabase.co:5432/postgres'
#
# Exit codes:
#   0  snapshot written successfully
#   2  misconfiguration (missing connection string or supabase CLI)

set -euo pipefail

# Repo root = parent of this script's directory, regardless of cwd.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

DB_URL="${SUPABASE_DB_URL:-${1:-}}"

usage() {
  cat <<EOF
Usage: SUPABASE_DB_URL='postgresql://...' $0
   or: $0 'postgresql://...'

Get the connection string from the Supabase Dashboard:
  Project Settings → Database → Connection string (Session, port 5432).

This is a READ-ONLY dump. It never modifies the remote database.
EOF
}

if [[ -z "$DB_URL" ]]; then
  echo "error: no connection string provided." >&2
  echo >&2
  usage >&2
  exit 2
fi

if ! command -v supabase >/dev/null 2>&1; then
  echo "error: the 'supabase' CLI is not on your PATH." >&2
  echo "       Install it: https://supabase.com/docs/guides/cli" >&2
  exit 2
fi

# UTC timestamp keeps folders sortable and tz-independent.
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT_DIR="$REPO_ROOT/supabase/backups/$TIMESTAMP"
mkdir -p "$OUT_DIR"

echo "Backing up remote Supabase DB (read-only) → $OUT_DIR"

echo "  [1/3] roles  → roles.sql"
supabase db dump --db-url "$DB_URL" -f "$OUT_DIR/roles.sql" --role-only

echo "  [2/3] schema → schema.sql"
supabase db dump --db-url "$DB_URL" -f "$OUT_DIR/schema.sql"

echo "  [3/3] data   → data.sql"
supabase db dump --db-url "$DB_URL" -f "$OUT_DIR/data.sql" --data-only --use-copy

echo
echo "Done. Snapshot written to:"
echo "  $OUT_DIR"
echo
echo "Restore into a fresh/empty Postgres (NOT your live DB), in order:"
echo "  psql \"\$TARGET_DB_URL\" -f \"$OUT_DIR/roles.sql\""
echo "  psql \"\$TARGET_DB_URL\" -f \"$OUT_DIR/schema.sql\""
echo "  psql \"\$TARGET_DB_URL\" -f \"$OUT_DIR/data.sql\""
