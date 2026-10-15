import Link from "next/link";
import { WalletButton } from "@/components/WalletButton";
import { LaunchpadDashboard } from "@/components/LaunchpadDashboard";

const features = [
  { number: "01", title: "Fixed supply", description: "Each launch token is minted once. No privileged post-deployment mint function." },
  { number: "02", title: "On-chain curve", description: "Quotes, execution, reserves, and fee liabilities are governed by the contracts." },
  { number: "03", title: "User-controlled", description: "Transactions are signed in your wallet with explicit minimum output and deadlines." },
];

export default function HomePage() {
  const factoryAddress = process.env.NEXT_PUBLIC_LAUNCHPAD_FACTORY_ADDRESS;
  return <main>
    <nav className="topbar">
      <Link aria-label="MICOW home" className="brand" href="/"><span className="brand-mark">M</span><span>MICOW<span className="brand-dot">.</span></span></Link>
      <div className="topbar-right"><span className="network-pill"><span className="status-dot" /> TESTNET ONLY</span><WalletButton /></div>
    </nav>
    <section className="hero">
      <div className="hero-copy">
        <p className="eyebrow">ON-CHAIN TOKEN LAUNCHPAD</p>
        <h1>Launch ideas.<br /><span>Own the curve.</span></h1>
        <p className="hero-description">A transparent, non-custodial launchpad experiment built for Robinhood Chain Testnet. Trades are executed by contracts, not a centralized order book.</p>
        <div className="hero-actions">
          <a className="button button-primary" href="#launchpad">Open launchpad <span aria-hidden="true">↘</span></a>
          <a className="button button-secondary" href="https://explorer.testnet.chain.robinhood.com" rel="noreferrer" target="_blank">Open testnet explorer ↗</a>
        </div>
        <p className="disclaimer">Testnet software. No real-value assets. Not financial advice.</p>
      </div>
      {/* biome-ignore lint/a11y/useAriaPropsSupportedByRole: a named section is exposed as a region by the HTML accessibility mapping */}
      <section aria-label="Protocol status" className="protocol-card">
        <div className="card-orbit"><span className="orbit-core" /><span className="orbit-node node-one" /><span className="orbit-node node-two" /><span className="orbit-node node-three" /></div>
        <div className="protocol-card-footer">
          <div><span className="metric-label">NETWORK</span><strong>Robinhood Testnet</strong></div>
          <div><span className="metric-label">CHAIN ID</span><strong>46630</strong></div>
        </div>
        <div className="contract-status"><span className="metric-label">FACTORY ADDRESS</span><code>{factoryAddress || "Awaiting reviewed deployment"}</code></div>
      </section>
    </section>
    <section className="feature-section" id="how-it-works">
      <div className="section-heading"><p className="eyebrow">PROTOCOL PRINCIPLES</p><h2>Simple rules. <span>Verifiable execution.</span></h2></div>
      <div className="feature-grid">{features.map((feature) => <article className="feature-card" key={feature.number}><span className="feature-number">{feature.number}</span><h3>{feature.title}</h3><p>{feature.description}</p></article>)}</div>
    </section>
    <LaunchpadDashboard />
    <section className="launch-status">
      <div><p className="eyebrow">BUILD STATUS</p><h2>Built in the open.</h2><p>Contract interaction is enabled only after reviewed deployment addresses are published.</p></div>
      <a className="text-link" href="https://github.com/xarvea/micow" rel="noreferrer" target="_blank">Inspect source on GitHub ↗</a>
    </section>
    <footer><Link className="brand" href="/"><span className="brand-mark">M</span><span>MICOW<span className="brand-dot">.</span></span></Link><p>Independent project · Robinhood Chain Testnet · Not affiliated with Robinhood.</p></footer>
  </main>;
}
