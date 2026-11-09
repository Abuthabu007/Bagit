#!/bin/sh
set -eu

export PGPASSWORD="$POSTGRES_PASSWORD"
run_psql() {
  psql -h "${PGHOST:-postgres}" -p "${PGPORT:-5432}" -U "$POSTGRES_USER" \
    -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 "$@"
}

has_service_schema=$(run_psql -Atc "SELECT to_regclass('catalog.products') IS NOT NULL")
has_legacy_schema=$(run_psql -Atc "SELECT to_regclass('public.products') IS NOT NULL")

if [ "$has_service_schema" = "t" ]; then
  exit 0
fi

if [ "$has_legacy_schema" != "t" ]; then
  run_psql -f /migrations/schema.sql
  for migration in /migrations/migrations/00*.sql; do
    run_psql -f "$migration"
  done
else
  run_psql -f /migrations/migrations/009_service_boundaries.sql
fi
