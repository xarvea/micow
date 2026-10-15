import { readFile } from "node:fs/promises";
import { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { buildApp } from "./app.js";

const databaseUrl = process.env.TEST_DATABASE_URL;
const integrationDescribe = describe.skipIf(!databaseUrl);

integrationDescribe("API PostgreSQL integration", () => {
  let pool: Pool;
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeAll(async () => {
    pool = new Pool({ connectionString: databaseUrl });
    const migration = await readFile(
      new URL("../../../packages/database/migrations/001_init.sql", import.meta.url),
      "utf8",
    );
    await pool.query(migration);
    app = await buildApp(pool);
  });

  beforeEach(async () => {
    await pool.query("TRUNCATE trades, tokens, indexed_events, indexed_blocks");
  });

  afterAll(async () => {
    await app?.close();
    await pool?.end();
  });

  it("serves readiness, token listings, and trade history from the migrated schema", async () => {
    await pool.query(
      "INSERT INTO indexed_blocks (chain_id, block_number, block_hash, parent_hash) VALUES ($1, $2, $3, $4)",
      [46630, 123, "0xblock123", "0xblock122"],
    );
    await pool.query(
      "INSERT INTO tokens (chain_id, token_address, market_address, creator_address, name, symbol, total_supply, metadata_uri, created_block) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)",
      [46630, "0x0000000000000000000000000000000000000001", "0x0000000000000000000000000000000000000002", "0x0000000000000000000000000000000000000003", "Integration Token", "INT", "1000000000000000000000", "ipfs://integration", 123],
    );
    await pool.query(
      "INSERT INTO tokens (chain_id, token_address, market_address, creator_address, name, symbol, total_supply, metadata_uri, created_block) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)",
      [46630, "0x0000000000000000000000000000000000000005", "0x0000000000000000000000000000000000000006", "0x0000000000000000000000000000000000000007", "Tie Token", "TIE", "1000000000000000000000", "ipfs://tie", 123],
    );
    await pool.query(
      "INSERT INTO trades (chain_id, tx_hash, log_index, token_address, market_address, side, trader_address, amount_in, amount_out, protocol_fee, creator_fee, block_number, block_hash) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)",
      [46630, "0xtrade123", 0, "0x0000000000000000000000000000000000000001", "0x0000000000000000000000000000000000000002", "buy", "0x0000000000000000000000000000000000000004", "100", "200", "1", "1", 123, "0xblock123"],
    );
    await pool.query(
      "INSERT INTO trades (chain_id, tx_hash, log_index, token_address, market_address, side, trader_address, amount_in, amount_out, protocol_fee, creator_fee, block_number, block_hash) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)",
      [46630, "0xtrade456", 0, "0x0000000000000000000000000000000000000001", "0x0000000000000000000000000000000000000002", "sell", "0x0000000000000000000000000000000000000008", "200", "90", "1", "1", 123, "0xblock123"],
    );

    const ready = await app.inject({ method: "GET", url: "/ready" });
    expect(ready.statusCode).toBe(200);
    expect(ready.json()).toMatchObject({ status: "ready", indexedThrough: "123" });

    const tokens = await app.inject({ method: "GET", url: "/v1/tokens?limit=10&offset=0" });
    expect(tokens.statusCode).toBe(200);
    expect(tokens.json().items).toHaveLength(2);
    expect(tokens.json().items[0]).toMatchObject({
      token_address: "0x0000000000000000000000000000000000000001",
      name: "Integration Token",
      symbol: "INT",
    });
    expect(tokens.json().items[1]).toMatchObject({ symbol: "TIE" });

    const trades = await app.inject({
      method: "GET",
      url: "/v1/tokens/0x0000000000000000000000000000000000000001/trades?limit=10&offset=0",
    });
    expect(trades.statusCode).toBe(200);
    expect(trades.json().items).toHaveLength(2);
    expect(trades.json().items[0]).toMatchObject({ side: "sell", tx_hash: "0xtrade456" });
    expect(trades.json().items[1]).toMatchObject({ side: "buy", tx_hash: "0xtrade123" });
  });
});
