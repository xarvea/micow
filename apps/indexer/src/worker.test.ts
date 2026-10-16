import { describe, expect, it } from "vitest";
import { runWorkerLoop } from "./worker.js";

describe("runWorkerLoop", () => {
  it("continues after a failed cycle and exits cleanly when shutdown is requested", async () => {
    let running = true;
    let attempts = 0;
    const errors: unknown[] = [];
    const sleeps: number[] = [];

    await runWorkerLoop({
      shouldRun: () => running,
      runOnce: async () => {
        attempts += 1;
        if (attempts === 1) throw new Error("RPC unavailable");
        running = false;
      },
      sleep: async (milliseconds) => { sleeps.push(milliseconds); },
      intervalMs: 25,
      onError: (error) => { errors.push(error); },
    });

    expect(attempts).toBe(2);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toMatchObject({ message: "RPC unavailable" });
    expect(sleeps).toEqual([25]);
  });

  it("rejects an invalid polling interval", async () => {
    await expect(runWorkerLoop({
      shouldRun: () => false,
      runOnce: async () => undefined,
      sleep: async () => undefined,
      intervalMs: -1,
    })).rejects.toThrow("Worker interval must be a non-negative integer");
  });
});
