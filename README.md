# MICOW Launchpad

MICOW is an independently implemented, testnet-only EVM token launchpad targeting Robinhood Chain Testnet. It is not affiliated with Pump.fun or Robinhood.

## Current delivery status

Documentation snapshot: 2026-10-17. PR #29 merged to `main` as `7074f7b5dc8b0bcf912d7b8fca4f253227734dfa`. Post-merge main CI `39004061960` and security `39004061854` passed on that exact SHA. PR #29 CI `38941007407` and security `38941007357` passed on its head. No deployment transaction or public-chain broadcast was performed.

- [x] Clean-room Git history established.
- [x] Product scope, architecture, threat model, roadmap, build/deployment runbooks, operations, and acceptance gates documented.
- [x] Fixed-supply ERC-20 and bonding-curve implementation; PR #11 adds exact 0.0006 ETH creation fee with treasury-only pull accounting and guarded withdrawal. Trading remains 100 bps protocol + 100 bps creator; configurable controller, 130 bps trading policy, graduation fee, and DEX fee collection remain unimplemented.
- [x] Next.js launchpad UI with injected wallet connection, chain guard, token creation, buy/sell quotes, and slippage-protected transactions added.
- [x] Read-only Fastify API and PostgreSQL-backed reorg-aware indexer implementation added.
- [x] CI contract build, unit/fuzz tests, and invariant profile pass.
- [ ] Independent contract security/economic review completed. The preliminary source-based economic/MEV review and regression coverage are merged; this is not an independent audit, and public-mempool sandwich risk still requires explicit owner acceptance or mitigation.
- [x] Verify the Next.js production build in CI; optional wallet SDK externals were hardened.
- [x] pnpm lockfile generated and committed; CI uses frozen installs.
- [x] PostgreSQL integration tests pass in CI: duplicate event replay, reorg rollback/replay, and API readiness/token/trade queries.
- [x] Playwright browser smoke tests pass in CI.
- [ ] Testnet deployment and explorer verification completed. **BLOCKED** pending protected deployer key, test ETH, and deployment-environment protection review.
- [x] PostgreSQL atomicity and worker-cycle recovery are merged; PR #6 read-only reconciliation CLI is merged (merge commit `dea1590d4579d2a4ca762c6536e815375ce8fc70`).
- [x] PR #7 process-level recovery acceptance: CI run `38837255615` passed PostgreSQL process recovery, Foundry, web/API/indexer checks, and secret scan; security run `38837255569` passed. PR #7 merged as `383dd1f7e2718b2b5977ec83a8fe809f1300045c`.
- [x] Verify current main CI/security: CI `38916331756` and security `38916331618` passed on exact SHA `f3a398781b30bf35d633e4de4d2bdf39672cd166`.
- [x] PR #14 merged: forced-ETH accounting regression test passed CI/security on its PR head; this is test-only coverage, not a surplus-recovery mechanism.
- [ ] Run reconciliation against an actual deployed testnet factory. **BLOCKED** until deployment prerequisites are satisfied.
- [x] PR #18 economic regression coverage, PR #19 gas instrumentation, PR #22 preliminary economic/MEV review, PR #23 local service E2E restart/resume coverage, PR #25 receipt-based gas baseline, and PR #26 endpoint safety/API database-outage recovery merged. CI/security passed on their PR heads.

Never treat this repository as audited or production-ready. Mainnet deployment is out of scope until independent security review and explicit approval.

## Current phase

**P8 — Testnet launch-readiness hardening.** Full local service E2E covers API health/readiness during PostgreSQL outage, migration reapply, local Anvil create/buy/sell, indexer checkpoint resume/idempotent replay, and clean shutdown. PR #28 adds a guarded PostgreSQL backup/restore CI drill; its PR CI/security and post-merge main CI/security passed. PR #29 adds process-level RPC outage/recovery checkpoint safety; its PR CI/security and post-merge main CI/security passed. This does not prove durable backup retention or protected-environment restore. PR #29 verifies process-level RPC outage checkpoint freeze, recovery, and restart without duplicate checkpoints; post-merge main CI `39004061960` passed. A real external-provider outage drill remains incomplete. P4 live reconciliation remains blocked until a testnet factory is deployed. Independent audit, owner MEV-risk decision, and testnet deployment remain incomplete.

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
11. docs/FEE_CONFIGURATION.md — proposed configurable fee architecture and gates.
12. docs/DECISIONS.md — architecture decisions, including fee configuration status.

## Toolchain

- Node.js 24.22.0 LTS
- pnpm 10.26.1
- Foundry (forge, cast, anvil)
- Docker Engine + Compose

Never commit private keys, RPC credentials, populated environment files, or deployment secrets.
