# MICOW Operations and Recovery

## Service health
- API liveness: GET /health
- API readiness: GET /ready; returns the latest indexed block when PostgreSQL is available.
- Indexer logs include scanned block ranges, RPC failures, and reorg rollback points.
- Alert on repeated indexer-cycle failures, stale indexed-through block, database connection errors, and RPC error-rate spikes.

## PostgreSQL backup and restore
For local/testnet deployments, run from a protected operator shell. Create a custom-format backup and inspect its archive manifest:

    docker compose -f infra/compose.yaml exec -T postgres pg_dump -U micow -d micow -Fc > micow-testnet.dump
    pg_restore --list micow-testnet.dump

For a controlled recovery drill, provision a **separate, empty target database** first and set `SOURCE_DATABASE_URL` and `RESTORE_DATABASE_URL` to distinct database names. Then run:

    bash infra/backup-restore-drill.sh

The script refuses a missing MICOW schema, identical source/target database names, or a non-empty restore target. It takes a temporary custom-format dump, restores only into the separate empty target, and compares row counts for indexed blocks/events, tokens, trades, plus the maximum indexed block. The temporary dump is removed on exit; this script is a verification drill, not a durable backup system. The CI drill uses deterministic fixture data and verifies that a second restore attempt fails closed on a non-empty target.

Never overwrite the only copy of a live database. Store durable backups outside the repository, restrict access because database content may contain operational metadata, and verify reconciliation after restoring a real indexed database. Live on-chain reconciliation still requires a deployed factory and approved testnet prerequisites.

## RPC outage
1. Do not reset indexer checkpoints.
2. Confirm endpoint chain ID is still 46630.
3. Check provider health/rate limits and switch to a reviewed testnet RPC endpoint if needed.
4. Let the indexer retry; failed transactions do not commit their block checkpoint.
5. After recovery, compare indexed-through block to chain head minus confirmations and run the read-only reconciliation command below.

## Reorg or inconsistent index
1. Preserve logs and current database backup.
2. Confirm the canonical block hash from a second trusted RPC endpoint if available.
3. Let automatic common-ancestor rollback and replay run.
4. Verify block checkpoint hashes, token-created events, and trades after replay.
5. If recovery cannot find an ancestor, the indexer rolls back to one block before its configured start block and replays; verify the configured deployment start block before restarting.

## Secret exposure
1. Stop deployment activity and revoke/rotate the exposed key immediately.
2. Inspect CI logs, artifacts, Git history, and repository settings.
3. Remove the secret from active files and history only after preserving incident evidence.
4. Re-run secret scanning and review access logs.
5. Do not treat deleting a file or force-pushing as key rotation.

## Contract incident
- Do not deploy a replacement or move assets automatically.
- Preserve transaction hashes, block hashes, deployed bytecode, compiler settings, and source verification data.
- Disable new testnet promotion only through the release process; the MVP contracts have no pause/admin kill switch by design.
- Report impact, affected addresses, and reproducible evidence. Mainnet deployment is not authorized.

## Rollback boundaries
Application/API/indexer deployments can be rolled back to a known image/commit after database compatibility is checked. On-chain contract deployments are immutable; a bad testnet deployment requires a new address and an updated deployment manifest. Never claim an on-chain deployment was rolled back unless chain state proves it.


## On-chain/read-model reconciliation

Run this after an indexer recovery, database restore, or before a testnet release:

```bash
pnpm --filter @micow/indexer reconcile
```

The command requires `RH_TESTNET_RPC_URL`, `DATABASE_URL`, and `LAUNCHPAD_FACTORY_ADDRESS` to identify the intended testnet RPC, database, and deployed factory. It verifies chain ID 46630 and compares indexed token/event projections against the factory registry and market token getter. It is read-only and exits non-zero on detected drift or RPC verification failure. Do not treat a skipped or failed run as clean. Live reconciliation is not yet complete until a deployed factory is available and a report is recorded.
