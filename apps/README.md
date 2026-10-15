# Applications

- `web/`: Next.js App Router + strict TypeScript + wagmi/viem. Includes wallet connection, testnet chain guard, token creation, buy/sell quotes, minimum received, price impact, approval, and transaction receipt states.
- `api/`: Fastify read-only API for token and trade projections, health/readiness, validation, bounded pagination, and rate limiting.
- `indexer/`: TypeScript event indexer with PostgreSQL persistence, idempotency, block-hash checkpoints, reorg recovery, and reconciliation hooks.

The API and indexer do not custody or sign user transactions. On-chain contracts remain the source of truth. PostgreSQL-backed integration tests run in the dedicated CI job; actual testnet deployment remains blocked until a protected testnet key and test ETH are available.
