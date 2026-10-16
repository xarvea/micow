# MICOW Fee Configuration

Status: **fixed creation fee implemented in PR #11; configurable controller, graduation fee, and 130 bps trading-fee policy are not implemented**. This branch changes source code but does not alter any deployed contract. Existing deployments remain unchanged.

## Contract audit — current source baseline

Reviewed `contracts/src/LaunchpadFactory.sol`, `contracts/src/BondingCurveMarket.sol`, `contracts/script/DeployTestnet.s.sol`, and the corresponding Foundry tests.

- `LaunchpadFactory` has an immutable, non-zero `protocolFeeRecipient`; this PR makes `createToken` payable and requires exactly `CREATION_FEE = 0.0006 ether`. Underpayment and overpayment revert.
- The factory deploys a new `BondingCurveMarket` for every token and passes the creator and treasury recipient into its constructor.
- `BondingCurveMarket` is explicitly non-upgradeable. It stores immutable per-market `protocolFeeBps` and `creatorFeeBps`, currently 100 bps each, with a 500 bps combined hard cap.
- Buy fees are calculated on gross `msg.value`; sell fees are calculated on gross curve proceeds before fee deductions. Each fee component currently rounds down independently.
- ETH accounting separates `realEthReserve` from `totalClaimableFees`; fee withdrawal is pull-based and guarded by `nonReentrant`.
- The creation fee in this PR accrues to `claimableTreasuryFees[protocolFeeRecipient]` and `totalClaimableTreasuryFees`; `withdrawTreasuryFees` is restricted to the configured treasury, guarded against reentrancy, and uses pull-based withdrawal without calling the treasury during token creation.
- No graduation flow/fee, fee controller, Uniswap v4 integration, or DEX fee collection exists in this branch.
- Therefore, changing `.env` or adding a controller alone cannot change current markets. The factory/market construction and fee reads must be changed and deployed together; no existing deployment is assumed.

## Finalized fee policy for implementation

The creation-fee row is implemented by this PR once merged and deployed in a new factory. The remaining values below are policy targets, **not active contract behavior**.

| Fee | Target | Basis / allocation |
| --- | ---: | --- |
| Token creation | 0.0006 ETH | Fixed fee, 100% treasury |
| Graduation | 0.0006 ETH | Fixed fee, 100% treasury; inactive until graduation is implemented |
| Bonding-curve buy | 130 bps (1.30%) | Gross ETH input; 100 bps treasury + 30 bps creator |
| Bonding-curve sell | 130 bps (1.30%) | Gross curve proceeds before fee deduction; 100 bps treasury + 30 bps creator |
| Uniswap pool buy/sell | **Out of scope / undecided** | No fee charged or advertised until target-chain deployment and collection mechanism are verified |

### Rounding and allocation

- Use integer wei and basis points; no floating-point fee math.
- Calculate total trading fee as `floor(grossAmount * 130 / 10_000)`.
- Calculate treasury allocation as `floor(grossAmount * 100 / 10_000)`; creator allocation is the remainder of the total fee. This ensures the two allocations sum exactly to the charged total, with sub-wei rounding dust assigned to the creator allocation.
- Buy fees use the gross ETH supplied by the trader. Curve pricing uses net ETH after fees.
- Sell fees use the gross ETH proceeds returned by the curve calculation before fee deductions. The trader receives gross proceeds less the total fee.
- Creation/graduation fixed fees are exact wei amounts. Calls below or above the configured fee must revert; do not silently refund or retain overpayment.
- **Fixed-fee custody:** `LaunchpadFactory` records creation fees as a treasury-only pull liability (`claimableTreasuryFees` + `totalClaimableTreasuryFees`) and exposes a guarded treasury withdrawal. Do not forward ETH to the treasury during `createToken`; a rejecting recipient must not block token creation. Fee accounting and token/market deployment must revert atomically on failure. Graduation fees, when graduation exists, use the same pull-liability principle in the contract that executes graduation.
- Accrued creator and treasury liabilities are not retroactively changed by future fee configuration updates.

## Controller behavior and safety policy

1. **Single global live configuration.** All markets read the current on-chain controller at execution time. A successful fee change therefore applies to existing and newly created markets. This satisfies the requirement to adjust fees without redeploying each market. The UI must clearly disclose that updates affect all markets.
2. **No proxy upgrades.** Use a separately deployed controller referenced immutably by the factory and each market. This only works for markets deployed with controller support; it cannot retrofit current immutable markets.
3. **Hard bounds:** combined trading fee must never exceed 500 bps; creation and graduation fee must never exceed 0.01 ETH each. Initial values are 130 bps and 0.0006 ETH respectively.
4. **Delayed updates:** fee changes must be queued and become executable only after a fixed 24-hour delay. Cancellation must be possible before execution. Emit auditable events for queue, cancellation, and execution.
5. **Authority:** controller admin is a dedicated non-zero address, separate from the fee recipient. Ownership/authority transfer must be two-step. The controller must not expose reserve withdrawals, token recovery, or arbitrary user-balance mutation. Mainnet governance remains subject to a separate ADR and explicit approval; no Safe threshold is adopted here.
6. **Recipient policy:** treasury recipient and each token's creator are immutable identities. The controller changes fee amounts/rates, not payout destinations.
7. **Atomic accounting:** fixed fees accrue to a treasury-only pull liability in the factory; curve fees remain pull-based liabilities in each market. Neither path calls the treasury recipient during trade/token creation. Fee liabilities must never be funded from curve reserves or from other users' liabilities.
8. **Configuration reads:** each buy/sell snapshots one configuration result within that transaction. A revert leaves no partial fee/configuration accounting.
9. **Environment variables:** deployment scripts may read variables to initialize the first configuration. Runtime environment values are never authoritative and cannot mutate on-chain state.
10. **Migration:** do not claim existing markets are configurable. Deploying a new controller does not modify existing immutable markets; testnet deployment must use the new factory/market/controller bundle.

## Graduation and DEX boundary

Graduation fee collection remains inactive until a graduation transaction exists and has an atomic, tested success/failure path. A failed graduation must not collect a fee or leave partial liquidity/custody state.

Uniswap v4 is not included in the finalized active fee policy. Before adding it, verify target-chain PoolManager/PositionManager addresses, code/ABI, selected hook and permissions, pool initialization, liquidity custody, failure/recovery, and end-to-end fee allocation/withdrawal. Standard LP fees, hook fees, and MICOW treasury revenue are distinct accounting flows. Do not advertise a 130 bps DEX fee until it is independently validated.

## Required implementation and acceptance gates

- [ ] Implement controller and factory/market integration according to this policy.
- [x] Verify exact creation fee, over/underpayment reverts, treasury-only pull accounting, guarded withdrawal, rejecting treasury behavior, and failure rollback through merged PR #11 CI (`38875916343`).
- [ ] Test fixed graduation fee only after graduation flow is implemented.
- [ ] Add unit, fuzz, invariant and integration tests for 130 bps curve fees, rounding, recipient split, liabilities, and reverts.
- [ ] Test 24-hour delay, cancellation, authority transfer, hard bounds, and global updates across existing markets.
- [ ] Test front-end fee previews against on-chain controller reads.
- [ ] Independent contract/economic review and all CI/security checks pass.
- [ ] Testnet-only deployment dry-run, post-deployment reconciliation and accounting evidence reviewed before any broadcast.

Mainnet deployment remains out of scope without independent review and explicit approval.
