# MICOW Fee Configuration

Status: **proposed architecture / not implemented**. This document records the approved direction for configurable fees; it does not claim that deployed contracts support these controls.

## Decision

MICOW fee values must not depend on runtime `.env` files. Smart contracts cannot read environment variables. Environment variables may supply deployment-time defaults, but changing them after deployment does not change on-chain state.

Use an on-chain fee configuration controller as the source of truth. Factory, bonding-curve contracts, and any DEX hook must read the applicable on-chain configuration. Fees may be changed without redeployment only where the existing deployed contracts were explicitly designed to read that configuration.

Do not add proxy upgradeability solely to change fee values. First audit the current contracts and select the smallest safe architecture compatible with their deployment model.

## Initial fee schedule

All values below are the product's requested initial configuration, pending implementation and tests.

| Fee | Initial value | Recipient / allocation |
| --- | ---: | --- |
| Token creation | 0.0006 ETH | 100% treasury |
| Graduation | 0.0006 ETH | 100% treasury |
| Bonding-curve buy | 130 bps (1.30%) | 30 bps creator + 100 bps treasury |
| Bonding-curve sell | 130 bps (1.30%) | 30 bps creator + 100 bps treasury |
| Uniswap pool buy | 130 bps (1.30%) | 30 bps creator + 100 bps treasury |
| Uniswap pool sell | 130 bps (1.30%) | 30 bps creator + 100 bps treasury |

Use integer basis points for rates and wei for ETH-denominated fixed fees. The fee basis must be explicitly defined in contract documentation and tests. Proposed basis: gross ETH input for buys and gross sell proceeds before fee deductions. Verify that this definition matches each execution path and does not double-charge users.

## Configuration and authority

- Store active fee parameters on-chain; frontend/API configuration is read-only presentation data, not the authority for charging fees.
- Deployment scripts may read `MICOW_CREATION_FEE_WEI`, `MICOW_GRADUATION_FEE_WEI`, and fee-bps variables to initialize contract state. Never commit secrets to environment files.
- Use a dedicated fee-admin role with least privilege. Prefer a treasury Safe multisig as the authority, with a timelock for changes where compatible with the product's operational needs.
- Enforce hard-coded maximums in contract code. Validate that creator and treasury allocations sum to the configured total fee and that no rate exceeds its maximum.
- Emit events for every successful fee configuration change, including old/new values or an auditable equivalent.
- Define whether existing tokens inherit live global rates or snapshot rates at creation. This must be an explicit product decision; never let this behavior emerge accidentally from implementation.
- Fee updates must not retroactively alter already accrued creator balances or treasury liabilities.
- Failed configuration updates must revert atomically.

## Uniswap v4 constraint

A MICOW configuration change does not automatically change a Uniswap v4 pool's fee behavior. Confirm the target chain's deployed Uniswap v4 contracts and the selected pool/hook design first. The proposed 30 bps creator and 100 bps treasury split must be proven to accrue and be withdrawable through the chosen mechanism. Standard LP fees, hook fees, and MICOW treasury revenue are distinct accounting flows.

Do not advertise the DEX fee schedule as active until testnet integration proves collection, allocation, and withdrawal end to end.

## Required implementation and acceptance gates

1. Audit the existing factory, bonding curve, graduation flow, treasury, and any DEX integration before changing code.
2. Implement fixed creation/graduation fees with exact payment validation, treasury accounting, and atomic rollback on failure.
3. Implement 130 bps bonding-curve buy/sell fees with 30 bps creator and 100 bps treasury allocations.
4. Verify Uniswap v4 deployment and implement/validate the selected hook or other supported fee-collection mechanism.
5. Add unit, fuzz, invariant, integration, and buy/sell/graduation accounting tests.
6. Update frontend fee previews and documentation from the on-chain configuration.
7. Require all CI/security checks, reconciliation of accounting, and testnet acceptance evidence before deployment.

### Mandatory invariants

- Total trading fee equals creator allocation plus treasury allocation.
- Fee calculations use integer arithmetic and a documented rounding policy.
- Creator claims and treasury withdrawals cannot spend bonding-curve reserves or other user liabilities.
- A failed buy, sell, creation, graduation, or fee update leaves no partial accounting state.
- Every fixed fee is credited exactly once.
- Emitted configuration and fee-accounting events reconcile with stored balances.
- No DEX fee is treated as treasury revenue until the selected hook/pool mechanism actually collects it.

## Status tracking

- [ ] Existing contracts and deployment model audited.
- [ ] Fee bounds, authority, timelock, and global-vs-per-token behavior finalized.
- [ ] Fixed fees implemented and tested.
- [ ] Bonding-curve fees implemented and tested.
- [ ] Uniswap v4 mechanism validated on the target testnet.
- [ ] Frontend and documentation aligned with on-chain values.
- [ ] CI, security review, and testnet acceptance gates passed.

Mainnet deployment remains out of scope without independent review and explicit approval.
