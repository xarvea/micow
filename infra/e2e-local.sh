#!/usr/bin/env bash
set -Eeuo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

LOCAL_RPC="${LOCAL_RPC_URL:-http://127.0.0.1:8545}"
DATABASE_URL="${DATABASE_URL:-postgresql://micow:micow@127.0.0.1:5432/micow}"
API_URL="${API_URL:-http://127.0.0.1:4000}"
WEB_URL="${WEB_URL:-http://127.0.0.1:3000}"
ANVIL_KEY=""
LOCAL_ADDRESS="0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266"
LOG_DIR="${TMPDIR:-/tmp}/micow-p5-e2e"
mkdir -p "$LOG_DIR"

ANVIL_PID=""
API_PID=""
INDEXER_PID=""
WEB_PID=""

cleanup() {
  for pid in "$WEB_PID" "$INDEXER_PID" "$API_PID" "$ANVIL_PID"; do
    if [[ -n "$pid" ]]; then kill "$pid" 2>/dev/null || true; fi
  done
  for pid in "$WEB_PID" "$INDEXER_PID" "$API_PID" "$ANVIL_PID"; do
    if [[ -n "$pid" ]]; then wait "$pid" 2>/dev/null || true; fi
  done
}
trap cleanup EXIT

wait_for() {
  local name="$1"
  local command="$2"
  for _ in $(seq 1 60); do
    if eval "$command" >/dev/null 2>&1; then
      printf 'ready: %s\n' "$name"
      return 0
    fi
    sleep 2
  done
  printf 'ERROR: timed out waiting for %s\n' "$name" >&2
  return 1
}

decimal_gas() {
  node -e 'console.log(BigInt(process.argv[1]).toString())' "$1"
}

INDEXER_RUN=1
start_indexer() {
  local log_file="$LOG_DIR/indexer-${INDEXER_RUN}.log"
  (cd apps/indexer && ./node_modules/.bin/tsx src/main.ts) >"$log_file" 2>&1 &
  INDEXER_PID=$!
  wait_for "indexer startup ${INDEXER_RUN}" "grep -q 'MICOW indexer started on chain 46630' '$log_file'"
}

stop_process() {
  local name="$1"
  local pid="$2"
  local log_file="$3"
  if ! kill -0 "$pid" 2>/dev/null; then
    wait "$pid" 2>/dev/null || true
    printf 'stopped: %s (already exited)\n' "$name"
    return 0
  fi
  kill -TERM "$pid"
  for _ in $(seq 1 20); do
    if ! kill -0 "$pid" 2>/dev/null; then
      wait "$pid"
      printf 'stopped: %s\n' "$name"
      return 0
    fi
    sleep 1
  done
  cat "$log_file" >&2
  printf 'ERROR: timed out stopping %s\n' "$name" >&2
  return 1
}

export DATABASE_URL
export RH_TESTNET_RPC_URL="$LOCAL_RPC"
export API_PORT=4000
export API_HOST=127.0.0.1
export WEB_ORIGIN="$WEB_URL"

anvil --host 127.0.0.1 --port 8545 --chain-id 46630 >"$LOG_DIR/anvil.log" 2>&1 &
ANVIL_PID=$!
wait_for "local Anvil chain 46630" "cast chain-id --rpc-url '$LOCAL_RPC' | grep -qx 46630"
wait_for "Anvil development key" "grep -q '^Private Keys' \"$LOG_DIR/anvil.log\""

# Read the ephemeral key printed by the local Anvil process; never store a key in source.
ANVIL_KEY="$(grep -A10 '^Private Keys' "$LOG_DIR/anvil.log" | grep -m1 -Eo '0x[a-fA-F0-9]{64}')"
if [[ ! "$ANVIL_KEY" =~ ^0x[a-fA-F0-9]{64}$ ]]; then echo "ERROR: local Anvil key was not found" >&2; exit 1; fi
export DEPLOYER_PRIVATE_KEY="$ANVIL_KEY"
export PROTOCOL_FEE_RECIPIENT="$LOCAL_ADDRESS"
forge script contracts/script/DeployTestnet.s.sol:DeployTestnet --rpc-url "$LOCAL_RPC" --broadcast -vvv >"$LOG_DIR/deploy.log" 2>&1
FACTORY_ADDRESS="$(grep -Eo 'LaunchpadFactory:?[[:space:]]+0x[a-fA-F0-9]{40}' "$LOG_DIR/deploy.log" | tail -n 1 | awk '{print $2}')"
if [[ ! "$FACTORY_ADDRESS" =~ ^0x[a-fA-F0-9]{40}$ ]]; then
  cat "$LOG_DIR/deploy.log" >&2
  echo "ERROR: local factory address not found in deployment output" >&2
  exit 1
fi
BROADCAST_FILE="broadcast/DeployTestnet.s.sol/46630/run-latest.json"
DEPLOY_GAS_HEX="$(jq -r --arg addr "$FACTORY_ADDRESS" '.receipts[] | select((.contractAddress // "" | ascii_downcase) == ($addr | ascii_downcase)) | .gasUsed' "$BROADCAST_FILE" | tail -n 1)"
if [[ -z "$DEPLOY_GAS_HEX" || "$DEPLOY_GAS_HEX" == "null" ]]; then
  echo "ERROR: factory deployment receipt gas was not found in $BROADCAST_FILE" >&2
  exit 1
fi
DEPLOY_BLOCK=1
export LAUNCHPAD_FACTORY_ADDRESS="$FACTORY_ADDRESS"
export INDEXER_START_BLOCK="$DEPLOY_BLOCK"
export INDEXER_CONFIRMATIONS=0
export INDEXER_BATCH_SIZE=100

# A bounded retry makes database readiness failures explicit instead of silently skipping E2E.
migration_ok=false
for _ in $(seq 1 30); do
  if pnpm --filter @micow/api db:migrate >"$LOG_DIR/migrate.log" 2>&1; then
    migration_ok=true
    break
  fi
  sleep 2
done
if [[ "$migration_ok" != true ]]; then
  cat "$LOG_DIR/migrate.log" >&2
  echo "ERROR: database migration failed" >&2
  exit 1
fi
# Reapplying migrations verifies startup is safe after an interrupted/retried bootstrap.
pnpm --filter @micow/api db:migrate >"$LOG_DIR/migrate-repeat.log" 2>&1

(cd apps/api && ./node_modules/.bin/tsx src/server.ts) >"$LOG_DIR/api.log" 2>&1 &
API_PID=$!
start_indexer
export NEXT_PUBLIC_LAUNCHPAD_FACTORY_ADDRESS="$FACTORY_ADDRESS"
export NEXT_PUBLIC_ROBINHOOD_RPC_URL="$LOCAL_RPC"
(cd apps/web && ./node_modules/.bin/next dev) >"$LOG_DIR/web.log" 2>&1 &
WEB_PID=$!

wait_for "API health" "curl -fsS '$API_URL/health'"
wait_for "web server" "curl -fsS '$WEB_URL' | grep -q 'Launch ideas'"

CREATE_RECEIPT="$(cast send "$FACTORY_ADDRESS" 'createToken(string,string,string)' 'P5 E2E Token' 'P5E2E' 'ipfs://p5-e2e' --value 0.0006ether --private-key "$ANVIL_KEY" --rpc-url "$LOCAL_RPC" --json)"
CREATE_GAS_HEX="$(printf '%s' "$CREATE_RECEIPT" | jq -r '.gasUsed')"
TOKEN_ADDRESS="$(printf '%s' "$CREATE_RECEIPT" | jq -r '[.logs[] | select((.topics | length) >= 4)][0].topics[2] | "0x" + .[26:]')"
MARKET_ADDRESS="$(printf '%s' "$CREATE_RECEIPT" | jq -r '[.logs[] | select((.topics | length) >= 4)][0].topics[3] | "0x" + .[26:]')"
if [[ ! "$TOKEN_ADDRESS" =~ ^0x[a-fA-F0-9]{40}$ || ! "$MARKET_ADDRESS" =~ ^0x[a-fA-F0-9]{40}$ ]]; then
  printf '%s\n' "$CREATE_RECEIPT" >&2
  echo "ERROR: TokenCreated addresses could not be parsed from local receipt" >&2
  exit 1
fi

DEADLINE=4102444800
cast send "$MARKET_ADDRESS" 'buy(uint256,uint256)' 0 "$DEADLINE" --value 0.1ether --private-key "$ANVIL_KEY" --rpc-url "$LOCAL_RPC" --json >"$LOG_DIR/buy.json"
cast send "$TOKEN_ADDRESS" 'approve(address,uint256)' "$MARKET_ADDRESS" 1000000000000000000000000 --private-key "$ANVIL_KEY" --rpc-url "$LOCAL_RPC" --json >"$LOG_DIR/approve.json"
cast send "$MARKET_ADDRESS" 'sell(uint256,uint256,uint256)' 1000000000000000000000000 0 "$DEADLINE" --private-key "$ANVIL_KEY" --rpc-url "$LOCAL_RPC" --json >"$LOG_DIR/sell.json"
BUY_GAS_HEX="$(jq -r '.gasUsed' "$LOG_DIR/buy.json")"
SELL_GAS_HEX="$(jq -r '.gasUsed' "$LOG_DIR/sell.json")"

tokens_json=""
trades_json=""
for _ in $(seq 1 60); do
  tokens_json="$(curl -fsS "$API_URL/v1/tokens?limit=100&offset=0" 2>/dev/null || true)"
  if printf '%s' "$tokens_json" | jq -e --arg token "$TOKEN_ADDRESS" '[.items[] | select((.token_address | ascii_downcase) == ($token | ascii_downcase) and .symbol == "P5E2E")] | length == 1' >/dev/null 2>&1; then
    trades_json="$(curl -fsS "$API_URL/v1/tokens/$TOKEN_ADDRESS/trades?limit=10&offset=0" 2>/dev/null || true)"
    if printf '%s' "$trades_json" | jq -e '.items | length == 2 and (map(.side) | sort == ["buy","sell"])' >/dev/null 2>&1; then
      break
    fi
  fi
  sleep 2
done

printf '%s' "$tokens_json" | jq -e --arg token "$TOKEN_ADDRESS" '[.items[] | select((.token_address | ascii_downcase) == ($token | ascii_downcase) and .symbol == "P5E2E")] | length == 1' >/dev/null
printf '%s' "$trades_json" | jq -e '.items | length == 2 and (map(.side) | sort == ["buy","sell"])' >/dev/null

# Record the durable checkpoint, stop the indexer, rerun migrations, and resume from PostgreSQL.
CHECKPOINT_BEFORE="$(curl -fsS "$API_URL/ready" | jq -r '.indexedThrough')"
if [[ -z "$CHECKPOINT_BEFORE" || "$CHECKPOINT_BEFORE" == "null" ]]; then
  echo "ERROR: indexer did not persist a durable checkpoint" >&2
  exit 1
fi
stop_process "indexer" "$INDEXER_PID" "$LOG_DIR/indexer-${INDEXER_RUN}.log"
INDEXER_PID=""
pnpm --filter @micow/api db:migrate >"$LOG_DIR/migrate-after-restart.log" 2>&1
INDEXER_RUN=2
start_indexer
wait_for "indexer checkpoint resume" "curl -fsS '$API_URL/ready' | jq -e --arg checkpoint '$CHECKPOINT_BEFORE' '.indexedThrough == \\$checkpoint'"
trades_json="$(curl -fsS "$API_URL/v1/tokens/$TOKEN_ADDRESS/trades?limit=10&offset=0")"
printf '%s' "$trades_json" | jq -e '.items | length == 2 and (map(.side) | sort == ["buy","sell"])' >/dev/null

# Generate a second buy/sell after restart to prove the resumed worker continues indexing.
cast send "$MARKET_ADDRESS" 'buy(uint256,uint256)' 0 "$DEADLINE" --value 0.1ether --private-key "$ANVIL_KEY" --rpc-url "$LOCAL_RPC" --json >"$LOG_DIR/buy-after-restart.json"
cast send "$TOKEN_ADDRESS" 'approve(address,uint256)' "$MARKET_ADDRESS" 1000000000000000000000000 --private-key "$ANVIL_KEY" --rpc-url "$LOCAL_RPC" --json >"$LOG_DIR/approve-after-restart.json"
cast send "$MARKET_ADDRESS" 'sell(uint256,uint256,uint256)' 1000000000000000000000000 0 "$DEADLINE" --private-key "$ANVIL_KEY" --rpc-url "$LOCAL_RPC" --json >"$LOG_DIR/sell-after-restart.json"

# Measure fee withdrawals from mined local Anvil receipts as well.
cast send "$MARKET_ADDRESS" 'withdrawFees()' --private-key "$ANVIL_KEY" --rpc-url "$LOCAL_RPC" --json >"$LOG_DIR/market-fee-withdrawal.json"
cast send "$FACTORY_ADDRESS" 'withdrawTreasuryFees()' --private-key "$ANVIL_KEY" --rpc-url "$LOCAL_RPC" --json >"$LOG_DIR/treasury-fee-withdrawal.json"
MARKET_WITHDRAW_GAS_HEX="$(jq -r '.gasUsed' "$LOG_DIR/market-fee-withdrawal.json")"
TREASURY_WITHDRAW_GAS_HEX="$(jq -r '.gasUsed' "$LOG_DIR/treasury-fee-withdrawal.json")"

for _ in $(seq 1 60); do
  trades_json="$(curl -fsS "$API_URL/v1/tokens/$TOKEN_ADDRESS/trades?limit=10&offset=0" 2>/dev/null || true)"
  if printf '%s' "$trades_json" | jq -e '.items | length == 4 and (map(.side) | sort == ["buy","buy","sell","sell"])' >/dev/null 2>&1; then break; fi
  sleep 2
done
printf '%s' "$trades_json" | jq -e '.items | length == 4 and (map(.side) | sort == ["buy","buy","sell","sell"])' >/dev/null

# Verify event/projection counts after restart and ensure replay did not duplicate existing trades.
E2E_TOKEN_ADDRESS="$TOKEN_ADDRESS" pnpm --filter @micow/api exec node --input-type=module -e '
import { Pool } from "pg";
const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 1 });
try {
  const token = process.env.E2E_TOKEN_ADDRESS;
  const result = await pool.query(
    "SELECT (SELECT COUNT(*) FROM tokens WHERE chain_id=46630 AND lower(token_address)=lower($1)) AS token_count, (SELECT COUNT(*) FROM trades WHERE chain_id=46630 AND lower(token_address)=lower($1)) AS trade_count, (SELECT COUNT(*) FROM indexed_events WHERE chain_id=46630 AND event_name IN (\x27TokenCreated\x27,\x27Buy\x27,\x27Sell\x27)) AS event_count",
    [token],
  );
  const row = result.rows[0];
  if (Number(row.token_count) !== 1 || Number(row.trade_count) !== 4 || Number(row.event_count) < 5) {
    throw new Error("projection mismatch after restart: " + JSON.stringify(row));
  }
  console.log("PASS: database event/projection counts after restart", row);
} finally {
  await pool.end();
}
'

stop_process "indexer" "$INDEXER_PID" "$LOG_DIR/indexer-${INDEXER_RUN}.log"
INDEXER_PID=""
stop_process "API" "$API_PID" "$LOG_DIR/api.log"
API_PID=""
stop_process "web" "$WEB_PID" "$LOG_DIR/web.log"
WEB_PID=""

echo "GAS_BASELINE_LOCAL_ANVIL chain_id=46630 solc=0.8.28 optimizer=true optimizer_runs=200 evm_version=cancun"
echo "gas.factory_deployment=$(decimal_gas "$DEPLOY_GAS_HEX")"
echo "gas.token_creation_including_token_and_market=$(decimal_gas "$CREATE_GAS_HEX")"
echo "gas.buy=$(decimal_gas "$BUY_GAS_HEX")"
echo "gas.sell=$(decimal_gas "$SELL_GAS_HEX")"
echo "gas.market_fee_withdrawal=$(decimal_gas "$MARKET_WITHDRAW_GAS_HEX")"
echo "gas.treasury_creation_fee_withdrawal=$(decimal_gas "$TREASURY_WITHDRAW_GAS_HEX")"
echo "PASS: local chain 46630, create/buy/sell, API/web readiness, migration reapply, durable indexer restart/resume, and clean service shutdown"
echo "factory=$FACTORY_ADDRESS token=$TOKEN_ADDRESS market=$MARKET_ADDRESS checkpoint=$CHECKPOINT_BEFORE"
