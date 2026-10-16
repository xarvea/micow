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
    pnpm install --frozen-lockfile
    pnpm lint
    pnpm typecheck
    pnpm test
    pnpm --filter @micow/web test:e2e
    pnpm build

The pnpm lockfile is committed. Use frozen installs to preserve deterministic dependency resolution.

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
    export TEST_DATABASE_URL=postgresql://micow:micow@localhost:5432/micow
    pnpm --filter @micow/indexer test:integration
    pnpm --filter @micow/api test:integration
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

Set `DEPLOYER_PRIVATE_KEY` and `PROTOCOL_FEE_RECIPIENT` through a protected local environment or secret manager. The script reads the private key at runtime and rejects any chain ID other than 46630; never put the key in source, command arguments, or logs. Record factory address, transaction hash, block number/hash, chain ID, compiler version, optimizer settings, and explorer verification URL in the deployment manifest.

## 8. Recovery and failure triage
1. Capture check name, run URL, failed step, and first actionable error.
2. Classify as source defect, test defect, dependency/configuration issue, provider/outage, or permissions.
3. Reproduce with the narrowest command.
4. Patch the cause, add regression coverage where applicable, and rerun targeted and full gates.
5. Record root cause and fix in PR notes or DECISIONS.md.
6. Merge only when required gates are green and no critical unresolved issue remains.


## Atomic indexer persistence failure test

The indexer uses a shared transaction helper for per-block persistence and reorg rollback. The PostgreSQL integration suite deliberately inserts a row that violates the trades-side constraint after writing an event and checkpoint, then verifies that the transaction leaves no partial event, checkpoint, or trade rows. Run it with:

    pnpm --filter @micow/indexer test:integration

This test must run only against an isolated test database, never a shared or production database.


## Indexer restart and RPC recovery checks

The indexer derives its next block from the highest durable checkpoint, so restarting after a committed block resumes at the following block rather than replaying the entire chain. The worker supervisor catches cycle-level errors, reports them, and retries after the configured interval while preserving shutdown behavior.

    pnpm --filter @micow/indexer test
    pnpm --filter @micow/indexer test:integration

The integration test requires an isolated PostgreSQL database via `TEST_DATABASE_URL`. These automated tests do not replace a process-level outage drill against a deliberately unavailable/recovering RPC endpoint.


## Read-only on-chain reconciliation

Set `RH_TESTNET_RPC_URL`, `DATABASE_URL`, and `LAUNCHPAD_FACTORY_ADDRESS` for the deployed Robinhood Chain Testnet factory, then run:

    pnpm --filter @micow/indexer reconcile

The command checks chain ID 46630, compares indexed TokenCreated events with token projections, and verifies each indexed token against `LaunchpadFactory.marketForToken(token)` and `BondingCurveMarket.token()`. It pages token rows in batches of 100, retries transient RPC reads, prints a JSON report, and exits non-zero if drift is found or verification cannot complete. It is read-only and does not repair database state or submit transactions. Run it only against the intended testnet factory and database.
