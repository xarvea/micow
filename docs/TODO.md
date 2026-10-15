# MICOW Master TODO

Status values: PENDING, IN_PROGRESS, BLOCKED, COMPLETED, NOT_VERIFIED. A checked implementation task is not a claim that its acceptance tests passed.

## P0 — Foundation
- [x] Write product scope and exclusions.
- [x] Define architecture and trust boundaries.
- [x] Define threat model and acceptance criteria.
- [x] Establish provenance policy and clean-room rule.
- [x] Pin Node, pnpm, Solidity compiler, and Foundry configuration.
- [ ] Generate and commit pnpm lockfile from a real pnpm install.
- [x] Pin GitHub Actions to reviewed full commit SHAs.
- [ ] Review every changed file and PR metadata.

## P1 — Contracts
- [x] Implement fixed-supply ERC-20 with no post-deploy mint.
- [x] Implement factory and token-to-market registry.
- [x] Implement curve quote/buy/sell with min-output and deadline.
- [x] Implement immutable bounded fees and pull-based fee withdrawal.
- [x] Add reentrancy protection and event emissions.
- [ ] Confirm compiler build and bytecode sizes in CI.
- [ ] Add malicious fee-recipient reentrancy tests.
- [ ] Add quote/execution equivalence and rounding-boundary tests.
- [ ] Review curve economics, inventory limits, and MEV exposure.

## P2 — Contract testing
- [x] Add factory and market unit tests.
- [x] Add buy/sell fuzz tests.
- [x] Add supply, inventory, ETH reserve, and fee-liability invariants.
- [ ] Run standard Foundry suite successfully.
- [ ] Run high-intensity CI fuzz/invariant profile successfully.
- [ ] Add gas snapshots and inspect deployment bytecode size.

## P3 — Web
- [x] Build Next.js App Router application.
- [x] Implement wallet connect/disconnect and wrong-chain guard.
- [x] Implement token creation with client-side validation.
- [x] Implement indexed token discovery.
- [x] Implement buy/sell quotes, fixed 1% min-output protection, and transaction deadlines.
- [x] Implement wallet write, approval, receipt, and error states.
- [ ] Add browser tests and responsive/accessibility checks.
- [ ] Add price-impact estimate and explicit min-received display.

## P4 — Indexer and API
- [x] Add PostgreSQL schema and migrations.
- [x] Implement block-by-block checkpoints with hash/parent hash.
- [x] Implement event identity uniqueness and idempotent inserts.
- [x] Make event rows, projections, and checkpoint atomic.
- [x] Implement common-ancestor reorg rollback and replay.
- [x] Implement Fastify read-only API with validation and rate limits.
- [ ] Add pagination, rate-limit, and readiness integration tests.
- [ ] Add integration tests for duplicate replay, reorg, restart, and RPC outage.
- [ ] Add RPC-to-contract-state reconciliation.

## P5 — Local integration
- [x] Add Docker Compose for PostgreSQL.
- [x] Add environment template and validation for required indexer settings.
- [ ] Add migration/seed and end-to-end smoke tests.
- [ ] Verify clean-checkout install, build, tests, and service startup.

## P6 — Testnet
- [x] Add deployment script that asserts chain ID 46630.
- [ ] Dry-run deployment and inspect bytecode size/gas.
- [ ] Deploy factory only after contract gates pass.
- [ ] Record chain ID, addresses, tx hashes, block numbers, compiler/settings.
- [ ] Verify contracts on explorer where supported.
- [ ] Smoke-test create, buy, sell, fee withdrawal, API, and indexer.
- [ ] Record limitations; no mainnet deployment.

## P7 — CI/security
- [x] Add contract and JS/TS lint, typecheck, test, and build gates.
- [x] Add dependency audit, secret scanning, CodeQL, and pinned Actions.
- [ ] Commit lockfile and switch CI to frozen lockfile installs.
- [ ] Rerun all CI gates after the latest changes and resolve failures.
- [ ] Require all checks before merge where repository settings allow.

## P8 — Testnet launch readiness
- [x] Publish build, deployment, and operations runbooks.
- [ ] Run backup/restore drill.
- [ ] Run reorg and RPC outage recovery drill.
- [ ] Review threat model and unresolved findings.
- [ ] Complete launch readiness checklist.

## P9 — Mainnet (explicitly out of scope)
- [ ] Independent audit and remediation.
- [ ] Economic/MEV analysis and verified DEX graduation integration.
- [ ] Operational/legal/product review and explicit owner approval.
- [ ] Separate mainnet release decision.
