import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import Fastify, { type FastifyInstance } from "fastify";
import type { Pool } from "pg";
import { z } from "zod";

const paginationSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).max(1_000_000).default(0),
});
const addressSchema = z.string().regex(/^0x[a-fA-F0-9]{40}$/);

export type BuildAppOptions = { logger?: boolean; rateLimitMax?: number };

export async function buildApp(pool: Pool, options: BuildAppOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({ logger: options.logger ?? true, bodyLimit: 16_384, trustProxy: false });
  await app.register(cors, { origin: process.env.WEB_ORIGIN ?? "http://localhost:3000" });
  await app.register(rateLimit, { max: options.rateLimitMax ?? 120, timeWindow: "1 minute" });

  app.get("/health", async () => ({ status: "ok", service: "micow-api" }));

  app.get("/ready", async (_request, reply) => {
    try {
      const result = await pool.query("SELECT MAX(block_number)::text AS indexed_through FROM indexed_blocks WHERE chain_id = $1", [46630]);
      return { status: "ready", chainId: 46630, indexedThrough: result.rows[0]?.indexed_through ?? null };
    } catch {
      return reply.code(503).send({ status: "not_ready", reason: "database_unavailable" });
    }
  });

  app.get("/v1/tokens", async (request, reply) => {
    const parsed = paginationSchema.safeParse(request.query);
    if (!parsed.success) return reply.code(400).send({ error: "invalid_pagination" });
    const { limit, offset } = parsed.data;
    try {
      const result = await pool.query(
        "SELECT token_address, market_address, creator_address, name, symbol, total_supply, metadata_uri, created_block FROM tokens WHERE chain_id = $1 ORDER BY created_block DESC, token_address ASC LIMIT $2 OFFSET $3",
        [46630, limit, offset],
      );
      return { chainId: 46630, limit, offset, items: result.rows };
    } catch {
      return reply.code(503).send({ error: "read_model_unavailable" });
    }
  });

  app.get<{ Params: { tokenAddress: string }; Querystring: { limit?: string; offset?: string } }>(
    "/v1/tokens/:tokenAddress/trades",
    async (request, reply) => {
      const address = addressSchema.safeParse(request.params.tokenAddress);
      const page = paginationSchema.safeParse(request.query);
      if (!address.success || !page.success) return reply.code(400).send({ error: "invalid_query" });
      try {
        const token = await pool.query(
          "SELECT token_address FROM tokens WHERE chain_id = $1 AND lower(token_address) = lower($2)",
          [46630, address.data],
        );
        if (token.rowCount === 0) return reply.code(404).send({ error: "token_not_found" });
        const trades = await pool.query(
          "SELECT tx_hash, side, trader_address, amount_in, amount_out, protocol_fee, creator_fee, block_number FROM trades WHERE chain_id = $1 AND lower(token_address) = lower($2) ORDER BY block_number DESC, log_index DESC, tx_hash DESC LIMIT $3 OFFSET $4",
          [46630, address.data, page.data.limit, page.data.offset],
        );
        return { chainId: 46630, tokenAddress: address.data, ...page.data, items: trades.rows };
      } catch {
        return reply.code(503).send({ error: "read_model_unavailable" });
      }
    },
  );
  return app;
}
