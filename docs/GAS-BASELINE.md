# MICOW Gas Baseline

**Status:** Initial measured baseline; regression thresholds intentionally not set pending review.  
**Source:** Local-service E2E receipt measurements from CI run [38922021906](https://github.com/xarvea/micow/actions/runs/38922021906).  
**Scope:** Testnet-compatible contracts exercised only on local Anvil. No public-chain transaction was sent.

## Reproducibility configuration

- Solidity compiler: `0.8.28`
- Optimizer: enabled, `200` runs
- Solidity EVM target: `cancun`
- Local Anvil chain ID: `46630`
- Local Anvil hardfork: `cancun`
- Foundry toolchain: `1.8.5`
- Measurement source: mined local Anvil transaction receipts (`gasUsed`), not gas-price or ETH-cost estimates
- Test setup: local factory deployment, one token/market creation, buy/sell, indexer restart/resume, second buy/sell, market-fee withdrawal, treasury creation-fee withdrawal

## Baseline

| Operation | Receipt gas used |
|---|---:|
| Factory deployment | 2,261,241 |
| Token creation, including token + market deployments | 1,454,403 |
| Buy | 137,184 |
| Sell | 76,971 |
| Market fee withdrawal | 36,138 |
| Treasury creation-fee withdrawal | 36,160 |

These values are reproducible baselines from the configured local EVM. They are not estimates of transaction fee in ETH, and they do not guarantee identical gas on the Robinhood testnet or another fork. Chain-specific gas rules, deployment address/state, compiler settings, and future source changes can affect results.

## Regression policy

- Keep these measurements as a reviewed baseline, not a release threshold by themselves.
- Do not set CI gas-regression thresholds until the project owner reviews the measured values and acceptable variance.
- The Foundry `GasSnapshot.t.sol` suite separately records call-frame snapshots for contract-level regression comparisons; those measurements should not be mixed with mined transaction receipt values above.
- Re-run the local E2E baseline when compiler, optimizer, EVM target, contract bytecode, or relevant transaction flow changes.
- Mainnet remains out of scope. No deployment was performed for this measurement.
