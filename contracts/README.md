# Contracts (Foundry)

Solidity source, tests, and scripts live here. Compiler version and EVM target are explicitly configured in the root `foundry.toml`; changes require a recorded decision and passing tests.

## Security rules

- No mainnet deployment in this phase.
- No upgradeability, privileged mint, pause, blacklist, or reserve-drain method in the MVP.
- Fee settings are immutable and combined fees cannot exceed 500 bps.
- All ETH-moving entry points require reentrancy protection and slippage/deadline checks where applicable.
- Do not store deployer private keys in files or repository secrets without a specific deployment approval.
