import { describe, expect, it } from "vitest";
import { estimatePriceImpactBps, formatImpactBps, minimumOutput } from "./quotes";

describe("trade quote calculations", () => {
  it("rounds minimum received down conservatively", () => {
    expect(minimumOutput(10_000n)).toBe(9_900n);
    expect(minimumOutput(1n)).toBe(0n);
  });

  it("estimates curve impact in basis points", () => {
    expect(estimatePriceImpactBps(10_000n, 9_800n)).toBe(200n);
    expect(formatImpactBps(200n)).toBe("2.00%");
    expect(estimatePriceImpactBps(undefined, 1n)).toBeUndefined();
  });

  it("rejects invalid slippage settings", () => {
    expect(() => minimumOutput(1n, 10_001n)).toThrow(RangeError);
  });
});
