import { describe, expect, it } from "vitest";
import { withRpcRetry } from "./retry.js";

describe("withRpcRetry", () => {
  it("recovers from transient RPC failures with bounded exponential backoff", async () => {
    let calls = 0;
    const delays: number[] = [];
    const result = await withRpcRetry(
      async () => {
        calls += 1;
        if (calls < 3) throw new Error("temporary RPC outage");
        return 46630;
      },
      {
        attempts: 3,
        initialDelayMs: 10,
        maxDelayMs: 20,
        sleep: async (milliseconds) => { delays.push(milliseconds); },
      },
    );

    expect(result).toBe(46630);
    expect(calls).toBe(3);
    expect(delays).toEqual([10, 20]);
  });

  it("surfaces persistent RPC failure after the configured attempt limit", async () => {
    let calls = 0;
    const delays: number[] = [];
    await expect(
      withRpcRetry(
        async () => {
          calls += 1;
          throw new Error("RPC still unavailable");
        },
        {
          attempts: 3,
          initialDelayMs: 5,
          maxDelayMs: 10,
          sleep: async (milliseconds) => { delays.push(milliseconds); },
        },
      ),
    ).rejects.toThrow("RPC still unavailable");

    expect(calls).toBe(3);
    expect(delays).toEqual([5, 10]);
  });

  it("rejects invalid retry limits", async () => {
    await expect(
      withRpcRetry(async () => 1, { attempts: 0 }),
    ).rejects.toThrow("RPC retry attempts must be a positive integer");
  });
});
