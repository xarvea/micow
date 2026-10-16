# Architecture Decision Records

## ADR-0001 — Testnet-only baseline

**Decision:** Target Robinhood Chain Testnet (chain ID 46630) only during MVP.  
**Reason:** Validate EVM contract behaviour and user flows without risking real assets.  
**Consequence:** Deployment scripts must assert chain ID; mainnet configuration and deployment are excluded.

## ADR-0002 — Contracts are source of truth

**Decision:** Token supply, curve reserves, and trade outcomes are determined by contracts. API/database are read models only.  
**Reason:** Prevent off-chain data from authoritatively determining financial state.  
**Consequence:** Indexer must reconcile and recover from reorgs.

## ADR-0003 — Clean-room implementation

**Decision:** Independently implement MICOW; do not copy legacy source until license or written permission is verified.  
**Reason:** Existing legacy source has no verified license in the repository inspection.  
**Consequence:** Track external code and assets in provenance documentation.


## ADR-0004 — Deployment approval boundary

**Decision:** MICOW remains Robinhood Chain Testnet-only. No deployment transaction may be broadcast until the testnet-only deployer credential is held in the protected `robinhood-testnet` environment, required reviewers are configured and verified, the fee recipient is reviewed, and the deployment dry-run is reviewed. Mainnet is not authorized by this ADR.

**Reason:** A passing CI run or a local simulation is not authorization to broadcast a transaction.

**Consequence:** Testnet deployment remains blocked until each preflight item is evidenced. Never place credentials in repository files, chat, command arguments, or logs.

## ADR-0005 — Multisig/governance is not yet selected

**Decision:** A Safe 3-of-5 or other multisig governance model is **not adopted as an implementation decision** by the current MICOW baseline. The MVP contracts have immutable fee settings and no upgrade/admin pause path; the testnet deployment workflow uses explicit broadcast opt-in and protected-environment controls.

**Reason:** A multisig is not automatically useful unless signer identities, recovery, signer availability, transaction policy, ownership responsibilities, and contract-level authority are defined and reviewed.

**Consequence:** Before any production/mainnet proposal, create a separate governance ADR defining signer count and threshold, signers and recovery, roles/permissions, key custody, transaction policy, emergency response, and contract integration. This is not permission to deploy to mainnet.


## ADR-0006 — Fee policy and configurable controller

**Status:** Fee policy decided for implementation; controller not implemented. This ADR records product/economic policy, not deployment authorization.

**Context:** Source audit of `LaunchpadFactory.sol` and `BondingCurveMarket.sol` found immutable 100 bps protocol + 100 bps creator rates, a 500 bps cap, immutable treasury recipient, and pull-based liabilities. Factory creation is non-payable; graduation and DEX fee collection are absent. The contracts are non-upgradeable, so an added controller cannot retrofit already deployed markets.

**Decisions:**

1. Creation fee: 0.0006 ETH, paid exactly to treasury accounting in `LaunchpadFactory` as a treasury-only pull liability; underpayment and overpayment revert. The factory does not synchronously call the treasury during token creation, so a rejecting treasury cannot block creation. Withdrawal is guarded and only the configured treasury may claim.
2. Graduation fee: 0.0006 ETH to treasury accounting as a pull liability in the graduation execution contract, inactive until graduation is implemented and tested atomically. No direct treasury call in the critical graduation path.
3. Bonding-curve buy/sell fee: 130 bps total, split 100 bps treasury + 30 bps creator.
4. Fee basis: buys use gross ETH input; sells use gross curve proceeds before fee deduction.
5. Rounding: total fee is floored once at 130 bps; treasury share is floored at 100 bps; creator receives the remainder so allocations equal the charged total.
6. Global live configuration: all controller-enabled markets read the active config per transaction; updates affect existing markets as well as new ones. UI must disclose global scope.
7. Hard bounds: combined trading fee <= 500 bps; creation and graduation fees <= 0.01 ETH each.
8. Fee changes are queued with a fixed 24-hour delay and can be cancelled before execution. Every queue/cancel/execute action emits auditable events.
9. A dedicated non-zero controller admin is separate from the treasury recipient; authority transfer is two-step. Mainnet governance and multisig threshold require a separate ADR; this ADR does not adopt Safe 3-of-5.
10. Treasury recipient and token creator remain immutable payout identities. Controller changes only fee amounts/rates.
11. No proxy upgradeability. Controller-enabled factory and markets must be deployed as a compatible bundle. Existing immutable markets remain immutable.
12. Uniswap v4 fees are excluded from this policy until target-chain contracts, hook permissions, accounting, custody, and end-to-end collection/withdrawal are verified.

**Consequences:** Runtime `.env` values are not authority; they may initialize deployment only. This ADR does not authorize deployment, does not make the proposed fee schedule active, and does not authorize mainnet. All controller behavior requires code review, unit/fuzz/invariant/integration tests, independent security/economic review, and testnet acceptance evidence.
