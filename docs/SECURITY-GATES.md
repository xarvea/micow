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
