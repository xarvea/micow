import { describe, expect, it, vi } from "vitest";
import { reconcileTokenRegistry } from "./reconciliation.js";

const token = "0x00000000000000000000000000000000000000a1";
const market = "0x00000000000000000000000000000000000000b2";
const other = "0x00000000000000000000000000000000000000c3";

describe("reconcileTokenRegistry", () => {
  it("accepts a projection matching both the factory registry and market token", async () => {
    const reads = {
      readFactoryMarket: vi.fn().mockResolvedValue(market),
      readMarketToken: vi.fn().mockResolvedValue(token),
    };

    await expect(reconcileTokenRegistry([{ tokenAddress: token, marketAddress: market }], reads)).resolves.toEqual([]);
    expect(reads.readFactoryMarket).toHaveBeenCalledWith(token);
    expect(reads.readMarketToken).toHaveBeenCalledWith(market);
  });

  it("reports factory mapping drift and does not trust the indexed market address", async () => {
    const reads = {
      readFactoryMarket: vi.fn().mockResolvedValue(other),
      readMarketToken: vi.fn(),
    };

    await expect(reconcileTokenRegistry([{ tokenAddress: token, marketAddress: market }], reads)).resolves.toEqual([
      {
        tokenAddress: token,
        indexedMarketAddress: market,
        onchainMarketAddress: other,
        reason: "factory-market-mismatch",
      },
    ]);
    expect(reads.readMarketToken).not.toHaveBeenCalled();
  });

  it("reports a market whose on-chain token getter disagrees with the indexed token", async () => {
    const reads = {
      readFactoryMarket: vi.fn().mockResolvedValue(market),
      readMarketToken: vi.fn().mockResolvedValue(other),
    };

    await expect(reconcileTokenRegistry([{ tokenAddress: token, marketAddress: market }], reads)).resolves.toEqual([
      {
        tokenAddress: token,
        indexedMarketAddress: market,
        onchainMarketAddress: market,
        onchainTokenAddress: other,
        reason: "market-token-mismatch",
      },
    ]);
  });

  it("compares EVM addresses case-insensitively", async () => {
    const reads = {
      readFactoryMarket: vi.fn().mockResolvedValue(market.toUpperCase().replace("0X", "0x")),
      readMarketToken: vi.fn().mockResolvedValue(token.toUpperCase().replace("0X", "0x")),
    };

    await expect(
      reconcileTokenRegistry([{ tokenAddress: token, marketAddress: market.toUpperCase().replace("0X", "0x") }], reads),
    ).resolves.toEqual([]);
  });

  it("propagates RPC read failures rather than reporting a false clean result", async () => {
    const reads = {
      readFactoryMarket: vi.fn().mockRejectedValue(new Error("RPC unavailable")),
      readMarketToken: vi.fn(),
    };

    await expect(reconcileTokenRegistry([{ tokenAddress: token, marketAddress: market }], reads)).rejects.toThrow("RPC unavailable");
  });
});
