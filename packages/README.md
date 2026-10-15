# Shared packages

- `config/`: shared TypeScript, lint, and test configuration.
- `domain/`: validated domain types and pure business rules.
- `web3/`: chain metadata, contract ABIs, and typed viem clients.
- `database/`: schema, migrations, and persistence adapters.

Keep shared packages small and dependency direction explicit. Contracts remain the source of truth for on-chain state.
