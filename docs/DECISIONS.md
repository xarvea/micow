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
