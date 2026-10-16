import type { Pool, PoolClient } from "pg";

export type IndexedEventRecord = {
  chainId: number;
  eventId: string;
  txHash: string;
  logIndex: number;
  blockNumber: bigint;
  blockHash: string;
  contractAddress: string;
  topic0: string;
  topics: readonly string[];
  data: string;
  eventName: string;
  payload: unknown;
};


export async function inTransaction<T>(db: PoolClient, operation: () => Promise<T>): Promise<T> {
  await db.query("BEGIN");
  try {
    const result = await operation();
    await db.query("COMMIT");
    return result;
  } catch (error) {
    await db.query("ROLLBACK");
    throw error;
  }
}

export async function getNextBlock(
  pool: Pick<Pool, "query">,
  chainId: number,
  startBlock: bigint,
): Promise<bigint> {
  const result = await pool.query(
    "SELECT MAX(block_number)::text AS block_number FROM indexed_blocks WHERE chain_id = $1",
    [chainId],
  );
  const lastBlock = result.rows[0]?.block_number as string | null | undefined;
  return lastBlock === null || lastBlock === undefined ? startBlock : BigInt(lastBlock) + 1n;
}

function serialize(value: unknown): string {
  return JSON.stringify(value, (_key, item: unknown) => typeof item === "bigint" ? item.toString() : item) ?? "null";
}

export async function insertIndexedEvent(
  db: Pick<PoolClient, "query">,
  event: IndexedEventRecord,
): Promise<boolean> {
  const result = await db.query(
    "INSERT INTO indexed_events (chain_id, event_id, tx_hash, log_index, block_number, block_hash, contract_address, topic0, topics, data, event_name, payload) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11,$12::jsonb) ON CONFLICT (chain_id, tx_hash, log_index) DO NOTHING RETURNING event_id",
    [
      event.chainId,
      event.eventId,
      event.txHash,
      event.logIndex,
      event.blockNumber.toString(),
      event.blockHash,
      event.contractAddress,
      event.topic0,
      serialize(event.topics),
      event.data,
      event.eventName,
      serialize(event.payload),
    ],
  );
  return result.rowCount === 1;
}

export async function rollbackAfter(
  pool: Pick<Pool, "connect">,
  chainId: number,
  ancestor: bigint,
): Promise<void> {
  const db = await pool.connect();
  try {
    await inTransaction(db, async () => {
      await db.query("DELETE FROM trades WHERE chain_id = $1 AND block_number > $2", [chainId, ancestor.toString()]);
      await db.query("DELETE FROM tokens WHERE chain_id = $1 AND created_block > $2", [chainId, ancestor.toString()]);
      await db.query("DELETE FROM indexed_events WHERE chain_id = $1 AND block_number > $2", [chainId, ancestor.toString()]);
      await db.query("DELETE FROM indexed_blocks WHERE chain_id = $1 AND block_number > $2", [chainId, ancestor.toString()]);
    });
  } finally {
    db.release();
  }
}
