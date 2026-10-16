# MICOW Bonding-Curve Economic and MEV Review

**Review status:** Preliminary source review; not an independent audit.  
**Scope:** `contracts/src/BondingCurveMarket.sol`, `contracts/src/LaunchpadFactory.sol`, and the economic regression tests.  
**Product boundary:** Testnet-only. No public-chain transactions or deployment were performed.

## Executive summary

The current implementation uses an immutable 100 bps protocol fee plus 100 bps creator fee on curve buys/sells, with virtual reserves of 1 ETH and 1 billion tokens, alongside real reserves. The factory creation fee is exactly 0.0006 ETH and is tracked as a pull-based treasury liability. The proposed 130 bps configurable controller and graduation/DEX fees are not implemented and are not part of this review's assumptions.

The source review found no confirmed reserve-accounting bypass in the reviewed paths. The main residual risks are public-mempool sandwich exposure, predictable floor-rounding of fee components on tiny trades, and expected reverts for trades whose output rounds to zero. These are recorded below as design/UX risks, not as proof of exploitability. Full CI on the merged economic-test commit and gas baselines remain separate gates.

## Accounting model checked

Let `R` be the market's real ETH reserve and `L` its total claimable market fee liabilities.

- **Buy:** `R' = R + grossIn - fees`; `L' = L + fees`; market ETH balance increases by `grossIn`.
- **Sell:** `grossOut = netOut + fees`; `R' = R - grossOut`; `L' = L + fees`; market ETH balance decreases by `netOut`.
- **Market withdrawal:** the caller's liability and total liability are reduced before the ETH call; a failed transfer reverts the transaction, restoring state.
- **Factory creation fee:** the factory receives exactly 0.0006 ETH and increments the treasury liability by the same amount. Withdrawal similarly clears the liability before transfer and reverts atomically on failure.
- **Forced ETH:** forced ETH can make the raw balance exceed tracked reserves plus liabilities. It does not change `realEthReserve`, `totalClaimableFees`, or `totalClaimableTreasuryFees`; the excess is unaccounted surplus, not a claimable fee.

These invariants assume ordinary EVM transaction atomicity and the current fixed-supply token implementation. The review does not assert that every possible adversarial interaction has been independently audited.

## Findings and dispositions

| ID | Severity | Finding | Disposition |
|---|---|---|---|
| ECON-01 | Medium — design risk | A public mempool permits sandwich/front-running around trades. The contract checks caller-supplied `minTokensOut` / `minEthOut` and deadline, but callers can set a zero minimum; UI defaults are not contract-enforced guarantees. | Keep explicit minimum-output and deadline protection in every wallet flow. Display price impact and slippage. Residual risk remains open for explicit project-owner acceptance before issue #16 can close; no oracle or private-orderflow guarantee is claimed. |
| ECON-02 | Low — rounding behavior | Each fee component is independently rounded down. For buy inputs of 99 wei both components are zero; at 100 wei each component is 1 wei; at 199 wei each is 1 wei; at 200 wei each is 2 wei. Tiny sell fees can likewise round to zero because fees are computed on gross ETH output. | Deterministic integer-rounding behavior; regression tests document it. Do not change fee rounding without a separate economic decision because rounding up changes effective rates for small trades. |
| ECON-03 | Low — UX/liveness edge | A sell whose gross ETH output rounds to zero reverts with insufficient liquidity. This is expected for dust-sized trades under integer arithmetic. | Keep the regression test and ensure the UI handles quote reverts clearly; do not describe dust trades as guaranteed executable. |
| ECON-04 | Low — bounded by inventory/reserves | There is no explicit per-transaction amount cap. Buys revert if calculated output exceeds the real token inventory; sells revert if gross ETH output exceeds the real ETH reserve. Very large requests may therefore fail rather than execute partially. | Existing inventory/reserve checks remain the hard bounds. Consider a separate max-trade policy only if product requirements demand one; it is not added by this review. |
| ECON-05 | Informational | Forced ETH creates a balance surplus that the contracts do not recover or assign to treasury liabilities. | Intentional accounting policy. Reconciliation/monitoring must distinguish raw balance from tracked reserves and liabilities. |
| ECON-06 | Informational | If creator and protocol fee recipient are the same address, both fee components accrue to the same mapping entry. | Regression test asserts the combined liability is counted once in the total-liability sum per accrued wei, with no double-counted balance obligation. |
| ECON-07 | Informational | Failed market fee withdrawal must not erase a claim; failed treasury withdrawal must not erase the treasury liability. | Market rejection path is covered by the economic regression tests; the existing factory tests cover a rejecting treasury and preservation of its liability. |

## Test evidence

- Economic regression tests added in PR #18: fuzzed buy/sell quote-to-execution and accounting, buy fee rounding boundaries, inventory exhaustion, forced-ETH surplus, overlapping recipients, and failed market fee withdrawal.
- Foundry standard and high-intensity contract suites passed on PR #18 head `6373d6a51f947c72affc445a97f0de17c1ce13bd`.
- Full PR CI/security and post-merge main checks must be tracked separately; this document does not claim those gates have passed.
- Gas snapshots and the P5 local service E2E are separate release gates.
- No public testnet broadcast or deployment was performed.

## Limits

This is a source-based engineering review, not an independent smart-contract audit, formal verification, oracle/MEV guarantee, or mainnet-readiness certification. It does not review legal/product obligations, external DEX graduation, or the unimplemented fee controller. Mainnet remains out of scope.
