import dotenv from "dotenv";
import { Pool, type PoolClient } from "pg";
import { createPublicClient, decodeEventLog, defineChain, http, parseAbi, toEventSelector, type Address, type Hex } from "viem";
import { eventIdentity, findCommonAncestor, type StoredBlock } from "./reorg.js";
import { insertIndexedEvent, rollbackAfter } from "./store.js";

dotenv.config({ path: process.env.DOTENV_CONFIG_PATH ?? "../../.env" });
type IndexedLog = {
  transactionHash: Hex | null;
  logIndex: number | null;
  blockNumber: bigint | null;
  topics: readonly Hex[];
  data: Hex;
  address: Address;
};

const rpcUrl = process.env.RH_TESTNET_RPC_URL ?? "https://rpc.testnet.chain.robinhood.com";
const chain = defineChain({
  id: 46630,
  name: "Robinhood Chain Testnet",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [rpcUrl] } },
  testnet: true,
});
const factoryAddress = process.env.LAUNCHPAD_FACTORY_ADDRESS as Address | undefined;
const startBlockValue = process.env.INDEXER_START_BLOCK?.trim();
const startBlock = startBlockValue ? Number(startBlockValue) : Number.NaN;
const confirmations = Number(process.env.INDEXER_CONFIRMATIONS ?? 2);
const batchSize = Number(process.env.INDEXER_BATCH_SIZE ?? 100);
const chainId = 46630;
const eventAbi = parseAbi([
  "event TokenCreated(address indexed creator,address indexed token,address indexed market,string name,string symbol,uint256 totalSupply,string metadataURI)",
  "event Buy(address indexed buyer,uint256 ethIn,uint256 tokensOut,uint256 protocolFee,uint256 creatorFee)",
  "event Sell(address indexed seller,uint256 tokensIn,uint256 ethOut,uint256 protocolFee,uint256 creatorFee)",
]);
const eventTopics = eventAbi.map((event) => toEventSelector(event));
const tokenCreatedTopic = eventTopics[0]?.toLowerCase();
const buyTopic = eventTopics[1]?.toLowerCase();
const sellTopic = eventTopics[2]?.toLowerCase();
const client = createPublicClient({ chain, transport: http(rpcUrl), pollingInterval: 4_000 });
const pool = new Pool({
  connectionString: process.env.DATABASE_URL ?? "postgresql://micow:micow@localhost:5432/micow",
  max: 5,
  connectionTimeoutMillis: 3_000,
});

async function repairReorg(): Promise<void> {
  const last = await pool.query("SELECT block_number::text, block_hash FROM indexed_blocks WHERE chain_id = $1 ORDER BY block_number DESC LIMIT 1", [chainId]);
  if (last.rowCount === 0) return;
  const latestNumber = BigInt(last.rows[0].block_number);
  const remote = await client.getBlock({ blockNumber: latestNumber });
  if (remote.hash.toLowerCase() === String(last.rows[0].block_hash).toLowerCase()) return;
  const storedResult = await pool.query("SELECT block_number::text, block_hash FROM indexed_blocks WHERE chain_id = $1 ORDER BY block_number DESC LIMIT 10000", [chainId]);
  const stored: StoredBlock[] = storedResult.rows.map((row: { block_number: string; block_hash: string }) => ({
    number: BigInt(row.block_number),
    hash: String(row.block_hash),
  }));
  const ancestor = await findCommonAncestor(stored, async (number) => {
    try { return (await client.getBlock({ blockNumber: number })).hash; }
    catch { return null; }
  });
  const rollbackPoint = ancestor ?? BigInt(startBlock) - 1n;
  await rollbackAfter(pool, chainId, rollbackPoint);
  console.warn("Reorg rollback completed at block " + rollbackPoint.toString());
}

async function persistBlock(blockNumber: bigint, blockHash: Hex, parentHash: Hex, logs: readonly IndexedLog[]): Promise<void> {
  const db: PoolClient = await pool.connect();
  try {
    await db.query("BEGIN");
    for (const log of logs) {
      if (!log.transactionHash || log.logIndex === null) continue;
      const topic0 = String(log.topics[0] ?? "").toLowerCase();
      if (topic0 === tokenCreatedTopic && log.address.toLowerCase() !== String(factoryAddress).toLowerCase()) continue;
      if (topic0 !== tokenCreatedTopic && topic0 !== buyTopic && topic0 !== sellTopic) continue;

      let tokenAddress = "";
      if (topic0 === buyTopic || topic0 === sellTopic) {
        const token = await db.query(
          "SELECT token_address FROM tokens WHERE chain_id = $1 AND lower(market_address) = lower($2)",
          [chainId, log.address],
        );
        if (token.rowCount === 0) continue;
        tokenAddress = String(token.rows[0].token_address);
      }

      const decoded = decodeEventLog({
        abi: eventAbi,
        data: log.data,
        topics: log.topics as [Hex, ...Hex[]],
        strict: false,
      }) as unknown as { eventName: string; args: Record<string, unknown> };
      const args = decoded.args;
      const identity = eventIdentity(chainId, log.transactionHash, log.logIndex);
      const inserted = await insertIndexedEvent(db, {
        chainId,
        eventId: identity,
        txHash: log.transactionHash,
        logIndex: log.logIndex,
        blockNumber,
        blockHash,
        contractAddress: log.address,
        topic0,
        topics: log.topics,
        data: log.data,
        eventName: decoded.eventName,
        payload: args,
      });
      if (!inserted) continue;

      if (decoded.eventName === "TokenCreated") {
        await db.query(
          "INSERT INTO tokens (chain_id, token_address, market_address, creator_address, name, symbol, total_supply, metadata_uri, created_block) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) ON CONFLICT (chain_id, token_address) DO NOTHING",
          [chainId, args.token, args.market, args.creator, args.name, args.symbol, String(args.totalSupply), args.metadataURI, blockNumber.toString()],
        );
      } else if (decoded.eventName === "Buy" || decoded.eventName === "Sell") {
        const isBuy = decoded.eventName === "Buy";
        await db.query(
          "INSERT INTO trades (chain_id, tx_hash, log_index, token_address, market_address, side, trader_address, amount_in, amount_out, protocol_fee, creator_fee, block_number, block_hash) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) ON CONFLICT (chain_id, tx_hash, log_index) DO NOTHING",
          [chainId, log.transactionHash, log.logIndex, tokenAddress, log.address, isBuy ? "buy" : "sell",
            isBuy ? args.buyer : args.seller, String(isBuy ? args.ethIn : args.tokensIn),
            String(isBuy ? args.tokensOut : args.ethOut), String(args.protocolFee), String(args.creatorFee),
            blockNumber.toString(), blockHash],
        );
      }
    }
    await db.query("INSERT INTO indexed_blocks (chain_id, block_number, block_hash, parent_hash) VALUES ($1,$2,$3,$4) ON CONFLICT (chain_id, block_number) DO UPDATE SET block_hash = EXCLUDED.block_hash, parent_hash = EXCLUDED.parent_hash", [chainId, blockNumber.toString(), blockHash, parentHash]);
    await db.query("COMMIT");
  } catch (error) {
    await db.query("ROLLBACK");
    throw error;
  } finally {
    db.release();
  }
}

async function syncOnce(): Promise<void> {
  await repairReorg();
  const last = await pool.query("SELECT MAX(block_number)::text AS block_number FROM indexed_blocks WHERE chain_id = $1", [chainId]);
  const nextBlock = last.rows[0]?.block_number === null || last.rows[0]?.block_number === undefined
    ? BigInt(startBlock)
    : BigInt(last.rows[0].block_number) + 1n;
  const head = await client.getBlockNumber();
  const safeHead = head - BigInt(confirmations);
  if (safeHead < nextBlock) return;
  const proposedEnd = nextBlock + BigInt(batchSize - 1);
  const endBlock = proposedEnd < safeHead ? proposedEnd : safeHead;
  const logs = await client.getLogs({ fromBlock: nextBlock, toBlock: endBlock });
  const byBlock = new Map<string, IndexedLog[]>();
  for (const log of logs as readonly IndexedLog[]) {
    const key = String(log.blockNumber);
    byBlock.set(key, [...(byBlock.get(key) ?? []), log]);
  }
  for (let number = nextBlock; number <= endBlock; number += 1n) {
    const block = await client.getBlock({ blockNumber: number });
    const blockLogs = (byBlock.get(number.toString()) ?? []).slice().sort((a, b) => Number(a.logIndex) - Number(b.logIndex));
    await persistBlock(number, block.hash, block.parentHash, blockLogs);
  }
  console.info("Indexed blocks " + nextBlock.toString() + " through " + endBlock.toString());
}

let running = true;
process.on("SIGINT", () => { running = false; });
process.on("SIGTERM", () => { running = false; });

async function main(): Promise<void> {
  if (!factoryAddress || !/^0x[a-fA-F0-9]{40}$/.test(factoryAddress)) throw new Error("LAUNCHPAD_FACTORY_ADDRESS must be a valid deployed factory address");
  if (!Number.isSafeInteger(startBlock) || startBlock < 0) throw new Error("INDEXER_START_BLOCK must be set to the factory deployment block");
  if (!Number.isSafeInteger(batchSize) || batchSize < 1 || batchSize > 500) throw new Error("INDEXER_BATCH_SIZE must be between 1 and 500");
  if (!Number.isSafeInteger(confirmations) || confirmations < 0 || confirmations > 100) throw new Error("INDEXER_CONFIRMATIONS must be between 0 and 100");
  const actualChainId = await client.getChainId();
  if (actualChainId !== chainId) throw new Error("Wrong RPC chain id: expected 46630, got " + actualChainId);
  console.info("MICOW indexer started on chain " + chainId + " with factory " + factoryAddress);
  while (running) {
    try { await syncOnce(); }
    catch (error) { console.error("Indexer cycle failed; retrying without advancing a failed checkpoint.", error); }
    if (running) await new Promise((resolve) => setTimeout(resolve, 4_000));
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
}).finally(async () => {
  await pool.end();
});
