import dotenv from "dotenv";
import { Pool } from "pg";
import { createPublicClient, defineChain, http, type Address, parseAbi } from "viem";
import { withRpcRetry } from "./retry.js";
import { reconcileTokenRegistry, type IndexedTokenRecord, type RegistryMismatch } from "./reconciliation.js";

dotenv.config({ path: process.env.DOTENV_CONFIG_PATH ?? "../../.env" });

const chainId = 46630;
const rpcUrl = process.env.RH_TESTNET_RPC_URL ?? "https://rpc.testnet.chain.robinhood.com";
const factoryAddress = process.env.LAUNCHPAD_FACTORY_ADDRESS as Address | undefined;
const databaseUrl = process.env.DATABASE_URL ?? "postgresql://micow:micow@localhost:5432/micow";
const pageSize = 100;
const chain = defineChain({
  id: chainId,
  name: "Robinhood Chain Testnet",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [rpcUrl] } },
  testnet: true,
});
const client = createPublicClient({ chain, transport: http(rpcUrl, { timeout: 10_000, retryCount: 0 }) });
const pool = new Pool({ connectionString: databaseUrl, max: 4, connectionTimeoutMillis: 3_000 });
const factoryAbi = parseAbi(["function marketForToken(address token) view returns (address)"]);
const marketAbi = parseAbi(["function token() view returns (address)"]);

async function retryRead<T>(operation: () => Promise<T>): Promise<T> {
  return withRpcRetry(operation, {
    attempts: 3,
    initialDelayMs: 500,
    maxDelayMs: 4_000,
    onRetry: (_error, attempt) => console.warn("Reconciliation RPC read retry " + attempt.toString()),
  });
}

async function loadProjectionDrift(): Promise<{ missingProjection: string[]; orphanProjection: string[]; marketMismatches: string[] }> {
  const missing = await pool.query(
    "SELECT e.payload->>'token' AS token_address FROM indexed_events e LEFT JOIN tokens t ON t.chain_id = e.chain_id AND lower(t.token_address) = lower(e.payload->>'token') WHERE e.chain_id = $1 AND e.event_name = 'TokenCreated' AND (t.token_address IS NULL OR lower(t.market_address) <> lower(e.payload->>'market')) LIMIT 100",
    [chainId],
  );
  const orphaned = await pool.query(
    "SELECT t.token_address FROM tokens t WHERE t.chain_id = $1 AND NOT EXISTS (SELECT 1 FROM indexed_events e WHERE e.chain_id = t.chain_id AND e.event_name = 'TokenCreated' AND lower(e.payload->>'token') = lower(t.token_address)) LIMIT 100",
    [chainId],
  );
  const marketMismatch = await pool.query(
    "SELECT t.token_address FROM tokens t JOIN indexed_events e ON e.chain_id = t.chain_id AND e.event_name = 'TokenCreated' AND lower(e.payload->>'token') = lower(t.token_address) WHERE t.chain_id = $1 AND lower(t.market_address) <> lower(e.payload->>'market') LIMIT 100",
    [chainId],
  );
  return {
    missingProjection: missing.rows.map((row: { token_address: string | null }) => String(row.token_address ?? "<unknown>")),
    orphanProjection: orphaned.rows.map((row: { token_address: string }) => row.token_address),
    marketMismatches: marketMismatch.rows.map((row: { token_address: string }) => row.token_address),
  };
}

async function reconcileIndexedTokens(): Promise<{ checked: number; mismatches: RegistryMismatch[] }> {
  let cursor = "";
  let checked = 0;
  const mismatches: RegistryMismatch[] = [];

  for (;;) {
    const result = await pool.query(
      "SELECT token_address, market_address FROM tokens WHERE chain_id = $1 AND token_address > $2 ORDER BY token_address LIMIT $3",
      [chainId, cursor, pageSize],
    );
    if (result.rows.length === 0) break;

    const records = (result.rows as { token_address: string; market_address: string }[]).map(
      (row): IndexedTokenRecord => ({ tokenAddress: row.token_address, marketAddress: row.market_address }),
    );
    mismatches.push(...await reconcileTokenRegistry(records, {
      readFactoryMarket: async (tokenAddress) => retryRead(() => client.readContract({
        address: factoryAddress as Address,
        abi: factoryAbi,
        functionName: "marketForToken",
        args: [tokenAddress as Address],
      })),
      readMarketToken: async (marketAddress) => retryRead(() => client.readContract({
        address: marketAddress as Address,
        abi: marketAbi,
        functionName: "token",
      })),
    }));

    checked += records.length;
    cursor = String(result.rows[result.rows.length - 1].token_address);
    if (result.rows.length < pageSize) break;
  }

  return { checked, mismatches };
}

async function main(): Promise<void> {
  if (!factoryAddress || !/^0x[a-fA-F0-9]{40}$/.test(factoryAddress)) {
    throw new Error("LAUNCHPAD_FACTORY_ADDRESS must be a valid deployed factory address");
  }
  const actualChainId = await retryRead(() => client.getChainId());
  if (actualChainId !== chainId) throw new Error("Wrong RPC chain ID: expected " + chainId.toString() + ", got " + actualChainId.toString());

  const projectionDrift = await loadProjectionDrift();
  const registry = await reconcileIndexedTokens();
  const driftFound = Object.values(projectionDrift).some((items) => items.length > 0) || registry.mismatches.length > 0;
  const report = {
    chainId,
    factoryAddress,
    indexedTokensChecked: registry.checked,
    projectionDrift,
    registryMismatches: registry.mismatches,
    status: driftFound ? "DRIFT_DETECTED" : "CLEAN",
  };
  console.info(JSON.stringify(report, null, 2));
  if (driftFound) process.exitCode = 1;
}

main()
  .catch((error: unknown) => {
    console.error("Reconciliation failed:", error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
