"use client";

import { useEffect, useMemo, useState } from "react";
import { useAccount, useReadContract, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { formatUnits, isAddress, parseEther, parseUnits, type Address } from "viem";
import { erc20Abi, marketAbi } from "@/lib/abis";
import { estimatePriceImpactBps, formatImpactBps, minimumOutput } from "@/lib/quotes";

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

function displayAmount(value: bigint, decimals = 18): string {
  const raw = formatUnits(value, decimals);
  const parts = raw.split(".");
  const fraction = (parts[1] ?? "").slice(0, 6).replace(/0+$/, "");
  return fraction ? (parts[0] ?? "0") + "." + fraction : (parts[0] ?? "0");
}

function parsePositive(value: string, parse: (value: string) => bigint): bigint | undefined {
  try {
    if (!value.trim()) return undefined;
    const parsed = parse(value);
    return parsed > 0n ? parsed : undefined;
  } catch {
    return undefined;
  }
}

export function TokenCard({ token }: { token: TokenRecord }) {
  const [buyAmount, setBuyAmount] = useState("0.01");
  const [sellAmount, setSellAmount] = useState("");
  const { address, chainId, isConnected } = useAccount();
  const marketAddress = isAddress(token.market_address) ? token.market_address as Address : undefined;
  const tokenAddress = isAddress(token.token_address) ? token.token_address as Address : undefined;
  const buyWei = useMemo(() => parsePositive(buyAmount, parseEther), [buyAmount]);
  const sellWei = useMemo(() => parsePositive(sellAmount, (value) => parseUnits(value, 18)), [sellAmount]);
  const canWrite = isConnected && chainId === 46630 && Boolean(marketAddress && tokenAddress);

  const buyQuoteQuery = useReadContract({
    address: marketAddress,
    abi: marketAbi,
    functionName: "quoteBuy",
    args: [buyWei ?? 0n],
    query: { enabled: Boolean(marketAddress && buyWei && buyWei > 0n) },
  });
  const sellQuoteQuery = useReadContract({
    address: marketAddress,
    abi: marketAbi,
    functionName: "quoteSell",
    args: [sellWei ?? 0n],
    query: { enabled: Boolean(marketAddress && sellWei && sellWei > 0n) },
  });
  const allowanceQuery = useReadContract({
    address: tokenAddress,
    abi: erc20Abi,
    functionName: "allowance",
    args: [address ?? "0x0000000000000000000000000000000000000000", marketAddress ?? "0x0000000000000000000000000000000000000000"],
    query: { enabled: Boolean(address && tokenAddress && marketAddress && chainId === 46630) },
  });
  const balanceQuery = useReadContract({
    address: tokenAddress,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: [address ?? "0x0000000000000000000000000000000000000000"],
    query: { enabled: Boolean(address && tokenAddress && chainId === 46630) },
  });
  const realEthReserveQuery = useReadContract({
    address: marketAddress,
    abi: marketAbi,
    functionName: "realEthReserve",
    query: { enabled: Boolean(marketAddress) },
  });
  const realTokenReserveQuery = useReadContract({
    address: marketAddress,
    abi: marketAbi,
    functionName: "realTokenReserve",
    query: { enabled: Boolean(marketAddress) },
  });
  const virtualEthReserveQuery = useReadContract({
    address: marketAddress,
    abi: marketAbi,
    functionName: "VIRTUAL_ETH_RESERVE",
    query: { enabled: Boolean(marketAddress) },
  });
  const virtualTokenReserveQuery = useReadContract({
    address: marketAddress,
    abi: marketAbi,
    functionName: "VIRTUAL_TOKEN_RESERVE",
    query: { enabled: Boolean(marketAddress) },
  });

  const trade = useWriteContract();
  const tradeReceipt = useWaitForTransactionReceipt({ hash: trade.data });
  const approval = useWriteContract();
  const approvalReceipt = useWaitForTransactionReceipt({ hash: approval.data });

  useEffect(() => {
    if (approvalReceipt.isSuccess) void allowanceQuery.refetch();
  }, [approvalReceipt.isSuccess, allowanceQuery.refetch]);

  const buyQuote = buyQuoteQuery.data as readonly [bigint, bigint, bigint] | undefined;
  const sellQuote = sellQuoteQuery.data as readonly [bigint, bigint, bigint] | undefined;
  const allowance = allowanceQuery.data as bigint | undefined;
  const balance = balanceQuery.data as bigint | undefined;
  const realEthReserve = realEthReserveQuery.data as bigint | undefined;
  const realTokenReserve = realTokenReserveQuery.data as bigint | undefined;
  const virtualEthReserve = virtualEthReserveQuery.data as bigint | undefined;
  const virtualTokenReserve = virtualTokenReserveQuery.data as bigint | undefined;
  const buySpotOutput = buyWei !== undefined && realEthReserve !== undefined && realTokenReserve !== undefined
    && virtualEthReserve !== undefined && virtualTokenReserve !== undefined
    ? buyWei * (realTokenReserve + virtualTokenReserve) / (realEthReserve + virtualEthReserve)
    : undefined;
  const sellSpotOutput = sellWei !== undefined && realEthReserve !== undefined && realTokenReserve !== undefined
    && virtualEthReserve !== undefined && virtualTokenReserve !== undefined && realTokenReserve + virtualTokenReserve > 0n
    ? sellWei * (realEthReserve + virtualEthReserve) / (realTokenReserve + virtualTokenReserve)
    : undefined;
  const buyMinimum = buyQuote ? minimumOutput(buyQuote[0]) : undefined;
  const sellMinimum = sellQuote ? minimumOutput(sellQuote[0]) : undefined;
  const buyImpact = estimatePriceImpactBps(buySpotOutput, buyQuote?.[0]);
  const sellImpact = estimatePriceImpactBps(sellSpotOutput, sellQuote?.[0]);

  function buy() {
    if (!marketAddress || !buyWei || !buyQuote) return;
    const minimum = minimumOutput(buyQuote[0]);
    trade.writeContract({
      address: marketAddress,
      abi: marketAbi,
      functionName: "buy",
      args: [minimum, BigInt(Math.floor(Date.now() / 1000) + 120)],
      value: buyWei,
      chainId: 46630,
    });
  }

  function sell() {
    if (!marketAddress || !tokenAddress || !sellWei || !sellQuote || !address) return;
    if (allowance === undefined || allowance < sellWei) {
      approval.writeContract({
        address: tokenAddress,
        abi: erc20Abi,
        functionName: "approve",
        args: [marketAddress, sellWei],
        chainId: 46630,
      });
      return;
    }
    const minimum = minimumOutput(sellQuote[0]);
    trade.writeContract({
      address: marketAddress,
      abi: marketAbi,
      functionName: "sell",
      args: [sellWei, minimum, BigInt(Math.floor(Date.now() / 1000) + 120)],
      chainId: 46630,
    });
  }

  if (!marketAddress || !tokenAddress) {
    return <article className="token-card"><p className="inline-error">Invalid token or market address returned by the read model.</p></article>;
  }

  return <article className="token-card">
    <div className="token-card-heading">
      <div><span className="feature-number">TOKEN / {token.created_block}</span><h3>{token.name} <span className="token-symbol">${token.symbol}</span></h3></div>
      <a className="text-link" href={"https://explorer.testnet.chain.robinhood.com/address/" + token.token_address} rel="noreferrer" target="_blank">Explorer ↗</a>
    </div>
    <p className="token-address">{token.token_address}</p>
    <div className="token-stats">
      <div><span className="metric-label">FIXED SUPPLY</span><strong>{displayAmount(BigInt(token.total_supply))}</strong></div>
      <div><span className="metric-label">YOUR BALANCE</span><strong>{balance === undefined ? "—" : displayAmount(balance)}</strong></div>
    </div>
    <div className="trade-grid">
      <section className="trade-panel">
        <h4>Buy with ETH</h4>
        <label htmlFor={"buy-" + token.token_address}>ETH amount</label>
        <input id={"buy-" + token.token_address} inputMode="decimal" min="0" onChange={(event) => setBuyAmount(event.target.value)} placeholder="0.01" step="any" type="number" value={buyAmount} />
        <p className="quote-line">Estimated tokens <strong>{buyQuote ? displayAmount(buyQuote[0]) : "—"}</strong></p>
        <p className="quote-line">Min received (1% slippage) <strong>{buyMinimum !== undefined ? displayAmount(buyMinimum) : "—"}</strong></p>
        <p className="quote-line">Price impact incl. fees <strong>{formatImpactBps(buyImpact)}</strong></p>
        <p className="quote-line">Protocol + creator fee <strong>{buyQuote ? displayAmount(buyQuote[1] + buyQuote[2]) + " ETH" : "—"}</strong></p>
        <button className="button button-primary full-width" disabled={!canWrite || !buyQuote || !buyWei || trade.isPending || tradeReceipt.isLoading} onClick={buy} type="button">{trade.isPending ? "Confirm in wallet…" : "Buy token"}</button>
      </section>
      <section className="trade-panel">
        <h4>Sell tokens</h4>
        <label htmlFor={"sell-" + token.token_address}>Token amount</label>
        <input id={"sell-" + token.token_address} inputMode="decimal" min="0" onChange={(event) => setSellAmount(event.target.value)} placeholder="1000" step="any" type="number" value={sellAmount} />
        <p className="quote-line">Estimated ETH <strong>{sellQuote ? displayAmount(sellQuote[0]) : "—"}</strong></p>
        <p className="quote-line">Min received (1% slippage) <strong>{sellMinimum !== undefined ? displayAmount(sellMinimum) + " ETH" : "—"}</strong></p>
        <p className="quote-line">Price impact incl. fees <strong>{formatImpactBps(sellImpact)}</strong></p>
        <p className="quote-line">Protocol + creator fee <strong>{sellQuote ? displayAmount(sellQuote[1] + sellQuote[2]) + " ETH" : "—"}</strong></p>
        <button className="button button-secondary full-width" disabled={!canWrite || !sellQuote || !sellWei || allowanceQuery.isLoading || trade.isPending || tradeReceipt.isLoading || approval.isPending || (balance !== undefined && sellWei !== undefined && balance < sellWei)} onClick={sell} type="button">{approval.isPending ? "Approve in wallet…" : allowance !== undefined && sellWei !== undefined && allowance < sellWei ? "Approve then sell" : "Sell token"}</button>
      </section>
    </div>
    <p className="fee-note">Fixed fee rates: 1% protocol + 1% creator. Quote uses 1% minimum-output slippage protection and a 120-second deadline.</p>
    {approvalReceipt.isSuccess ? <p className="transaction-success">Approval confirmed. Click Sell token again to submit the trade.</p> : null}
    {tradeReceipt.isLoading ? <p className="transaction-status">Waiting for transaction confirmation…</p> : null}
    {tradeReceipt.isSuccess && trade.data ? <p className="transaction-success">Transaction confirmed: <a href={"https://explorer.testnet.chain.robinhood.com/tx/" + trade.data} rel="noreferrer" target="_blank">view transaction ↗</a></p> : null}
    {trade.error ? <p className="inline-error">{trade.error.message}</p> : null}
    {approval.error ? <p className="inline-error">{approval.error.message}</p> : null}
    {tradeReceipt.error ? <p className="inline-error">{tradeReceipt.error.message}</p> : null}
  </article>;
}
