# Applications

- web/: Next.js App Router, strict TypeScript, wagmi/viem wallet integration. Current UI is a testnet landing page and wallet/chain guard; transaction flows remain pending.
- api/: Fastify read-only API with validation, rate limiting, and PostgreSQL read model.
- indexer/: TypeScript log ingestion with block-hash checkpoints, idempotent event inserts, reorg rollback, and replay.

Applications never custody or sign user transactions. API is read-only. Indexer credentials are limited to its database and RPC provider.
