# CI and Security Gates

## Required pull-request checks
- Solidity formatting (forge fmt --check)
- Solidity build with size report (forge build --sizes)
- Unit, fuzz, and invariant tests
- JavaScript/TypeScript lint, typecheck, tests, and production build
- Dependency audit with high/critical severity threshold
- Secret scan over current files and Git history
- CodeQL analysis of JavaScript/TypeScript source
- Review of contract-specific risks and deployment changes

## Workflow principles
- Minimal top-level permissions; elevate permissions per job only.
- Checkout must not persist credentials unless required.
- Pull-request jobs must not require deployment secrets.
- Testnet deployment is a manual, protected workflow and never runs on ordinary pull requests.
- Do not use continue-on-error to conceal security or test failures.
- Pin third-party Actions to reviewed full commit SHAs before release hardening.
- Dependency updates should be proposed for review, not silently merged.

## Failure policy
A failed required check blocks merge. Diagnose the first actionable error, patch the root cause, add regression coverage where applicable, and rerun affected gates. Document an unavailable check as blocked rather than green.


## Deployment controls

- The automatic testnet preflight only reads the public RPC and runs a Foundry simulation; it never uses `--broadcast`.
- The only workflow that broadcasts is `.github/workflows/deploy-testnet.yml`, which requires an explicit boolean input and the `robinhood-testnet` GitHub environment.
- Configure required reviewers for that environment before storing deployer secrets.
- The workflow must never receive a mainnet private key. Testnet deployment credentials are not present in the repository and were not used during implementation.
- The Foundry toolchain action is pinned to a full commit SHA; optional wallet SDKs for unused connectors are externalized rather than installed just to silence bundler warnings.
