# Threat Model

## Assets
- User ETH and launch-token balances
- Market ETH reserves, token inventory, and accrued fee liabilities
- Token supply and fee accounting
- Deployer credentials and RPC provider credentials
- Database integrity and indexer checkpoints
- User wallet privacy and transaction intent

## Adversaries and failure modes
- Malicious token creator or trader
- Reentrant receiver/contract
- Slippage and deadline manipulation
- Integer rounding, overflow, underflow, or reserve-accounting mistakes
- Front-running, sandwiching, and MEV
- Duplicate/replayed logs and chain reorganizations
- RPC outage, stale data, rate limits, or incorrect chain endpoint
- Malicious metadata URI or malformed API inputs
- Secret leakage in Git history, build logs, or client bundles
- Compromised dependency or GitHub Actions supply chain
- Fee recipient rejecting ETH and causing trade denial of service

## Required controls
- Checks-effects-interactions and reentrancy guard on ETH-moving functions
- Explicit min-output/deadline parameters and conservative rounding
- Immutable bounded fees; total fee <= 500 bps
- Pull-based fee withdrawals so recipient receive() failures do not block trading
- Fixed supply, no upgrade/admin mint, no privileged reserve drain
- Fuzz/invariant tests for supply, reserve solvency, fee bounds, and buy/sell accounting
- Strict chain ID and contract-address checks before wallet writes
- API schema validation, rate limiting, safe error responses, and bounded pagination
- Parameterized database queries and transactionally persisted checkpoints
- Reorg detection by stored block hash and deterministic replay
- Secret scanning, dependency audit, least-privilege CI permissions, and no persistent credentials
- Deployment dry-run, bytecode verification, address/chain record, and independent review

## Residual risks

A bonding curve remains exposed to market manipulation and MEV. Slippage bounds reduce execution surprises but do not eliminate front-running. Testnet testing cannot establish mainnet security. An external audit and explicit deployment approval are required before any mainnet consideration.
