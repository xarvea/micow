# Acceptance Criteria and Phase Gates

A phase cannot be marked complete without recorded command output or CI evidence. Current status: contract and web automated CI gates have passed on the feature branch. PostgreSQL integration/reconciliation tests, independent contract review, operational recovery drills, and actual testnet deployment remain pending or blocked. Recheck the latest CI run before merging.

## F0 — Foundation and specification

- [ ] Monorepo layout and toolchain versions documented.
- [ ] Scope, threat model, data flows, and acceptance gates reviewed.
- [ ] Environment template contains placeholders only.
- [ ] CI has least-privilege permissions and does not require secrets for pull requests.
- [ ] Dependency lockfile generated and committed before relying on frozen installs.

## C1 — Smart contracts

- [ ] Fixed-supply ERC-20 has no mint-after-deploy, pause, blacklist, or upgrade path.
- [ ] Factory creation is atomic and emits deterministic creation events.
- [ ] Buy/sell quote and execution agree within documented rounding rules.
- [ ] User-supplied min output and deadline are enforced.
- [ ] Fee rates are immutable, recipients valid, combined fee <= 500 bps.
- [ ] Reentrancy and forced-ETH behaviour are documented and tested.
- [ ] No privileged reserve drain or arbitrary user balance mutation.
- [ ] Contract size and gas are measured; no unreviewed compiler warnings.

## T1 — Contract tests

- [ ] Unit tests cover all success and revert paths.
- [ ] Fuzz tests cover zero/boundary/extreme amounts and fee settings.
- [ ] Invariant tests cover total supply, market inventory, solvency, and accounting.
- [ ] Tests include malicious/reentrant receiver and fee recipient contracts.
- [ ] CI runs formatting, build, unit/fuzz/invariant tests.

## W1 — Web

- [ ] Strict TypeScript and lint pass.
- [ ] Wallet connect/disconnect and wrong-chain handling work.
- [ ] Read-only views render loading, empty, stale, and error states.
- [ ] Buy/sell previews show fees, minimum output, and slippage.
- [ ] Transactions show pending, confirmed, and reverted states.
- [ ] No secret/private key handling in browser or API.

## I1 — Indexer and API

- [ ] Duplicate event replay is idempotent.
- [ ] Reorg test rewinds to common ancestor and replays correctly.
- [ ] Event rows and checkpoint update commit atomically.
- [ ] Pagination, rate limits, validation, and health/readiness endpoints work.
- [ ] Reconciliation detects deliberate divergence from chain state.

## D1 — Testnet deployment

- [ ] Chain ID 46630 confirmed at deploy time.
- [ ] RPC URL and explorer are from official docs; no mainnet endpoint in testnet script.
- [ ] Dry-run succeeds and deployment output records addresses, transaction hashes, block numbers, and compiler settings.
- [ ] Contract source/metadata verified on explorer where supported.
- [ ] Post-deploy smoke tests verify fixed supply, ownership/admin surface, fees, and buy/sell.
- [ ] No deployer private key or API key is committed or printed.

## S1 — CI and security

- [ ] Contract formatting/build/tests pass.
- [ ] Web/API/indexer lint, typecheck, and build pass.
- [ ] Dependency audit has no untriaged critical/high findings.
- [ ] Secret scan passes.
- [ ] Static analysis and manual review findings are resolved or explicitly accepted.
- [ ] Mainnet deployment remains blocked pending independent security review and explicit approval.
