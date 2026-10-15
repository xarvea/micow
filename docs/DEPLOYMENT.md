# Testnet Deployment and Verification

**Current status: BLOCKED.** No testnet deployment has been performed. A testnet-only deployer key and test ETH funding are required. Supply `DEPLOYER_PRIVATE_KEY` and `PROTOCOL_FEE_RECIPIENT` through a protected local environment or secret manager; never commit the key or print it in logs.

## Network constants
- Network: Robinhood Chain Testnet
- Chain ID: 46630
- Native gas asset: ETH
- RPC: https://rpc.testnet.chain.robinhood.com
- Explorer: https://explorer.testnet.chain.robinhood.com

Public RPC is rate-limited. Use a dedicated provider for sustained indexing. Query eth_chainId at runtime rather than trusting a label.

## Current deployment status

No testnet deployment has been performed. Deployment remains blocked until a testnet-only deployer key is supplied through a protected local environment or secret manager and the wallet is funded with test ETH. Do not add the key to Git, CI logs, issues, or chat.

## Preflight gates
- [ ] Contract format, build, unit, fuzz, and invariant tests pass on the exact commit.
- [ ] No critical/high unresolved contract finding.
- [ ] Deployment wallet is testnet-only and funded with test ETH.
- [ ] PROTOCOL_FEE_RECIPIENT is a reviewed non-zero address.
- [ ] Dry-run and bytecode-size report are reviewed.
- [ ] ABI and compiler settings come from the build artifact.
- [ ] No mainnet RPC or key is present in testnet configuration.

## Deployment evidence
Store in a versioned deployment manifest without secrets:
- chain ID and network name
- commit SHA
- compiler version, optimizer settings, EVM version
- factory address and transaction hash
- block number and block hash
- explorer verification status and URL
- smoke-test transaction hashes and results
- indexer start block and reconciliation result

## Post-deploy smoke tests
1. Read factory code and protocol fee recipient at the deployed address.
2. Create a token; verify event fields and token-to-market mapping.
3. Verify total supply and market token inventory.
4. Buy with a non-zero minimum output and deadline.
5. Sell after approving the market; verify minimum ETH output and fee liabilities.
6. Withdraw accrued fees as each configured recipient.
7. Verify API projections against direct contract reads.
8. Restart indexer and confirm idempotent resume.
9. Simulate a reorg in local integration tests; never attempt to force a public testnet reorg.

Deployment does not imply audit, mainnet readiness, or safety for real-value assets.
