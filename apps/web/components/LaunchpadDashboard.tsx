"use client";

import { useEffect, useState } from "react";
import { useAccount, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { isAddress, type Address } from "viem";
import { factoryAbi } from "@/lib/abis";
import { validateTokenDraft } from "@/lib/validation";
import { TokenCard } from "@/components/TokenCard";

type TokenRecord = {
  token_address: string;
  market_address: string;
  creator_address: string;
  name: string;
  symbol: string;
  total_supply: string;
  metadata_uri: string;
  created_block: string;
};

const apiBase = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000").replace(/\/$/, "");
const rawFactoryAddress = process.env.NEXT_PUBLIC_LAUNCHPAD_FACTORY_ADDRESS;
const factoryAddress = rawFactoryAddress && isAddress(rawFactoryAddress) ? rawFactoryAddress as Address : undefined;

export function LaunchpadDashboard() {
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [metadataURI, setMetadataURI] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [tokens, setTokens] = useState<TokenRecord[]>([]);
  const [loadingTokens, setLoadingTokens] = useState(true);
  const [apiError, setApiError] = useState<string | null>(null);
  const { isConnected, chainId } = useAccount();
  const create = useWriteContract();
  const receipt = useWaitForTransactionReceipt({ hash: create.data });
  const validationError = validateTokenDraft({ name, symbol, metadataURI });

  useEffect(() => {
    const controller = new AbortController();
    setLoadingTokens(true);
    setApiError(null);
    fetch(apiBase + "/v1/tokens?limit=50&refresh=" + refreshKey, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error("API returned HTTP " + response.status);
        return response.json() as Promise<{ items: TokenRecord[] }>;
      })
      .then((payload) => setTokens(Array.isArray(payload.items) ? payload.items : []))
      .catch((error: unknown) => {
        if (error instanceof Error && error.name === "AbortError") return;
        setApiError(error instanceof Error ? error.message : "API unavailable");
      })
      .finally(() => setLoadingTokens(false));
    return () => controller.abort();
  }, [refreshKey]);

  useEffect(() => {
    if (receipt.isSuccess) setRefreshKey((current) => current + 1);
  }, [receipt.isSuccess]);

  function submitCreate() {
    if (!factoryAddress || validationError || !isConnected || chainId !== 46630) return;
    create.writeContract({
      address: factoryAddress,
      abi: factoryAbi,
      functionName: "createToken",
      args: [name.trim(), symbol.trim(), metadataURI.trim()],
      chainId: 46630,
    });
  }

  return <section className="launchpad-section" id="launchpad">
    <div className="section-heading">
      <p className="eyebrow">TESTNET PLAYGROUND</p>
      <h2>Create. Trade. <span>Verify.</span></h2>
      <p className="section-intro">Connect a wallet on Robinhood Chain Testnet to create a fixed-supply token or test a market already indexed from the chain.</p>
    </div>
    <div className="create-panel">
      <div className="create-panel-heading"><div><p className="eyebrow">TOKEN FACTORY</p><h3>Create a token</h3></div><span className="network-pill"><span className="status-dot" /> CHAIN 46630</span></div>
      {!factoryAddress ? <p className="notice">Factory address is not configured. Trading and creation remain disabled until a reviewed testnet deployment is recorded.</p> : null}
      {chainId !== undefined && chainId !== 46630 ? <p className="notice">Switch your wallet to Robinhood Chain Testnet before submitting transactions.</p> : null}
      <div className="create-form">
        <label>Token name<input maxLength={64} onChange={(event) => setName(event.target.value)} placeholder="Micow Community" value={name} /></label>
        <label>Symbol<input maxLength={12} onChange={(event) => setSymbol(event.target.value.toUpperCase())} placeholder="MICOW" value={symbol} /></label>
        <label className="metadata-field">Metadata URI<input onChange={(event) => setMetadataURI(event.target.value)} placeholder="ipfs://… or https://…" value={metadataURI} /></label>
      </div>
      {validationError ? <p className="form-hint">{validationError}</p> : <p className="form-hint">Metadata is stored as a URI; this app does not fetch or render remote HTML.</p>}
      <button className="button button-primary" disabled={!factoryAddress || !isConnected || chainId !== 46630 || Boolean(validationError) || create.isPending || receipt.isLoading} onClick={submitCreate} type="button">
        {create.isPending ? "Confirm in wallet…" : receipt.isLoading ? "Waiting for confirmation…" : "Create fixed-supply token"}
      </button>
      {create.error ? <p className="inline-error">{create.error.message}</p> : null}
      {receipt.error ? <p className="inline-error">{receipt.error.message}</p> : null}
      {receipt.isSuccess && create.data ? <p className="transaction-success">Token creation transaction confirmed: <a href={"https://explorer.testnet.chain.robinhood.com/tx/" + create.data} rel="noreferrer" target="_blank">view transaction ↗</a>. Refresh the list after indexing completes.</p> : null}
    </div>
    <div className="token-list-heading">
      <div><p className="eyebrow">ON-CHAIN READ MODEL</p><h3>Recent launches</h3></div>
      <button className="button button-secondary" disabled={loadingTokens} onClick={() => setRefreshKey((current) => current + 1)} type="button">{loadingTokens ? "Refreshing…" : "Refresh list"}</button>
    </div>
    {apiError ? <p className="notice">Could not load the indexer API: {apiError}. Start PostgreSQL, apply migrations, and run the indexer/API using docs/BUILD-RUNBOOK.md.</p> : null}
    {loadingTokens && tokens.length === 0 ? <p className="empty-state">Loading indexed tokens…</p> : null}
    {!loadingTokens && !apiError && tokens.length === 0 ? <p className="empty-state">No tokens indexed yet. Create a token after the factory is deployed, or refresh after the indexer catches up.</p> : null}
    <div className="token-list">{tokens.map((token) => <TokenCard key={token.token_address} token={token} />)}</div>
  </section>;
}
