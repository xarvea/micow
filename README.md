# MICOW Launchpad

MICOW is an independently implemented, testnet-only EVM token launchpad targeting Robinhood Chain Testnet. This repository is a clean-room implementation; it is not affiliated with Pump.fun or Robinhood.

## Current status

- [x] Clean Git history established
- [x] Product scope, architecture, threat model, and acceptance gates documented
- [ ] Smart contracts implemented and reviewed
- [ ] Unit, fuzz, and invariant tests passing
- [ ] Web app, indexer, and API implemented
- [ ] Testnet deployment and explorer verification completed
- [ ] CI/security gates passing

Do not treat this repository as audited or production-ready. Mainnet deployment is out of scope until independent security review and explicit approval.

## Stack

- Solidity + Foundry for EVM contracts
- TypeScript + Next.js App Router for the web app
- wagmi + viem for wallet and EVM integration
- Fastify for the read-only API
- TypeScript event indexer + PostgreSQL
- pnpm workspace + Turborepo for monorepo orchestration

## Network

Robinhood Chain Testnet: chain ID `46630`, native gas asset `ETH`, public RPC `https://rpc.testnet.chain.robinhood.com`, explorer `https://explorer.testnet.chain.robinhood.com`. The public RPC is rate-limited; use a provider endpoint for sustained indexing or deployment.

## Start here

1. Read [Product Specification](docs/PRODUCT-SPEC.md).
2. Read [Architecture](docs/ARCHITECTURE.md).
3. Read [Threat Model](docs/THREAT-MODEL.md).
4. Use [Acceptance Criteria](docs/ACCEPTANCE.md) as the completion gate.
5. Never commit private keys, RPC API keys, or populated environment files.

## Local prerequisites

- Node.js 20.20.x (see `.nvmrc`)
- pnpm 10.26.x
- Foundry (forge, cast, anvil)
- Git

Detailed commands will be added with the implementation phases.
