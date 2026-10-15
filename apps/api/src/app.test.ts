import { afterEach, describe, expect, it } from "vitest";
import type { Pool } from "pg";
import { buildApp } from "./app.js";

describe("MICOW API", () => {
  let app: Awaited<ReturnType<typeof buildApp>> | undefined;
  afterEach(async () => { await app?.close(); app = undefined; });

  it("exposes liveness without querying the database", async () => {
    const pool = { query: async () => { throw new Error("must not query"); } } as unknown as Pool;
    app = await buildApp(pool);
    const response = await app.inject({ method: "GET", url: "/health" });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "ok", service: "micow-api" });
  });

  it("rejects invalid pagination", async () => {
    const pool = { query: async () => ({ rows: [], rowCount: 0 }) } as unknown as Pool;
    app = await buildApp(pool);
    const response = await app.inject({ method: "GET", url: "/v1/tokens?limit=1000" });
    expect(response.statusCode).toBe(400);
  });
});
