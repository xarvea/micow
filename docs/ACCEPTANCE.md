# Acceptance Criteria and Phase Gates

A phase is complete only when its acceptance criteria pass and evidence is recorded. Latest automated CI on the integration branch passed contract, web, API/indexer, PostgreSQL integration, dependency audit, CodeQL, and secret-scanning gates. Actual testnet deployment is blocked pending a protected testnet key and test ETH; independent contract review, RPC outage/restart drills, and reconciliation remain pending.

## F0 — Foundation and specification

- [x] Monorepo layout and toolchain versions documented.
- [x] Product scope, threat model, data flows, and acceptance criteria documented.
- [x] Environment template contains placeholders only.
- [x] CI has least-privilege permissions and pull-request checks do not require deployment secrets.
- [x] Dependency lockfile generated and committed; CI uses frozen installs.

## C1 — Smart contracts

- [x] Fixed-supply ERC-20 has no post-deploy mint, pause, blacklist, or upgrade path.
- [x] Factory creates a token and dedicated market atomically and emits creation events.
- [x] Buy/sell quote and execution match within tested rounding rules.
- [x] User-supplied minimum output and deadline are enforced.
- [x] Fee rates/recipients are immutable; combined fee is bounded to 500 bps.
- [x] Reentrancy protection covers state-changing ETH/token flows.
- [x] No privileged reserve drain or arbitrary user balance mutation exists.
- [x] Compiler build and bytecode-size report pass.
- [ ] Add explicit forced-ETH accounting regression test and independent contract review.

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
- [x] Transaction approval, pending, confirmed, and error states are implemented.
- [x] No private-key or seed-phrase handling exists in browser/API.
- [x] Playwright smoke tests cover testnet guardrails and API failure state.
- [ ] Broader responsive/accessibility review and wallet-provider E2E tests.

## I1 — Indexer and API

- [x] Duplicate event replay is idempotent in PostgreSQL integration tests.
- [x] Reorg rollback removes orphan projections and permits canonical replay.
- [x] API readiness, token listing, and trade history pass PostgreSQL integration tests.
- [x] Query validation, pagination bounds, and parameterized SQL are tested.
- [ ] Failure-injection test proves event/projection/checkpoint writes roll back atomically.
- [ ] Rate-limit integration test, worker restart test, and RPC outage recovery test.
- [ ] RPC-to-contract-state reconciliation detects deliberate divergence.

## D1 — Testnet deployment

- [x] Deployment script rejects chain IDs other than 46630.
- [x] Testnet RPC and explorer configuration are documented.
- [ ] Dry-run deployment and gas review.
- [ ] Deploy factory and record address, transaction/block hashes, compiler/settings. **BLOCKED:** no protected deployer key or test ETH is available in the execution environment.
- [ ] Verify source/metadata on explorer where supported.
- [ ] Smoke-test create, buy, sell, fee withdrawal, API, and indexer.
- [x] Mainnet deployment remains out of scope.

## S1 — CI and security

- [x] Contract formatting/build/unit/fuzz/invariant gates pass.
- [x] Web/API/indexer lint, typecheck, unit tests, browser tests, and production build pass.
- [x] PostgreSQL idempotency/reorg/API integration job passes.
- [x] Dependency audit, CodeQL, and Gitleaks pass.
- [ ] Independent contract/economic review and remediation of any findings.

