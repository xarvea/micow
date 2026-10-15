# MICOW Delivery Roadmap

Project state: active implementation, testnet-only. A phase is complete only when evidence is recorded against its acceptance gate. The project is not audited and is not authorized for mainnet.

## Phase 0 — Foundation and specification
Deliverables: product scope, architecture, threat model, ADRs, provenance, toolchain pins, monorepo layout, CI/security plan.
Exit gate: scope and interfaces documented; secrets absent; reproducible toolchain recorded.

## Phase 1 — Smart contracts
Tasks: fixed-supply ERC-20; atomic factory; constant-product curve; conservative integer rounding; virtual/real reserve separation; slippage/deadline; immutable fee configuration and hard cap; pull-based fee withdrawal; reentrancy protection; event schema; deployment guard.
Exit gate: contracts compile without unexplained warnings; invariants and unit/fuzz tests pass; independent code-review findings resolved.

## Phase 2 — Contract test quality
Tasks: success/revert unit tests; zero/boundary/extreme fuzzing; stateful buy/sell invariant handler; reserve solvency; token conservation; fee liability accounting; malicious receiver tests; gas and bytecode-size report.
Exit gate: standard and CI-profile test suites pass with recorded runs; no unexplained invariant failures.

## Phase 3 — Web application
Tasks: Next.js App Router; strict TypeScript; responsive dashboard; wallet connect/disconnect; wrong-chain handling; factory/token/market reads; create-token form; buy/sell quote and min-output; pending/confirmed/reverted transaction states; metadata safety; accessible errors/loading states.
Exit gate: lint/typecheck/build pass; wallet flow and wrong-chain flow tested; no signing/custody outside wallet.

## Phase 4 — Database, indexer, and API
Tasks: PostgreSQL migrations; block/hash checkpoints; event identity uniqueness; atomic event+projection+checkpoint transactions; idempotent replay; reorg common-ancestor rollback and replay; read-only Fastify endpoints; schema validation; rate limiting; pagination; readiness and reconciliation.
Exit gate: integration tests prove duplicate replay is harmless, reorgs repair projections, checkpoints are atomic, and indexed reads reconcile to RPC state.

## Phase 5 — Local integration and developer experience
Tasks: one-command local services; migration and seed tooling; environment validation; end-to-end smoke tests; deterministic ABI/address manifest; troubleshooting.
Exit gate: clean checkout can install, build, test, migrate, and run services using the runbook.

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
