# MICOW Operations and Recovery

## Service health
- API liveness: GET /health
- API readiness: GET /ready; returns the latest indexed block when PostgreSQL is available.
- Indexer logs include scanned block ranges, RPC failures, and reorg rollback points.
- Alert on repeated indexer-cycle failures, stale indexed-through block, database connection errors, and RPC error-rate spikes.

## PostgreSQL backup and restore
For local/testnet deployments, run from a protected operator shell.

    docker compose -f infra/compose.yaml exec -T postgres pg_dump -U micow -d micow -Fc > micow-testnet.dump
    pg_restore --list micow-testnet.dump

Restore into a newly created database first; never overwrite the only copy of a live database. Verify token/trade row counts, maximum indexed block, and reconciliation after restore. Store backups outside the repository and restrict access because database content may contain operational metadata.

## RPC outage
1. Do not reset indexer checkpoints.
2. Confirm endpoint chain ID is still 46630.
3. Check provider health/rate limits and switch to a reviewed testnet RPC endpoint if needed.
4. Let the indexer retry; failed transactions do not commit their block checkpoint.
5. After recovery, compare indexed-through block to chain head minus confirmations and run reconciliation.

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
