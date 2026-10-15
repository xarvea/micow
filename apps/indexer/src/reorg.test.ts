import { describe, expect, it } from "vitest";
import { eventIdentity, findCommonAncestor } from "./reorg.js";

describe("indexer replay primitives", () => {
  it("builds stable event identities independent of hash casing", () => {
    expect(eventIdentity(46630, "0xABCD", 4)).toBe("46630:0xabcd:4");
    expect(eventIdentity(46630, "0xabcd", 4)).toBe("46630:0xabcd:4");
  });

  it("walks backward to the newest common ancestor", async () => {
    const stored = [
      { number: 12n, hash: "0xold12" },
      { number: 11n, hash: "0xold11" },
      { number: 10n, hash: "0xcanon10" },
    ];
    const canonical = new Map([[12n, "0xnew12"], [11n, "0xnew11"], [10n, "0xcanon10"]]);
    const ancestor = await findCommonAncestor(stored, async (number) => canonical.get(number) ?? null);
    expect(ancestor).toBe(10n);
  });

  it("returns null when no stored block remains canonical", async () => {
    const ancestor = await findCommonAncestor([{ number: 3n, hash: "0xold" }], async () => "0xnew");
    expect(ancestor).toBeNull();
  });
});
