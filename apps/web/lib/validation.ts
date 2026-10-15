export type TokenDraft = { name: string; symbol: string; metadataURI: string };

export function validateTokenDraft(draft: TokenDraft): string | null {
  const name = draft.name.trim();
  const symbol = draft.symbol.trim();
  const metadataURI = draft.metadataURI.trim();

  if (name.length < 1 || name.length > 64) return "Name must contain 1–64 characters.";
  if (!/^[A-Za-z0-9]{2,12}$/.test(symbol)) return "Symbol must contain 2–12 letters or numbers.";
  if (!metadataURI || /\s/.test(metadataURI)) return "Enter a valid HTTPS or IPFS metadata URI.";
  if (metadataURI.startsWith("ipfs://")) {
    return metadataURI.slice("ipfs://".length).length > 0 ? null : "Enter a valid IPFS metadata URI.";
  }
  try {
    const url = new URL(metadataURI);
    if (url.protocol !== "https:") return "Metadata URL must use HTTPS or IPFS.";
    return null;
  } catch {
    return "Enter a valid HTTPS or IPFS metadata URI.";
  }
}
