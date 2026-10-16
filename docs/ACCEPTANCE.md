# Acceptance Criteria and Phase Gates

Status as of 2026-10-16: P4 — Indexer and API reliability. Foundation, RPC/API hardening, atomic persistence, and worker restart recovery are merged. CI and security workflows passed on main commit `efa07a522e788c949cd0e67fb274d68db5eab085`. PR #6 adds a read-only reconciliation CLI; its CI/security workflows passed on head `4e929a5558874053cc7371ba973f8baeeb276cf0` at last check, but it is not yet merged. Live reconciliation and deployment remain blocked until a factory is deployed using approved testnet-only credentials and test ETH.

## F0 — Foundation and specification

- [x] Monorepo layout and toolchain versions documented.
- [x] Product scope, threat model, data flows, and acceptance criteria documented.
- [x] Environment template contains placeholders only.
- [x] CI uses least-privilege permissions; PR checks do not require deployment secrets.
- [x] Dependency lockfile committed; CI uses frozen installs.

## C1 — Smart contracts

- [x] Fixed-supply ERC-20 has no post-deploy mint, pause, blacklist, or upgrade path.
- [x] Factory creates a token and dedicated market atomically and emits creation events.
- [x] Buy/sell quote and execution match within tested rounding rules.
- [x] Minimum output and deadline checks are enforced.
- [x] Fee rates/recipients are immutable; combined fees are bounded to 500 bps.
- [x] Reentrancy protection covers state-changing ETH/token flows.
- [x] No privileged reserve drain or arbitrary user balance mutation exists.
- [x] Compiler build and bytecode-size report pass.
- [ ] Add explicit forced-ETH accounting regression test and independent contract/economic review.

## T1 — Contract tests

- [x] Unit tests cover core success and revert paths.
- [x] Fuzz tests cover buy/sell amount ranges and reserve accounting.
- [x] Invariant tests cover fixed supply, token inventory, ETH reserves, and fee liabilities.
- [x] Tests include rejecting and reentrant fee-recipient contracts.
- [x] CI runs formatting, build, unit/fuzz/invariant tests.

## W1 — Web

- [x] Strict TypeScript and lint pass.
- [x] Wallet connection and wrong-chain guard are implemented.
- [x] Token views show loading, empty, API error, and token states.
- [x] Buy/sell previews show fees, minimum received, price impact, and slippage.
- [x] Approval, pending, confirmed, and error transaction states are implemented.
- [x] No private-key or seed-phrase handling exists in browser/API.
- [x] Playwright smoke tests cover testnet guardrails and API failure states.
- [ ] Verify optional wallet SDK externalization removes all Next.js build warnings in CI.
- [ ] Broader responsive/accessibility review and wallet-provider E2E tests.

## I1 — Indexer and API

- [x] Duplicate event replay is idempotent in PostgreSQL integration tests.
- [x] Reorg rollback removes orphan projections and permits canonical replay.
- [x] API readiness, token listing, and trade history pass PostgreSQL integration tests.
- [x] Token and trade pagination use deterministic tie-breakers.
- [x] Query validation, bounded pagination, parameterized SQL, rate-limit behavior, and bounded RPC retry are tested.
- [x] PostgreSQL failure-injection test proves event and checkpoint writes roll back atomically when projection validation fails.
- [x] Unit test verifies the worker continues after a transient cycle failure and exits cleanly on shutdown.
- [x] PostgreSQL integration test verifies restart resumes from the first block after the last durable checkpoint.
- [ ] Full process-level worker restart/RPC outage end-to-end test.
- [x] Add a read-only reconciliation CLI for database projection and on-chain factory/market consistency.
- [ ] Run reconciliation against a deployed testnet factory and verify controlled drift detection.

## D1 — Testnet deployment

- [x] Deployment script rejects chain IDs other than 46630.
- [x] Main-branch CI preflight checks the RPC chain ID and simulates deployment without broadcasting; CI passed on the latest main commit.
- [x] Manual deployment workflow requires explicit `broadcast=true` and uses the `robinhood-testnet` environment.
- [ ] Configure environment required reviewers, protected deployer secret, RPC variable, and fee recipient.
- [x] Main-branch RPC/deployment simulation CI job completed successfully.
- [ ] Review and record simulated deployment gas output.
- [ ] Broadcast factory deployment and record address, transaction/block hashes, compiler/settings. **BLOCKED:** no protected deployer key or test ETH is available.
- [ ] Verify source/metadata on explorer where supported.
- [ ] Smoke-test create, buy, sell, fee withdrawal, API, and indexer.
- [x] Mainnet deployment remains out of scope.

## S1 — CI and security

- [x] Contract formatting/build/unit/fuzz/invariant gates pass.
- [x] Web/API/indexer lint, typecheck, unit tests, browser tests, and production build pass on the merged baseline.
- [x] PostgreSQL idempotency/reorg/API integration job passes on the merged baseline.
- [x] Dependency audit, CodeQL, Gitleaks, and pinned Actions pass on the merged baseline.
- [x] Verify all gates on the reliability-hardening branch and atomicity phase.
- [ ] Independent contract/economic review and remediation of any findings.

