import { afterEach, describe, expect, it } from "vitest";
import type { Pool } from "pg";
import { buildApp } from "./app.js";

describe("MICOW API", () => {
  let app: Awaited<ReturnType<typeof buildApp>> | undefined;

  afterEach(async () => {
    await app?.close();
    app = undefined;
  });

  it("exposes liveness without querying the database", async () => {
    const pool = { query: async () => { throw new Error("must not query"); } } as unknown as Pool;
    app = await buildApp(pool);
    const response = await app.inject({ method: "GET", url: "/health" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "ok", service: "micow-api" });
  });

  it("returns not-ready when the database is unavailable", async () => {
    const pool = { query: async () => { throw new Error("database offline"); } } as unknown as Pool;
    app = await buildApp(pool);
    const response = await app.inject({ method: "GET", url: "/ready" });
    expect(response.statusCode).toBe(503);
    expect(response.json()).toMatchObject({ status: "not_ready" });
  });

  it("rejects invalid pagination", async () => {
    const pool = { query: async () => ({ rows: [], rowCount: 0 }) } as unknown as Pool;
    app = await buildApp(pool);
    const response = await app.inject({ method: "GET", url: "/v1/tokens?limit=1000" });
    expect(response.statusCode).toBe(400);
  });

  it("rejects invalid token addresses before querying the database", async () => {
    let queries = 0;
    const pool = { query: async () => { queries += 1; return { rows: [], rowCount: 0 }; } } as unknown as Pool;
    app = await buildApp(pool);
    const response = await app.inject({ method: "GET", url: "/v1/tokens/not-an-address/trades" });
    expect(response.statusCode).toBe(400);
    expect(queries).toBe(0);
  });

  it("uses bounded, parameterized pagination queries", async () => {
    const calls: Array<{ sql: string; values?: unknown[] }> = [];
    const pool = {
      query: async (sql: string, values?: unknown[]) => {
        calls.push({ sql, values });
        return { rows: [], rowCount: 0 };
      },
    } as unknown as Pool;
    app = await buildApp(pool);

    const response = await app.inject({ method: "GET", url: "/v1/tokens?limit=10&offset=5" });

    expect(response.statusCode).toBe(200);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.values).toEqual([46630, 10, 5]);
    expect(calls[0]?.sql).toContain("$1");
    expect(calls[0]?.sql).toContain("$2");
    expect(calls[0]?.sql).toContain("$3");
    expect(calls[0]?.sql).toContain("ORDER BY created_block DESC, token_address ASC");
  });
  it("uses a stable tie-breaker for trades in the same block and log index", async () => {
    const calls: Array<{ sql: string; values?: unknown[] }> = [];
    const pool = {
      query: async (sql: string, values?: unknown[]) => {
        calls.push({ sql, values });
        return calls.length === 1
          ? { rows: [{ token_address: "0x0000000000000000000000000000000000000001" }], rowCount: 1 }
          : { rows: [], rowCount: 0 };
      },
    } as unknown as Pool;
    app = await buildApp(pool, { logger: false });

    const response = await app.inject({
      method: "GET",
      url: "/v1/tokens/0x0000000000000000000000000000000000000001/trades",
    });

    expect(response.statusCode).toBe(200);
    expect(calls[1]?.sql).toContain("ORDER BY block_number DESC, log_index DESC, tx_hash DESC");
  });

  it("returns 429 after the configured rate limit is exceeded", async () => {
    const pool = { query: async () => ({ rows: [], rowCount: 0 }) } as unknown as Pool;
    app = await buildApp(pool, { logger: false, rateLimitMax: 2 });

    expect((await app.inject({ method: "GET", url: "/health" })).statusCode).toBe(200);
    expect((await app.inject({ method: "GET", url: "/health" })).statusCode).toBe(200);
    expect((await app.inject({ method: "GET", url: "/health" })).statusCode).toBe(429);
  });

});
