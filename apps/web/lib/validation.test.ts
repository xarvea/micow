import { describe, expect, it } from "vitest";
import { validateTokenDraft } from "./validation";

describe("token draft validation", () => {
  it("accepts a valid HTTPS metadata URI", () => {
    expect(validateTokenDraft({ name: "Micow", symbol: "MCW", metadataURI: "https://example.com/token.json" })).toBeNull();
  });

  it("accepts a valid IPFS URI", () => {
    expect(validateTokenDraft({ name: "Micow", symbol: "MCW", metadataURI: "ipfs://bafy-example" })).toBeNull();
  });

  it("rejects empty names, invalid symbols, and unsafe URL schemes", () => {
    expect(validateTokenDraft({ name: "", symbol: "MCW", metadataURI: "ipfs://abc" })).not.toBeNull();
    expect(validateTokenDraft({ name: "Micow", symbol: "A!", metadataURI: "ipfs://abc" })).not.toBeNull();
    expect(validateTokenDraft({ name: "Micow", symbol: "MCW", metadataURI: "javascript:alert(1)" })).not.toBeNull();
  });
});
