export type StoredBlock = { number: bigint; hash: string };

export async function findCommonAncestor(
  storedBlocksNewestFirst: StoredBlock[],
  getCanonicalHash: (number: bigint) => Promise<string | null>,
): Promise<bigint | null> {
  for (const stored of storedBlocksNewestFirst) {
    const canonicalHash = await getCanonicalHash(stored.number);
    if (canonicalHash && canonicalHash.toLowerCase() === stored.hash.toLowerCase()) {
      return stored.number;
    }
  }
  return null;
}

export function eventIdentity(chainId: number, transactionHash: string, logIndex: number): string {
  return chainId.toString() + ":" + transactionHash.toLowerCase() + ":" + logIndex.toString();
}
