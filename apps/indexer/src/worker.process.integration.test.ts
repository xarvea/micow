import { spawn, type ChildProcess } from "node:child_process";
import { createServer, type Server } from "node:http";
import { setTimeout as delay } from "node:timers/promises";
import { Pool } from "pg";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";

const databaseUrl = process.env.TEST_DATABASE_URL;
const integrationDescribe = describe.skipIf(!databaseUrl);
const chainIdHex = "0xb626";
const zero32 = "0x" + "0".repeat(64);
const zeroBloom = "0x" + "0".repeat(512);

integrationDescribe("indexer process recovery", () => {
  let pool: Pool;
  let server: Server;
  let rpcUrl = "";
  let rpcHealthy = false;
  let rpcRequests = 0;
  let head = 10n;
  const children: ChildProcess[] = [];

  beforeAll(async () => {
    pool = new Pool({ connectionString: databaseUrl });
    const migration = await readFile(
      new URL("../../../packages/database/migrations/001_init.sql", import.meta.url),
      "utf8",
    );
    await pool.query(migration);

    server = createServer(async (request, response) => {
      let body = "";
      for await (const chunk of request) body += chunk.toString();
      rpcRequests += 1;
      if (!rpcHealthy) {
        response.writeHead(503, { "content-type": "application/json" });
        response.end(JSON.stringify({ error: "test RPC outage" }));
        return;
      }

      const payload = JSON.parse(body) as { id: number; method: string; params?: unknown[] };
      let result: unknown;
      switch (payload.method) {
        case "eth_chainId":
          result = chainIdHex;
          break;
        case "eth_blockNumber":
          result = "0x" + head.toString(16);
          break;
        case "eth_getLogs":
          result = [];
          break;
        case "eth_getBlockByNumber": {
          const rawNumber = payload.params?.[0];
          const number = typeof rawNumber === "string" ? BigInt(rawNumber) : head;
          const hash = "0x" + number.toString(16).padStart(64, "0");
          const parentHash = "0x" + (number > 0n ? number - 1n : 0n).toString(16).padStart(64, "0");
          result = {
            hash,
            parentHash,
            sha3Uncles: zero32,
            miner: "0x0000000000000000000000000000000000000001",
            stateRoot: zero32,
            transactionsRoot: zero32,
            receiptsRoot: zero32,
            logsBloom: zeroBloom,
            difficulty: "0x0",
            number: "0x" + number.toString(16),
            gasLimit: "0x1c9c380",
            gasUsed: "0x0",
            timestamp: "0x1",
            extraData: "0x",
            mixHash: zero32,
            nonce: "0x0000000000000000",
            totalDifficulty: "0x0",
            transactions: [],
            uncles: [],
            baseFeePerGas: "0x1",
          };
          break;
        }
        default:
          response.writeHead(200, { "content-type": "application/json" });
          response.end(JSON.stringify({
            jsonrpc: "2.0",
            id: payload.id,
            error: { code: -32601, message: "Unsupported method " + payload.method },
          }));
          return;
      }

      response.writeHead(200, { "content-type": "application/json" });
      response.end(JSON.stringify({ jsonrpc: "2.0", id: payload.id, result }));
    });
    await new Promise<void>((resolveListen, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", () => {
        server.off("error", reject);
        const address = server.address();
        if (!address || typeof address === "string") {
          reject(new Error("Mock RPC server did not bind a TCP port"));
          return;
        }
        rpcUrl = "http://127.0.0.1:" + address.port.toString();
        resolveListen();
      });
    });
  }, 15_000);

  beforeEach(async () => {
    await pool.query("TRUNCATE trades, tokens, indexed_events, indexed_blocks");
    rpcHealthy = false;
    rpcRequests = 0;
    head = 10n;
  });

  afterAll(async () => {
    for (const child of children) {
      if (child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
    }
    await new Promise<void>((resolveClose) => server?.close(() => resolveClose()));
    await pool?.end();
  });

  async function waitFor(condition: () => Promise<boolean> | boolean, description: string): Promise<void> {
    const deadline = Date.now() + 25_000;
    while (Date.now() < deadline) {
      if (await condition()) return;
      await delay(100);
    }
    throw new Error("Timed out waiting for " + description);
  }

  function startIndexer(): { child: ChildProcess; output: () => string } {
    let logs = "";
    const child = spawn(process.execPath, ["--import", "tsx", "src/main.ts"], {
      cwd: process.cwd(),
      env: {
        ...process.env,
        RH_TESTNET_RPC_URL: rpcUrl,
        DATABASE_URL: databaseUrl,
        LAUNCHPAD_FACTORY_ADDRESS: "0x0000000000000000000000000000000000000001",
        INDEXER_START_BLOCK: "10",
        INDEXER_CONFIRMATIONS: "0",
        INDEXER_BATCH_SIZE: "1",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    child.stdout?.on("data", (chunk: Buffer) => { logs += chunk.toString(); });
    child.stderr?.on("data", (chunk: Buffer) => { logs += chunk.toString(); });
    children.push(child);
    return { child, output: () => logs };
  }

  async function stopIndexer(child: ChildProcess, output: () => string): Promise<void> {
    if (child.exitCode !== null || child.signalCode !== null) {
      throw new Error("Indexer exited before graceful shutdown. Output:\n" + output());
    }
    child.kill("SIGTERM");
    const deadline = Date.now() + 8_000;
    while (child.exitCode === null && child.signalCode === null && Date.now() < deadline) {
      await delay(50);
    }
    if (child.exitCode === null && child.signalCode === null) {
      child.kill("SIGKILL");
      throw new Error("Indexer did not stop after SIGTERM. Output:\n" + output());
    }
    expect(child.signalCode, "indexer must handle SIGTERM and exit normally. Output:\n" + output()).toBeNull();
    expect(child.exitCode, "indexer must exit with status 0. Output:\n" + output()).toBe(0);
  }

  it("recovers from an RPC outage, commits a durable checkpoint, and resumes after a real process restart", async () => {
    const first = startIndexer();

    await waitFor(() => {
      if (first.child.exitCode !== null || first.child.signalCode !== null) {
        throw new Error("Indexer exited before the initial RPC request. Output:\\n" + first.output());
      }
      return rpcRequests > 0;
    }, "the initial RPC outage to be observed");
    await delay(150);
    expect(rpcRequests).toBeGreaterThan(0);
    rpcHealthy = true;
    await waitFor(async () => {
      const result = await pool.query(
        "SELECT block_number::text FROM indexed_blocks WHERE chain_id = $1 ORDER BY block_number DESC LIMIT 1",
        [46630],
      );
      return result.rows[0]?.block_number === "10";
    }, "the first process to persist block 10");

    // Prove a previously healthy worker does not advance its durable checkpoint
    // when the provider fails during a later indexing cycle.
    rpcHealthy = false;
    head = 11n;
    const requestsBeforeOutage = rpcRequests;
    await waitFor(() => rpcRequests > requestsBeforeOutage, "the post-checkpoint RPC outage to be observed");
    await delay(250);

    const checkpointDuringOutage = await pool.query(
      "SELECT block_number::text FROM indexed_blocks WHERE chain_id = $1 ORDER BY block_number",
      [46630],
    );
    expect(checkpointDuringOutage.rows.map((row: { block_number: string }) => row.block_number)).toEqual(["10"]);
    const prematureBlock = await pool.query(
      "SELECT 1 FROM indexed_blocks WHERE chain_id = $1 AND block_number = 11",
      [46630],
    );
    expect(prematureBlock.rowCount).toBe(0);

    rpcHealthy = true;
    await waitFor(async () => {
      const result = await pool.query(
        "SELECT block_number::text FROM indexed_blocks WHERE chain_id = $1 AND block_number = 11",
        [46630],
      );
      return result.rowCount === 1;
    }, "the worker to recover and persist block 11");

    await stopIndexer(first.child, first.output);
    const firstCheckpoint = await pool.query(
      "SELECT block_number::text, block_hash FROM indexed_blocks WHERE chain_id = $1 ORDER BY block_number",
      [46630],
    );
    expect(firstCheckpoint.rows).toEqual([
      { block_number: "10", block_hash: "0x" + "a".padStart(64, "0") },
      { block_number: "11", block_hash: "0x" + "b".padStart(64, "0") },
    ]);

    head = 12n;
    const second = startIndexer();
    await waitFor(async () => {
      const result = await pool.query(
        "SELECT block_number::text FROM indexed_blocks WHERE chain_id = $1 AND block_number = 12",
        [46630],
      );
      return result.rowCount === 1;
    }, "the restarted process to resume at block 12");

    await stopIndexer(second.child, second.output);
    const checkpoints = await pool.query(
      "SELECT block_number::text FROM indexed_blocks WHERE chain_id = $1 ORDER BY block_number",
      [46630],
    );
    expect(checkpoints.rows.map((row: { block_number: string }) => row.block_number)).toEqual(["10", "11", "12"]);
    const blockCounts = await pool.query(
      "SELECT block_number::text, count(*)::int AS count FROM indexed_blocks WHERE chain_id = $1 GROUP BY block_number ORDER BY block_number",
      [46630],
    );
    expect(blockCounts.rows).toEqual([
      { block_number: "10", count: 1 },
      { block_number: "11", count: 1 },
      { block_number: "12", count: 1 },
    ]);
    expect(first.output()).toMatch(/RPC operation getChainId failed|RPC unavailable during indexer startup/);
    expect(second.output()).toMatch(/MICOW indexer started on chain 46630/);
  }, 45_000);
});
