# Architecture

## System boundaries

```text
Browser / Next.js
  ├── wagmi + viem ──> Robinhood Chain Testnet contracts
  └── HTTPS ──> Fastify read API ──> PostgreSQL read model
                                 ^
                                 |
                      TypeScript event indexer
                                 |
                          JSON-RPC provider
```

## Monorepo layout

- `contracts/`: Foundry Solidity source, tests, scripts, deployment artifacts (never secrets).
- `apps/web/`: Next.js App Router frontend.
- `apps/api/`: Fastify read-only API.
- `apps/indexer/`: TypeScript log ingestion, reorg handling, and reconciliation.
- `packages/config/`: shared lint, TypeScript, and test configuration.
- `packages/domain/`: shared domain types and pure business rules.
- `packages/web3/`: chain config, ABI/address manifests, and typed viem clients.
- `packages/database/`: schema, migrations, and persistence adapters.
- `infra/`: local development services and operational runbooks.
- `docs/`: decisions, threat model, and acceptance evidence.

## Trust boundaries

1. Contracts are the source of truth for token supply, market reserves, trades, and fees.
2. Browser inputs and API query parameters are untrusted.
3. Indexer output is derived and can lag or be reorganized; expose indexed-through block and freshness.
4. RPC responses are external dependencies; validate chain ID and block hashes.
5. Environment variables may contain credentials; never expose server secrets through `NEXT_PUBLIC_*`.
6. Metadata URIs are untrusted. The web client must not blindly render arbitrary HTML or fetch server-side URLs without SSRF controls.

## Data flow and reliability

The indexer processes logs in canonical order by (block number, transaction index, log index). Each log has a unique key based on chain ID, transaction hash, and log index. A transaction persists event rows and checkpoint updates atomically. Reorg recovery walks back to a common ancestor, deletes/reverts derived records from orphaned blocks, and replays canonical logs. The read-only reconciliation CLI (`pnpm --filter @micow/indexer reconcile`) compares indexed TokenCreated events and token projections with `LaunchpadFactory.marketForToken(token)` and `BondingCurveMarket.token()`. It is operator-triggered, paginates database reads, retries transient RPC reads, and exits non-zero on detected drift or failed verification; it does not mutate database or chain state. A successful live run against a deployed factory is still an acceptance gate.

## Operational model

Local development uses a local PostgreSQL instance and testnet RPC. Testnet deployment keys are injected at runtime from the operator environment and never stored in repository files or CI logs. Public RPC is not suitable for guaranteed uptime or high-volume historical indexing.
