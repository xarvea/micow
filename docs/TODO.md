# MICOW Master TODO

Status values: PENDING, IN_PROGRESS, BLOCKED, COMPLETED, NOT_VERIFIED. A checked implementation task is not a claim that its acceptance tests passed.

## P0 — Foundation
- [x] Write product scope and exclusions.
- [x] Define architecture and trust boundaries.
- [x] Define threat model and acceptance criteria.
- [x] Establish provenance policy and clean-room rule.
- [x] Pin Node, pnpm, Solidity compiler, and Foundry configuration.
- [x] Generate and commit pnpm lockfile from a real pnpm install.
- [x] Pin GitHub Actions to reviewed full commit SHAs.
- [ ] Review every changed file and PR metadata.

## P1 — Contracts
- [x] Implement fixed-supply ERC-20 with no post-deploy mint.
- [x] Implement factory and token-to-market registry.
- [x] Implement curve quote/buy/sell with min-output and deadline.
- [x] Implement immutable bounded fees and pull-based fee withdrawal.
- [x] Add reentrancy protection and event emissions.
- [x] Confirm compiler build and bytecode sizes in CI.
- [x] Add rejecting and reentrant fee-recipient tests.
- [x] Add quote/execution equivalence and rounding-boundary tests.
- [ ] Review curve economics, inventory limits, and MEV exposure.

## P2 — Contract testing
- [x] Add factory and market unit tests.
- [x] Add buy/sell fuzz tests.
- [x] Add supply, inventory, ETH reserve, and fee-liability invariants.
- [x] Run standard Foundry suite successfully.
- [x] Run high-intensity CI fuzz/invariant profile successfully.
- [ ] Add gas snapshots and inspect deployment bytecode size.

## P3 — Web
- [x] Build Next.js App Router application.
- [x] Implement wallet connect/disconnect and wrong-chain guard.
- [x] Implement token creation with client-side validation.
- [x] Implement indexed token discovery.
- [x] Implement buy/sell quotes, fixed 1% min-output protection, and transaction deadlines.
- [x] Implement wallet write, approval, receipt, and error states.
- [x] Add Playwright browser smoke tests for launchpad guardrails and indexer failure states.
- [x] Confirm Playwright browser smoke tests pass in CI.
- [ ] Run broader responsive/accessibility checks.
- [x] Add price-impact estimate and explicit min-received display.

## P4 — Indexer and API
- [x] Add PostgreSQL schema and migrations.
- [x] Implement block-by-block checkpoints with hash/parent hash.
- [x] Implement event identity uniqueness and idempotent inserts.
- [x] Persist events, projections, and checkpoints in a transaction.
- [x] Add PostgreSQL failure-injection coverage proving event and checkpoint writes roll back together when a projection violates a database invariant.
- [x] Implement common-ancestor reorg rollback and replay.
- [x] Implement Fastify read-only API with validation and rate limits.
- [x] Add deterministic trade ordering by block, log index, and transaction hash.
- [x] Add readiness, token-listing, and trade-history PostgreSQL integration tests.
- [x] Test pagination bounds and parameterized SQL in unit tests.
- [x] Add a rate-limit behavior test using a low configured API limit.
- [x] Add PostgreSQL tests for duplicate event replay, reorg rollback, and canonical replay.
- [x] Add bounded RPC retry with exponential backoff and unit tests; RPC errors cannot be mistaken for a missing reorg ancestor.
- [ ] Add worker restart/RPC outage end-to-end tests.
- [ ] Add RPC-to-contract-state reconciliation.

## P5 — Local integration
- [x] Add Docker Compose for PostgreSQL.
- [x] Add environment template and validation for required indexer settings.
- [x] Add migration-backed API/indexer PostgreSQL integration tests.
- [ ] Add a full service-level end-to-end smoke test.
- [x] Verify clean-checkout install, build, and automated tests in CI.
- [ ] Verify local service startup/stop and migration recovery on Ubuntu.

## P6 — Testnet
- [x] Add deployment script that asserts chain ID 46630.
- [x] Add manual deployment workflow with broadcast disabled by default and protected environment.
- [x] Add main-branch testnet RPC and non-broadcast deployment preflight job (execution pending after merge).
- [ ] Run the main-branch testnet RPC/deployment simulation and inspect gas output.
- [ ] Deploy factory only after contract gates pass. **BLOCKED:** no deployer key or test ETH is available in the execution environment.
- [ ] Record chain ID, addresses, tx hashes, block numbers, compiler/settings.
- [ ] Verify contracts on explorer where supported.
- [ ] Smoke-test create, buy, sell, fee withdrawal, API, and indexer.
- [ ] Record limitations; no mainnet deployment.

## P7 — CI/security
- [x] Add contract and JS/TS lint, typecheck, test, and build gates.
- [x] Add dependency audit, secret scanning, CodeQL, and pinned Actions.
- [x] Pin Foundry toolchain action to a reviewed full commit SHA.
- [x] Externalize unused optional wallet SDK modules to remove non-fatal Next.js build warnings (CI verification pending).
- [x] Commit lockfile and switch CI to frozen lockfile installs.
- [x] Rerun all CI gates after the latest changes and resolve failures.
- [ ] Require all checks before merge where repository settings allow.

## P8 — Testnet launch readiness
- [x] Publish build, deployment, and operations runbooks.
- [ ] Run backup/restore drill.
- [x] Exercise database reorg rollback/replay in PostgreSQL CI.
- [x] Test bounded RPC retry and backoff with unit tests.
- [ ] Run RPC outage recovery drill against an unavailable/recovering provider.
- [ ] Review threat model and unresolved findings.
- [ ] Complete launch readiness checklist.

## P9 — Mainnet (explicitly out of scope)
- [ ] Independent audit and remediation.
- [ ] Economic/MEV analysis and verified DEX graduation integration.
- [ ] Operational/legal/product review and explicit owner approval.
- [ ] Separate mainnet release decision.
