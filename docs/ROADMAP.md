# MICOW Delivery Roadmap

Project state as of 2026-10-16: **P8 — Testnet launch-readiness hardening**. Testnet-only. A phase is complete only when evidence is recorded against its acceptance gate. The project is not audited and is not authorized for mainnet.

## Current execution snapshot

- **Merged:** foundation, contract baseline, RPC/API hardening, PostgreSQL idempotency/reorg integration, atomic indexer persistence, and worker restart/cycle recovery.
- **Current main snapshot after PR #28:** `02c314518e64318e6a88a4c76f52daf1fcfa2a5b`. Main CI `38940734418` and security `38940734236` were running when this snapshot was prepared; check final conclusions before declaring post-merge gates verified.
- **Merged:** PR #6 read-only reconciliation CLI, PR #7 process-level outage/restart acceptance, PR #8 fee-policy proposal documentation, PR #13 post-PR11 documentation refresh, and PR #14 forced-ETH accounting regression test.
- **PR #7 verification:** CI run `38837255615` and security run `38837255569` passed on the latest PR head before merge. Current main CI/security runs `38916331756` and `38916331618` passed on exact SHA `f3a398781b30bf35d633e4de4d2bdf39672cd166`.
- **Blocked:** live reconciliation and testnet deployment require an actual deployed factory; deployment also requires a protected testnet-only deployer key, test ETH, a reviewed fee recipient, and protected environment reviewers.
- **Merged:** PR #18 economic regression tests, PR #19 gas instrumentation, PR #22 preliminary source-based economic/MEV review, PR #23 restart/resume E2E, PR #25 measured gas receipt baseline, and PR #26 API database-outage readiness plus fail-closed endpoint guards.
- **Not complete:** a real external-provider outage drill (simulated process-level outage tests are CI evidence only), durable backup retention and protected-environment operator restore, independent contract audit, owner decision on residual MEV sandwich risk, live testnet reconciliation and deployment.
- **Completed in PR #28:** guarded PostgreSQL backup/restore CI fixture drill; PR CI `38936723431` and security `38936723423` passed. This does not establish durable backup retention or a protected-environment recovery.
- **Safety boundary:** no mainnet configuration, deployment, or real-value transaction is authorized by this roadmap.

## Phase 0 — Foundation and specification
Deliverables: product scope, architecture, threat model, ADRs, provenance, toolchain pins, monorepo layout, CI/security plan.
Exit gate: scope and interfaces documented; secrets absent; reproducible toolchain recorded.

## Fee architecture gate (cross-cutting)

The source audit is complete and fee policy is recorded in ADR-0006. Current markets use immutable 100 bps protocol + 100 bps creator fees. PR #11 implements the exact 0.0006 ETH creation fee with treasury-only pull accounting and guarded withdrawal; graduation/controller/DEX fee collection remain absent. The finalized future policy is 0.0006 ETH creation, 0.0006 ETH graduation when implemented, and 130 bps curve buy/sell (100 bps treasury + 30 bps creator), global-live config, 500 bps trading cap, 0.01 ETH fixed-fee cap, and 24-hour delayed updates. The controller is not implemented. Existing immutable markets cannot be retrofitted; deploy a compatible controller/factory/market bundle only after tests and independent review. Uniswap v4 fees remain out of scope pending verification.

## Phase 1 — Smart contracts
Tasks: fixed-supply ERC-20; atomic factory; constant-product curve; conservative integer rounding; virtual/real reserve separation; slippage/deadline; bounded fee configuration and hard cap; current contracts use immutable fee settings, while the proposed mutable on-chain controller is not implemented; pull-based fee withdrawal; reentrancy protection; event schema; deployment guard.
Exit gate: contracts compile without unexplained warnings; invariants and unit/fuzz tests pass; independent code-review findings resolved.

## Phase 2 — Contract test quality
Tasks: success/revert unit tests; zero/boundary/extreme fuzzing; stateful buy/sell invariant handler; reserve solvency; token conservation; fee liability accounting; malicious receiver tests; gas and bytecode-size report.
Exit gate: standard and CI-profile test suites pass with recorded runs; no unexplained invariant failures. Receipt-based local Anvil gas baselines are recorded in `docs/GAS-BASELINE.md`; CI regression thresholds remain unset pending review.

## Phase 3 — Web application
Tasks: Next.js App Router; strict TypeScript; responsive dashboard; wallet connect/disconnect; wrong-chain handling; factory/token/market reads; create-token form; buy/sell quote and min-output; pending/confirmed/reverted transaction states; metadata safety; accessible errors/loading states.
Exit gate: lint/typecheck/build pass; wallet flow and wrong-chain flow tested; no signing/custody outside wallet.

## Phase 4 — Database, indexer, and API
Tasks: PostgreSQL migrations; block/hash checkpoints; event identity uniqueness; atomic event+projection+checkpoint transactions; idempotent replay; reorg common-ancestor rollback and replay; worker retry/shutdown and durable restart resume; read-only Fastify endpoints; schema validation; rate limiting; pagination; readiness; read-only reconciliation CLI against factory registry and market token getters.
Exit gate: integration tests prove duplicate replay is harmless, reorgs repair projections, checkpoints are atomic, and projection-vs-event consistency is tested. Full phase exit additionally requires a successful live reconciliation against an actually deployed testnet factory.

## Phase 5 — Local integration and developer experience
Tasks: one-command local services; migration and seed tooling; environment validation; end-to-end smoke tests; deterministic ABI/address manifest; troubleshooting.
Exit gate: clean checkout can install, build, test, migrate, and run services using the runbook. CI E2E covers local Anvil create/buy/sell, API readiness during database outage/recovery, migration reapply, indexer durable checkpoint resume/idempotent replay, and clean shutdown. Endpoint guards reject nonlocal RPC, database, API, and web targets before deployment commands.

## Phase 6 — Testnet deployment
Tasks: confirm chain ID 46630; funded test wallet; dry run; deploy factory; record deployment transaction/block/compiler settings; verify source/metadata if supported; smoke-test token creation, buy, sell, fee withdrawal; verify indexed data.
Exit gate: all evidence recorded in deployment manifest; no mainnet address or key in testnet configuration.

## Phase 7 — CI, supply-chain, and security gates
Tasks: Solidity format/build/unit/fuzz/invariant; web/API/indexer lint/typecheck/build/tests; dependency audit; secret scan; CodeQL; pinned actions/dependencies; least-privilege workflow permissions; PR gates; failure triage.
Exit gate: required CI checks green on exact merge head; no unresolved critical/high findings; financial logic reviewed.

## Phase 8 — Testnet launch readiness
Tasks: threat-model review; operations and incident runbooks; backup/restore drill; indexer catch-up and reorg drill; RPC outage/retry drill; wallet test matrix; known limitations and user disclosures.
Exit gate: testnet release checklist completed; no claim of audit or production readiness.

## Phase 9 — Mainnet readiness (not authorized in this scope)
Requires independent audit, economic/MEV analysis, verified target DEX integration, operations monitoring, incident response, legal/product review, explicit owner approval, and a separate deployment plan. Testnet success alone is insufficient.
