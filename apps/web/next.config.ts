import type { NextConfig } from "next";

const unusedOptionalWalletSdkModules = [
  "@base-org/account",
  "@coinbase/wallet-sdk",
  "@metamask/connect-evm",
  "@safe-global/safe-apps-sdk",
  "@safe-global/safe-apps-provider",
  "@walletconnect/ethereum-provider",
  "accounts",
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  webpack(config) {
    // MICOW configures only the injected connector. Wagmi's connector barrel
    // statically references optional SDKs for connectors this app does not enable.
    const existing = Array.isArray(config.externals)
      ? config.externals
      : config.externals
        ? [config.externals]
        : [];
    config.externals = [...existing, ...unusedOptionalWalletSdkModules] as typeof config.externals;
    return config;
  },
};

export default nextConfig;
