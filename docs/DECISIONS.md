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
