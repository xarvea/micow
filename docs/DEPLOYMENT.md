# Testnet Deployment and Verification

**Current status: BLOCKED.** No testnet deployment has been performed. A testnet-only deployer key and test ETH funding are required. Deployment-environment protection and reviewer configuration must be verified before any broadcast. Supply `DEPLOYER_PRIVATE_KEY` and `PROTOCOL_FEE_RECIPIENT` through a protected local environment or secret manager; never commit the key or print it in logs.

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


## GitHub Actions deployment workflow

The repository provides two separate safety paths:

1. **Main-branch preflight:** on a push to `main`, CI checks that the configured public RPC reports chain ID `46630` and simulates the factory deployment without `--broadcast`. It generates an ephemeral throwaway key; that key is masked, never stored, and never funded.
2. **Manual deployment:** open **Actions → Deploy MICOW to Robinhood Chain Testnet → Run workflow**. Keep `broadcast=false` for the first run. A real broadcast requires explicitly setting `broadcast=true`, a funded testnet key in the protected `robinhood-testnet` environment, and a non-zero `PROTOCOL_FEE_RECIPIENT` repository/environment variable.

Before enabling broadcast, verify that the GitHub `robinhood-testnet` environment has required reviewers and the `DEPLOYER_PRIVATE_KEY` secret. Confirm the workflow is the only broadcast entry point, is not triggerable from arbitrary PR code, and enforces the chain-ID guard immediately before broadcasting. Set `RH_TESTNET_RPC_URL` and `PROTOCOL_FEE_RECIPIENT` as environment variables. Confirm the account has only test ETH and never reuse a mainnet key.

A successful broadcast uploads the Foundry run record as a workflow artifact. Record the factory address and transaction/block data from that artifact. Source verification remains a separate gate until the explorer's verification API and parameters are confirmed. The deployment workflow has not been run; no deployed address is currently claimed. No Safe 3-of-5 governance arrangement is adopted by the current MVP; see ADR-0005. Mainnet deployment remains explicitly unauthorized.
