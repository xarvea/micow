# MICOW Launchpad

MICOW is an independently implemented, testnet-only EVM token launchpad targeting Robinhood Chain Testnet. It is not affiliated with Pump.fun or Robinhood.

## Current delivery status

- [x] Clean-room Git history established.
- [x] Product scope, architecture, threat model, roadmap, runbook, and acceptance gates documented.
- [x] Initial fixed-supply token, factory, and bonding-curve implementation added.
- [x] Next.js wallet-connected testnet landing page scaffold added.
- [x] Read-only API and reorg-aware indexer implementation started.
- [ ] Contract compilation, fuzz/invariant tests, and security review passed.
- [ ] Browser, API, indexer integration tests and dependency lockfile verified.
- [ ] Testnet deployment and explorer verification completed.
- [ ] All CI/security gates green and PR merged.

Never treat this repository as audited or production-ready. Mainnet deployment is out of scope until independent security review and explicit approval.

## Stack

- Solidity + Foundry
- Next.js App Router + strict TypeScript
- wagmi + viem
- Fastify read-only API
- TypeScript event indexer + PostgreSQL
- pnpm workspace + Turborepo

## Network

Robinhood Chain Testnet: chain ID 46630, native gas asset ETH, public RPC https://rpc.testnet.chain.robinhood.com, explorer https://explorer.testnet.chain.robinhood.com. The public RPC is rate-limited; use a dedicated provider for sustained indexing.

## Project documentation

1. docs/PRODUCT-SPEC.md — scope and requirements.
2. docs/ROADMAP.md — all delivery phases and exit gates.
3. docs/TODO.md — phase/task checklist.
4. docs/ARCHITECTURE.md — component boundaries and data flow.
5. docs/THREAT-MODEL.md — risks and controls.
6. docs/BUILD-RUNBOOK.md — clean-clone build and verification.
7. docs/DEPLOYMENT.md — testnet deployment preflight and evidence.
8. docs/OPERATIONS.md — backup, recovery, incident, and rollback procedures.
9. docs/SECURITY-GATES.md — CI and security requirements.
10. docs/ACCEPTANCE.md — acceptance tests.

## Toolchain

- Node.js 24.22.0 LTS
- pnpm 10.26.1
- Foundry (forge, cast, anvil)
- Docker Engine + Compose

Never commit private keys, RPC credentials, populated environment files, or deployment secrets.
