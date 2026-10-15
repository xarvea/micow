import { createConfig, http } from "wagmi";
import { injected } from "wagmi/connectors";
import { defineChain } from "viem";

const rpcUrl = process.env.NEXT_PUBLIC_ROBINHOOD_RPC_URL ?? "https://rpc.testnet.chain.robinhood.com";

export const robinhoodTestnet = defineChain({
  id: 46630,
  name: "Robinhood Chain Testnet",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [rpcUrl] } },
  blockExplorers: { default: { name: "Robinhood Explorer", url: "https://explorer.testnet.chain.robinhood.com" } },
  testnet: true,
});

export const wagmiConfig = createConfig({
  chains: [robinhoodTestnet],
  connectors: [injected()],
  transports: { [robinhoodTestnet.id]: http(rpcUrl) },
  ssr: true,
});
