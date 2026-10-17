# Acceptance Criteria and Phase Gates

Status as of 2026-10-17: P8 testnet launch-readiness hardening, testnet-only. PR #29 merged as `7074f7b5dc8b0bcf912d7b8fca4f253227734dfa`; post-merge main CI `39004061960` and security `39004061854` passed on that exact SHA. PR #29 CI `38941007407` and security `38941007357` passed on its head. No deployment transaction or public-chain broadcast was performed. Live reconciliation/deployment remain blocked pending approved testnet-only credentials, test ETH, reviewed treasury recipient, and protected-environment reviewer verification.

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
- [x] **Current code baseline:** market trading fee rates/recipients are immutable at 100 bps protocol + 100 bps creator; combined fees are bounded to 500 bps. PR #11 adds an exact 0.0006 ETH factory creation fee with treasury-only pull accounting and guarded withdrawal.
- [ ] **Requested future configuration:** fee controller is not implemented; ADR-0006 implementation and security gates must pass before acceptance.
- [x] Reentrancy protection covers state-changing ETH/token flows.
- [x] No privileged reserve drain or arbitrary user balance mutation exists.
- [x] Compiler build and bytecode-size report pass.
- [x] Add forced-ETH accounting regression test (PR #14 merged and documented); forced ETH remains surplus, not a recoverable liability.
- [x] Complete preliminary source-based economic/MEV review and record findings in `docs/ECONOMIC-MEV-REVIEW.md` (PR #22); this is not an independent audit.
- [ ] Obtain explicit owner acceptance of residual public-mempool sandwich risk or implement an approved mitigation before closing issue #16.

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
- [x] PR #29 process-level RPC outage/recovery test verifies checkpoint freeze during provider failure, exactly-once persistence after recovery, and restart resume at the next block without duplicates. PR CI `38941007407` and security `38941007357`; post-merge main CI `39004061960` and security `39004061854` passed on `7074f7b5dc8b0bcf912d7b8fca4f253227734dfa`.
- [x] PR #7 process-level worker restart/RPC outage acceptance passed on the PR head: isolated PostgreSQL + simulated RPC outage, checkpoint persistence, graceful SIGTERM, restart resume. Later main CI/security runs passed, including CI `38916331756` and security `38916331618` on exact main SHA `f3a398781b30bf35d633e4de4d2bdf39672cd166`.
- [x] Add a read-only reconciliation CLI for database projection and on-chain factory/market consistency.
- [ ] Run reconciliation against a deployed testnet factory and verify controlled drift detection.

## P5 — Local full-service E2E

- [x] E2E fails closed unless RPC/API/web endpoints are HTTP loopback on expected ports and PostgreSQL is local on port 5432 (PR #26).
- [x] Negative CI cases reject public testnet RPC, remote database host, and remote API/web URLs before any deployment command.
- [x] API `/health` remains available while PostgreSQL is unavailable and `/ready` returns HTTP 503; readiness returns HTTP 200 with a healthy database.
- [x] Reapply migrations, create/buy/sell locally, verify API/indexer projections, restart/resume checkpoint without duplicate trades, and cleanly stop services.
- [ ] Real external-provider outage drill remains NOT_VERIFIED; the process-level outage is simulated in CI only.
- [ ] Manual run on a user-managed Ubuntu host remains NOT_VERIFIED; CI E2E is the current evidence.

## P8 — Backup and restore recovery drill

- [x] CI seeds deterministic PostgreSQL fixture rows, creates a separate empty restore database, and verifies custom-format backup/restore preserves indexed block/event/token/trade counts and maximum indexed block (PR #28; CI `38936723431` passed on the PR head).
- [x] CI verifies the restore script rejects a non-empty target without overwriting its contents (PR #28; CI `38936723431` passed on the PR head).
- [ ] For a real operational restore, verify token/trade counts and maximum indexed block, then run read-only reconciliation against a deployed factory; this remains blocked until a testnet factory exists.
- [ ] Durable backup retention, access control, and an operator-run restore against a protected testnet-like environment remain separate operational acceptance items.

## Fee-configuration acceptance (proposed; not implemented)

- [x] Audit current factory/market source: current markets use immutable 100 bps protocol + 100 bps creator fees; PR #11 implements exact 0.0006 ETH creation fee and treasury pull accounting. Graduation/controller/DEX fee collection remain absent. Existing markets cannot be retrofitted by adding a controller.
- [x] Finalize fee policy in ADR-0006: creation 0.0006 ETH; graduation 0.0006 ETH only when graduation exists; curve buy/sell 130 bps total (100 bps treasury + 30 bps creator); global-live config; 500 bps max trading fee; 0.01 ETH max fixed fee; 24-hour delayed updates; explicit rounding.
- [ ] Implement controller and controller-enabled factory/markets; policy is not yet active.
- [ ] Verify creator claims and treasury withdrawals cannot spend reserves or other liabilities.
- [ ] Uniswap v4 remains out of scope until target-chain contracts, hook permissions, custody, accounting, and end-to-end fee collection/withdrawal are verified.
- [ ] Frontend reads effective on-chain values; runtime environment variables are not presented as authority.
- [ ] Independent review and testnet evidence recorded. No deployment until deployment approval gates pass.

## D1 — Testnet deployment

- [x] Deployment script rejects chain IDs other than 46630.
- [x] CI workflow contains a testnet-only RPC chain-ID preflight and non-broadcast deployment simulation. Main run `38916331756` passed on commit `f3a398781b30bf35d633e4de4d2bdf39672cd166`; the CI workflow includes testnet chain-ID preflight and non-broadcast deployment simulation. No deployment was performed.
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
- [ ] Independent contract/economic review and remediation of any findings; preliminary source review is not an independent audit.
- [ ] Explicit owner decision on residual sandwich/MEV risk.

