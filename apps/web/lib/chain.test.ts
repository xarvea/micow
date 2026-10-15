import { describe, expect, it } from "vitest";
import { robinhoodTestnet } from "./wagmi";

describe("Robinhood Chain Testnet", () => {
  it("uses the expected chain id and testnet explorer", () => {
    expect(robinhoodTestnet.id).toBe(46630);
    expect(robinhoodTestnet.testnet).toBe(true);
    expect(robinhoodTestnet.blockExplorers.default.url).toContain("testnet");
  });
});
