# Applications

- `web/`: Next.js App Router + strict TypeScript + wagmi/viem.
- `api/`: Fastify read-only API.
- `indexer/`: TypeScript event indexer with PostgreSQL persistence, idempotency, reorg recovery, and reconciliation.

Each application will have an independent package manifest and test commands in its implementation phase. API and indexer must never custody or sign user transactions.
