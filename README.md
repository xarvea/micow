# MICOW Launchpad

MICOW is an independently implemented, testnet-only EVM token launchpad targeting Robinhood Chain Testnet. It is not affiliated with Pump.fun or Robinhood.

## Current delivery status

- [x] Clean-room Git history established.
- [x] Product scope, architecture, threat model, roadmap, build/deployment runbooks, operations, and acceptance gates documented.
- [x] Fixed-supply ERC-20, factory, and bonding-curve implementation with fee liabilities and safety checks added.
- [x] Next.js launchpad UI with injected wallet connection, chain guard, token creation, buy/sell quotes, and slippage-protected transactions added.
- [x] Read-only Fastify API and PostgreSQL-backed reorg-aware indexer implementation added.
- [x] CI contract build, unit/fuzz tests, and invariant profile pass.
- [ ] Independent contract security/economic review completed.
- [ ] Verify the Next.js build has no optional wallet SDK resolution warnings after connector externals hardening.
- [x] pnpm lockfile generated and committed; CI uses frozen installs.
- [x] PostgreSQL integration tests pass in CI: duplicate event replay, reorg rollback/replay, and API readiness/token/trade queries.
- [x] Playwright browser smoke tests pass in CI.
- [ ] Testnet deployment and explorer verification completed. **BLOCKED** pending protected deployer key, test ETH, and deployment-environment protection review.
- [x] PostgreSQL atomicity, worker-recovery, and read-only on-chain reconciliation PRs merged; PR #6 merge commit is `dea1590d4579d2a4ca762c6536e815375ce8fc70`.
- [ ] Verify post-merge main CI/security workflows for `dea1590d4579d2a4ca762c6536e815375ce8fc70`.
- [ ] Complete process-level indexer outage/restart acceptance (PR #7 in progress).
- [ ] Run reconciliation against an actual deployed testnet factory. **BLOCKED** until deployment prerequisites are satisfied.

Never treat this repository as audited or production-ready. Mainnet deployment is out of scope until independent security review and explicit approval.

## Current phase

**P4 — Indexer and API reliability.** Durable checkpoint resume, worker-cycle retry/shutdown, atomic event/projection/checkpoint persistence, and reorg rollback/replay tests are merged. A read-only on-chain reconciliation CLI is merged; live reconciliation remains pending a deployed factory. A process-level RPC outage/restart test is in PR #7; P5 local service E2E, P6 testnet deployment, and P8 recovery drills are not complete.

## Stack

- Solidity + Foundry
- Next.js App Router + strict TypeScript
- wagmi + viem
- Fastify read-only API
- TypeScript event indexer + PostgreSQL
- pnpm workspace + Turborepo + Biome

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
