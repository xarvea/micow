# MICOW Launchpad — Product Specification

Status: baseline specification v0.2. Environment: Robinhood Chain Testnet only. Out of scope: mainnet deployment, custodial wallets, leverage, promises of returns, fake volume, wash trading, undisclosed paid promotion, and token price guarantees.

## 1. Product objective

Provide a transparent EVM launchpad where a creator can deploy a fixed-supply ERC-20 token and users can buy or sell it against an on-chain bonding curve using native ETH on Robinhood Chain Testnet.

MICOW is an independent implementation. It must not copy third-party code without verified licensing or written permission, and it must not imply affiliation with Pump.fun or Robinhood.

## 2. MVP user journeys

1. Connect an injected EVM wallet.
2. Switch to Robinhood Chain Testnet (chain ID 46630).
3. Create a token with validated name, symbol, and metadata URI.
4. Buy tokens with an explicit minimum output and transaction deadline.
5. Sell tokens with an explicit minimum ETH output and transaction deadline.
6. Inspect token, curve, fee, and transaction information using on-chain data and indexed events.

The MVP is non-custodial. The API is read-only; signing and transaction submission happen in the user's wallet.

## 3. Contract requirements

- Each token has fixed total supply minted once at deployment; no post-deployment mint, pause, blacklist, or upgrade path.
- Factory creates tokens and their associated market atomically, or reverts entirely.
- Market holds the curve inventory and accounts for native ETH reserves separately from virtual reserves and fee liabilities.
- Buy and sell use integer-only arithmetic and explicit slippage bounds.
- User transactions include a deadline; expired transactions revert.
- Reentrancy protection covers state-changing external entry points that move ETH or tokens.
- **Current implementation baseline:** protocol/creator fee rates and recipients are immutable after deployment; combined trading fees are bounded to 500 bps. This describes existing code only.
- **Finalized policy (not implemented):** configurable on-chain fees without redeploying each market: 0.0006 ETH creation, 0.0006 ETH graduation (inactive until graduation exists), and 130 bps bonding-curve buys/sells split into 100 bps treasury + 30 bps creator. Fee basis, rounding, global update behavior, hard bounds, and 24-hour update delay are defined in `docs/FEE_CONFIGURATION.md` and ADR-0006. These values must not be represented as active until implemented, reviewed, and tested.
- Any future configurable controller must enforce hard-coded bounds, explicit authorization/delay policy, non-zero recipients, and pull-based liabilities. Trading must not depend on recipients accepting ETH during a trade.
- Runtime environment variables are not on-chain authority. They may initialize deployment-time values only; changing them cannot mutate deployed contract state.
- No owner-only reserve withdrawal, arbitrary token recovery, or privileged user balance mutation.
- Events are emitted for token creation, buys, sells, and fee accounting.
- All arithmetic, inventory, reserve, fee, and supply invariants are tested.

### Curve model

Use a constant-product pricing model with explicitly documented virtual reserves. The market must hold enough real token inventory to satisfy every sale. Virtual reserves affect pricing only; they are not assets and must never be presented as withdrawable balances. Define buy/sell rounding conservatively and prove fees and rounding cannot create negative reserves or unbacked payouts.

Graduation to an AMM is deferred until target-network router/factory addresses, ABI, bytecode, liquidity custody, and failure/recovery behaviour are independently verified. The graduation fee remains inactive until that flow exists. Uniswap v4 fee collection is out of scope and unverified; standard LP fees must not be described as MICOW creator/treasury revenue.

## 4. Web application

- Next.js App Router + strict TypeScript.
- wagmi + viem for wallet connection, chain checks, reads, writes, receipts, and typed contract ABIs.
- Display active chain and reject writes on unsupported chain.
- Show expected output, minimum output, price impact, fees, and pending/confirmed/failed transaction states.
- Never request or store seed phrases or private keys.
- Validate user input on client and enforce all financial invariants in contracts.

## 5. API and indexer

- Fastify API is read-only; it does not sign transactions.
- PostgreSQL is the canonical indexed read model, not the source of truth for balances or reserves.
- Indexer tracks block number/hash and log index, uses unique event identity, and processes each event idempotently.
- Persist checkpoints transactionally with indexed data.
- Detect reorgs by comparing stored block hashes; roll back derived rows to a common ancestor and replay.
- Reconciliation compares indexed state with RPC contract state.
- Public RPC is for development only; production-like indexing requires a reliable provider/archive endpoint.
- Rate-limit API endpoints and validate all query parameters.

## 6. Network configuration

- Name: Robinhood Chain Testnet
- Chain ID: 46630
- Native asset: ETH
- Public RPC: https://rpc.testnet.chain.robinhood.com
- Explorer: https://explorer.testnet.chain.robinhood.com
- Public RPC is rate-limited and not a production reliability guarantee.

## 7. Delivery gates

A phase is complete only when its acceptance criteria pass and evidence is recorded. A green build alone does not prove contract security. No mainnet deployment, real-value transactions, or claim of audit/completion is permitted under this baseline.
