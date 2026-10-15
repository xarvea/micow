# Contracts (Foundry)

Solidity source, tests, and scripts live under `src/`, `test/`, and `script/`. OpenZeppelin Contracts v5.4.0 and forge-std v1.9.7 are pinned as Git submodules in `contracts/lib/`; do not update them without review and passing CI.

## Initial implementation

- `LaunchToken.sol`: 1 billion tokens (18 decimals), minted once to the factory; no privileged mint or upgrade path.
- `LaunchpadFactory.sol`: deploys a token and dedicated market atomically; records token-to-market mapping.
- `BondingCurveMarket.sol`: native ETH buys/sells, virtual reserves, fixed 1% protocol + 1% creator fees, 5% hard cap, min-output/deadline checks, and reentrancy guard.
- `DeployTestnet.s.sol`: refuses to run unless chain ID is 46630.

## Local commands

```bash
git submodule update --init --recursive
forge fmt --check
forge build --sizes
forge test -vvv
forge test --match-contract LaunchpadInvariantTest --invariant-runs 512
```

## Security rules

- No mainnet deployment in this phase.
- No upgradeability, privileged mint, pause, blacklist, or reserve-drain method in the MVP.
- Fee rates and recipients are immutable; combined fees cannot exceed 500 bps.
- All ETH-moving entry points require reentrancy protection and slippage/deadline checks.
- Treat these contracts as unreviewed until tests and manual security review complete.
