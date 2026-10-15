# Build and Verification Runbook

Run from a clean clone. These are the intended canonical checks; a phase is not complete until commands have actually passed.

## 1. Prerequisites
- Node.js 24.22.0 LTS
- pnpm 10.26.1
- Foundry: forge, cast, anvil
- Git with submodule support
- Docker Engine and Compose for PostgreSQL/local services

## 2. Clone and initialize
    git clone https://github.com/xarvea/micow.git
    cd micow
    git submodule update --init --recursive
    corepack enable
    corepack prepare pnpm@10.26.1 --activate
    cp .env.example .env

Only placeholders belong in .env.example. Never commit .env.

## 3. Install and verify JavaScript workspace
    pnpm install
    pnpm lint
    pnpm typecheck
    pnpm test
    pnpm build

Commit the generated pnpm lockfile. CI should use frozen lockfile installs once the lockfile is established.

## 4. Verify Solidity
    forge --version
    forge fmt --check
    forge build --sizes
    forge test -vvv
    FOUNDRY_PROFILE=ci forge test -vvv

If a check fails, preserve the full error log, identify the first causal error, make a targeted change, and rerun the failed check plus relevant regressions. Never suppress a test to make CI green.

## 5. Run local services
    docker compose -f infra/compose.yaml up -d postgres
    pnpm --filter @micow/api db:migrate
    pnpm --filter @micow/indexer dev
    pnpm --filter @micow/api dev
    pnpm --filter @micow/web dev

Check health/readiness endpoints and inspect the indexer's indexed-through block and reorg recovery logs.

## 6. Testnet preflight
- Confirm RPC reports chain ID 46630.
- Use a dedicated testnet wallet funded only with test ETH.
- Confirm PROTOCOL_FEE_RECIPIENT is non-zero and reviewed.
- Review the deployment transaction and target addresses.
- Never paste a private key into source, issue, chat, command history, or build logs.

## 7. Deploy and record
    forge script contracts/script/DeployTestnet.s.sol:DeployTestnet --rpc-url robinhood_testnet --broadcast

Inject broadcaster credentials through a protected environment or secret manager, never into the command. Record factory address, transaction hash, block number/hash, chain ID, compiler version, optimizer settings, and explorer verification URL in the deployment manifest.

## 8. Recovery and failure triage
1. Capture check name, run URL, failed step, and first actionable error.
2. Classify as source defect, test defect, dependency/configuration issue, provider/outage, or permissions.
3. Reproduce with the narrowest command.
4. Patch the cause, add regression coverage where applicable, and rerun targeted and full gates.
5. Record root cause and fix in PR notes or DECISIONS.md.
6. Merge only when required gates are green and no critical unresolved issue remains.
