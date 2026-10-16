export type IndexedTokenRecord = {
  tokenAddress: string;
  marketAddress: string;
};

export type RegistryMismatch = {
  tokenAddress: string;
  indexedMarketAddress: string;
  onchainMarketAddress: string;
  reason: "factory-market-mismatch" | "market-token-mismatch";
  onchainTokenAddress?: string;
};

export type RegistryReads = {
  readFactoryMarket: (tokenAddress: string) => Promise<string>;
  readMarketToken: (marketAddress: string) => Promise<string>;
};

/**
 * Compare indexer token projections with the factory registry and each market's token getter.
 * Reads are injected so the consistency logic can be tested without a live RPC.
 */
export async function reconcileTokenRegistry(
  records: readonly IndexedTokenRecord[],
  reads: RegistryReads,
): Promise<RegistryMismatch[]> {
  const mismatches: RegistryMismatch[] = [];

  for (const record of records) {
    const onchainMarketAddress = await reads.readFactoryMarket(record.tokenAddress);
    if (onchainMarketAddress.toLowerCase() !== record.marketAddress.toLowerCase()) {
      mismatches.push({
        tokenAddress: record.tokenAddress,
        indexedMarketAddress: record.marketAddress,
        onchainMarketAddress,
        reason: "factory-market-mismatch",
      });
      continue;
    }

    const onchainTokenAddress = await reads.readMarketToken(onchainMarketAddress);
    if (onchainTokenAddress.toLowerCase() !== record.tokenAddress.toLowerCase()) {
      mismatches.push({
        tokenAddress: record.tokenAddress,
        indexedMarketAddress: record.marketAddress,
        onchainMarketAddress,
        onchainTokenAddress,
        reason: "market-token-mismatch",
      });
    }
  }

  return mismatches;
}
