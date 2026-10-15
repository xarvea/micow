"use client";
import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { robinhoodTestnet } from "@/lib/wagmi";

export function WalletButton() {
  const { address, chainId, isConnected } = useAccount();
  const { connect, connectors, isPending, error } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain, isPending: isSwitchPending, error: switchError } = useSwitchChain();

  if (!isConnected) {
    return <div className="wallet-control">
      {connectors.map((connector) => <button className="button button-primary" disabled={isPending} key={connector.uid} onClick={() => connect({ connector })} type="button">{isPending ? "Connecting…" : "Connect " + connector.name}</button>)}
      {error ? <p className="inline-error">{error.message}</p> : null}
    </div>;
  }

  if (chainId !== robinhoodTestnet.id) {
    return <div className="wallet-control">
      <button className="button button-primary" disabled={isSwitchPending} onClick={() => switchChain({ chainId: robinhoodTestnet.id })} type="button">{isSwitchPending ? "Switching…" : "Switch to Robinhood Testnet"}</button>
      {switchError ? <p className="inline-error">{switchError.message}</p> : null}
    </div>;
  }

  return <div className="wallet-control">
    <span className="wallet-address" title={address}>{" " + address?.slice(0, 6) + "…" + address?.slice(-4)}</span>
    <button className="button button-secondary" onClick={() => disconnect()} type="button">Disconnect</button>
  </div>;
}
