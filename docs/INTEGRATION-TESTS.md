# PostgreSQL Integration Tests

## Purpose

These tests exercise the actual PostgreSQL schema and the same indexer persistence functions used by the worker. Unit tests without `TEST_DATABASE_URL` skip these cases; CI starts an ephemeral PostgreSQL 16 service and runs them explicitly.

## Local run

1. Start the repository's PostgreSQL service:

   ```bash
   docker compose up -d db
   ```

2. Set a local test database URL (the Compose defaults are for local development only):

   ```bash
   export TEST_DATABASE_URL=postgresql://micow:micow@localhost:5432/micow
   ```

3. Run the integration suites:

   ```bash
   pnpm --filter @micow/indexer test:integration
   pnpm --filter @micow/api test:integration
   ```

The tests apply the idempotent initial migration, truncate the test tables before each case, and close their connections afterward. Do not point `TEST_DATABASE_URL` at a production or shared database.

## Covered invariants

- Duplicate log replay creates one `indexed_events` row.
- Reorg rollback removes derived trades, tokens, events, and block checkpoints above the common ancestor in one transaction.
- Replaying an orphaned transaction after rollback can insert the canonical log again.
- API readiness, token listing, and trade history work against the real migrated schema.
