import { readFile } from "node:fs/promises";
import { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eventIdentity } from "./reorg.js";
import { getNextBlock, inTransaction, insertIndexedEvent, rollbackAfter } from "./store.js";

const databaseUrl = process.env.TEST_DATABASE_URL;
const integrationDescribe = describe.skipIf(!databaseUrl);

integrationDescribe("PostgreSQL indexer persistence", () => {
  let pool: Pool;

  beforeAll(async () => {
    pool = new Pool({ connectionString: databaseUrl });
    const migration = await readFile(
      new URL("../../../packages/database/migrations/001_init.sql", import.meta.url),
      "utf8",
    );
    await pool.query(migration);
  });

  beforeEach(async () => {
    await pool.query("TRUNCATE trades, tokens, indexed_events, indexed_blocks");
  });

  afterAll(async () => {
    await pool?.end();
  });

  it("resumes from the first uncommitted block after a worker restart", async () => {
    expect(await getNextBlock(pool, 46630, 7n)).toBe(7n);
    await pool.query(
      "INSERT INTO indexed_blocks (chain_id, block_number, block_hash, parent_hash) VALUES ($1, 7, $2, $3), ($1, 8, $4, $2)",
      [46630, "0xblock7", "0xblock6", "0xblock8"],
    );
    // A restarted process has only the durable database checkpoint to resume from.
    expect(await getNextBlock(pool, 46630, 7n)).toBe(9n);
  });

  it("inserts the same event idempotently", async () => {
    const event = {
      chainId: 46630,
      eventId: eventIdentity(46630, "0xABC1", 0),
      txHash: "0xABC1",
      logIndex: 0,
      blockNumber: 10n,
      blockHash: "0xblock10",
      contractAddress: "0x0000000000000000000000000000000000000001",
      topic0: "0xtopic",
      topics: ["0xtopic"],
      data: "0x",
      eventName: "TokenCreated",
      payload: { token: "0x0000000000000000000000000000000000000002" },
    };

    const db = await pool.connect();
    try {
      await db.query("BEGIN");
      expect(await insertIndexedEvent(db, event)).toBe(true);
      expect(await insertIndexedEvent(db, event)).toBe(false);
      await db.query("COMMIT");
    } catch (error) {
      await db.query("ROLLBACK");
      throw error;
    } finally {
      db.release();
    }

    const result = await pool.query("SELECT COUNT(*)::int AS count FROM indexed_events WHERE chain_id = $1", [46630]);
    expect(result.rows[0]?.count).toBe(1);
  });

  it("rolls back orphaned projections and permits canonical replay after a reorg", async () => {
    await pool.query(
      "INSERT INTO indexed_blocks (chain_id, block_number, block_hash, parent_hash) VALUES ($1, 9, $2, $3), ($1, 10, $4, $2)",
      [46630, "0xblock9", "0xblock8", "0xorphan10"],
    );

    const canonicalEvent = {
      chainId: 46630,
      eventId: eventIdentity(46630, "0xcanonical", 0),
      txHash: "0xcanonical",
      logIndex: 0,
      blockNumber: 9n,
      blockHash: "0xblock9",
      contractAddress: "0x0000000000000000000000000000000000000001",
      topic0: "0xtopic",
      topics: ["0xtopic"],
      data: "0x",
      eventName: "TokenCreated",
      payload: { token: "0x0000000000000000000000000000000000000002" },
    };
    const orphanEvent = {
      ...canonicalEvent,
      eventId: eventIdentity(46630, "0xorphan", 1),
      txHash: "0xorphan",
      logIndex: 1,
      blockNumber: 10n,
      blockHash: "0xorphan10",
      payload: { token: "0x0000000000000000000000000000000000000003" },
    };
    const db = await pool.connect();
    try {
      await db.query("BEGIN");
      await insertIndexedEvent(db, canonicalEvent);
      await insertIndexedEvent(db, orphanEvent);
      await db.query(
        "INSERT INTO tokens (chain_id, token_address, market_address, creator_address, name, symbol, total_supply, metadata_uri, created_block) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)",
        [46630, "0x0000000000000000000000000000000000000003", "0x0000000000000000000000000000000000000004", "0x0000000000000000000000000000000000000005", "Orphan", "ORPH", "1000", "ipfs://orphan", 10],
      );
      await db.query(
        "INSERT INTO trades (chain_id, tx_hash, log_index, token_address, market_address, side, trader_address, amount_in, amount_out, protocol_fee, creator_fee, block_number, block_hash) VALUES ($1,$2,$3,$4,$5,'buy',$6,$7,$8,$9,$10,$11,$12)",
        [46630, "0xorphan", 1, "0x0000000000000000000000000000000000000003", "0x0000000000000000000000000000000000000004", "0x0000000000000000000000000000000000000006", "100", "200", "1", "1", 10, "0xorphan10"],
      );
      await db.query("COMMIT");
    } catch (error) {
      await db.query("ROLLBACK");
      throw error;
    } finally {
      db.release();
    }

    await rollbackAfter(pool, 46630, 9n);

    const blockCount = await pool.query("SELECT COUNT(*)::int AS count FROM indexed_blocks WHERE chain_id = $1", [46630]);
    const eventCount = await pool.query("SELECT COUNT(*)::int AS count FROM indexed_events WHERE chain_id = $1", [46630]);
    const tokenCount = await pool.query("SELECT COUNT(*)::int AS count FROM tokens WHERE chain_id = $1", [46630]);
    const tradeCount = await pool.query("SELECT COUNT(*)::int AS count FROM trades WHERE chain_id = $1", [46630]);
    expect(blockCount.rows[0]?.count).toBe(1);
    expect(eventCount.rows[0]?.count).toBe(1);
    expect(tokenCount.rows[0]?.count).toBe(0);
    expect(tradeCount.rows[0]?.count).toBe(0);

    const replayed = {
      ...orphanEvent,
      blockNumber: 11n,
      blockHash: "0xcanonical11",
    };
    const replayDb = await pool.connect();
    try {
      await replayDb.query("BEGIN");
      expect(await insertIndexedEvent(replayDb, replayed)).toBe(true);
      await replayDb.query("COMMIT");
    } catch (error) {
      await replayDb.query("ROLLBACK");
      throw error;
    } finally {
      replayDb.release();
    }

    const replay = await pool.query(
      "SELECT block_number::text, block_hash FROM indexed_events WHERE chain_id = $1 AND tx_hash = $2 AND log_index = $3",
      [46630, "0xorphan", 1],
    );
    expect(replay.rows[0]).toMatchObject({ block_number: "11", block_hash: "0xcanonical11" });
  });

  it("rolls back event and checkpoint writes when a projection violates a database invariant", async () => {
    const db = await pool.connect();
    try {
      await expect(inTransaction(db, async () => {
        await insertIndexedEvent(db, {
          chainId: 46630,
          eventId: eventIdentity(46630, "0xatomic-failure", 0),
          txHash: "0xatomic-failure",
          logIndex: 0,
          blockNumber: 20n,
          blockHash: "0xblock20",
          contractAddress: "0x0000000000000000000000000000000000000001",
          topic0: "0xtopic",
          topics: ["0xtopic"],
          data: "0x",
          eventName: "TokenCreated",
          payload: { token: "0x0000000000000000000000000000000000000002" },
        });
        await db.query(
          "INSERT INTO indexed_blocks (chain_id, block_number, block_hash, parent_hash) VALUES ($1,$2,$3,$4)",
          [46630, 20, "0xblock20", "0xblock19"],
        );
        await db.query(
          "INSERT INTO trades (chain_id, tx_hash, log_index, token_address, market_address, side, trader_address, amount_in, amount_out, protocol_fee, creator_fee, block_number, block_hash) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)",
          [46630, "0xatomic-failure", 1, "0x0000000000000000000000000000000000000002", "0x0000000000000000000000000000000000000003", "invalid-side", "0x0000000000000000000000000000000000000004", "1", "1", "0", "0", 20, "0xblock20"],
        );
      })).rejects.toThrow();
    } finally {
      db.release();
    }

    const events = await pool.query("SELECT COUNT(*)::int AS count FROM indexed_events WHERE chain_id = $1", [46630]);
    const blocks = await pool.query("SELECT COUNT(*)::int AS count FROM indexed_blocks WHERE chain_id = $1", [46630]);
    const trades = await pool.query("SELECT COUNT(*)::int AS count FROM trades WHERE chain_id = $1", [46630]);
    expect(events.rows[0]?.count).toBe(0);
    expect(blocks.rows[0]?.count).toBe(0);
    expect(trades.rows[0]?.count).toBe(0);
  });

});
