"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PrivyProvider, usePrivy } from "@privy-io/react-auth";
import { toSolanaWalletConnectors, useWallets } from "@privy-io/react-auth/solana";

type Props = {
  code: string;
  number: string;
  dateLabel: string;
  imageUrl: string;
  timelapseUrl?: string;
  herod: string;
  devnet: boolean;
  privyAppId: string | null;
};

type Claimed = { asset: string; txUrl: string; owner: string };

async function postClaim(code: string, address: string): Promise<Claimed> {
  const res = await fetch("/api/claim", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ code, address, consent: true }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Something went wrong.");
  return { asset: data.asset, txUrl: data.txUrl, owner: address };
}

export default function ClaimClient(props: Props) {
  const [claimed, setClaimed] = useState<Claimed | null>(null);
  if (claimed) return <Success {...props} claimed={claimed} />;

  if (!props.privyAppId) return <ClaimView {...props} onClaimed={setClaimed} wallet={null} />;

  return (
    <PrivyProvider
      appId={props.privyAppId}
      config={{
        loginMethods: ["wallet", "email"],
        appearance: {
          theme: "dark",
          accentColor: "#14F195",
          walletChainType: "solana-only",
          logo: "/solanafaces.jpg",
          // Always offer the big Solana wallets, even on phones where none are "detected".
          walletList: ["detected_solana_wallets", "phantom", "solflare", "backpack"],
        },
        embeddedWallets: { solana: { createOnLogin: "users-without-wallets" }, ethereum: { createOnLogin: "off" } },
        externalWallets: { solana: { connectors: toSolanaWalletConnectors() } },
      }}
    >
      <WithPrivy {...props} onClaimed={setClaimed} />
    </PrivyProvider>
  );
}

type WalletApi = {
  ready: boolean;
  address: string | null;
  connect: (mode: "wallet" | "email") => void;
};

function WithPrivy(props: Props & { onClaimed: (c: Claimed) => void }) {
  const { ready, authenticated, login, user } = usePrivy();
  const { wallets } = useWallets();
  const address = wallets[0]?.address ?? (user?.wallet?.chainType === "solana" ? user.wallet.address : null) ?? null;
  const wallet: WalletApi = {
    ready,
    address: authenticated ? address : null,
    connect: (mode) => login({ loginMethods: mode === "email" ? ["email"] : ["wallet"] }),
  };
  return <ClaimView {...props} wallet={wallet} />;
}

/** On a phone browser, wallets live in their own apps: offer to reopen this page inside them. */
function WalletAppLinks() {
  const [show, setShow] = useState(false);
  const [url, setUrl] = useState("");
  useEffect(() => {
    const w = window as unknown as { phantom?: unknown; solflare?: unknown; solana?: unknown };
    const mobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    setShow(mobile && !w.phantom && !w.solflare && !w.solana);
    setUrl(window.location.href);
  }, []);
  if (!show) return null;
  const page = encodeURIComponent(url);
  const ref = encodeURIComponent(typeof window !== "undefined" ? window.location.origin : "");
  return (
    <div className="stack" style={{ gap: 8 }}>
      <div className="small" style={{ textAlign: "center" }}>
        Have a wallet app on this phone? Open this page inside it:
      </div>
      <div className="row" style={{ gap: 8 }}>
        <a className="btn btn-quiet" style={{ flex: 1, height: 46 }} href={`https://phantom.app/ul/browse/${page}?ref=${ref}`}>
          Open in Phantom
        </a>
        <a className="btn btn-quiet" style={{ flex: 1, height: 46 }} href={`https://solflare.com/ul/v1/browse/${page}?ref=${ref}`}>
          Open in Solflare
        </a>
      </div>
    </div>
  );
}

function ClaimView(props: Props & { onClaimed: (c: Claimed) => void; wallet: WalletApi | null }) {
  const { code, number, dateLabel, imageUrl, timelapseUrl, herod, devnet, wallet, onClaimed } = props;
  const [view, setView] = useState<"drawing" | "lapse">("drawing");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manual, setManual] = useState(!wallet);
  const [pasted, setPasted] = useState("");
  const pending = useRef(false);

  const claim = useCallback(
    async (address: string) => {
      setBusy(true);
      setError(null);
      try {
        onClaimed(await postClaim(code, address));
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setBusy(false);
        pending.current = false;
      }
    },
    [code, onClaimed],
  );

  // After the login modal closes with a wallet, finish the claim automatically.
  useEffect(() => {
    if (pending.current && wallet?.address && !busy) claim(wallet.address);
  }, [wallet?.address, busy, claim]);

  function start(mode: "wallet" | "email") {
    if (!wallet) return;
    if (wallet.address) return claim(wallet.address);
    pending.current = true;
    wallet.connect(mode);
  }

  return (
    <main className="wrap">
      <header className="header">
        <img className="logo" src="/solanafaces.jpg" alt="" />
        <div>
          <div className="brand">Solanafaces</div>
          <div className="label">at Solana Spaces · Breakpoint London</div>
        </div>
      </header>

      <section className="section stack" style={{ paddingTop: 22, gap: 14 }}>
        <div className="row label" style={{ justifyContent: "space-between" }}>
          <span>Portrait No. {number}</span>
          <span>{dateLabel} · Olympia</span>
        </div>
        <h1 className="h1">
          This is you,
          <br />
          drawn by hand.
        </h1>

        {timelapseUrl && (
          <div className="tabs" role="tablist" aria-label="View" style={{ alignSelf: "flex-start" }}>
            <button className="tab" role="tab" aria-selected={view === "drawing"} onClick={() => setView("drawing")}>
              Drawing
            </button>
            <button className="tab" role="tab" aria-selected={view === "lapse"} onClick={() => setView("lapse")}>
              Timelapse
            </button>
          </div>
        )}

        <figure style={{ margin: 0 }} className="stack">
          {view === "drawing" || !timelapseUrl ? (
            <div className="paper">
              <img src={imageUrl} alt={`Hand-drawn graphite portrait, No. ${number}`} />
            </div>
          ) : (
            <video className="media-video" src={timelapseUrl} autoPlay muted loop playsInline controls />
          )}
          <figcaption className="label" style={{ textTransform: "none" }}>
            {view === "drawing" ? "Graphite on paper, 1/1 · HERSOID" : "The sitting, compressed · recorded at the booth"}
          </figcaption>
        </figure>
      </section>

      {herod && (
        <section className="note">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <span className="label" style={{ color: "var(--purple)" }}>
              The critic’s note
            </span>
            <span className="label" style={{ textTransform: "none" }}>
              Herod Hersché
            </span>
          </div>
          <p>{herod}</p>
        </section>
      )}

      <dl className="facts">
        <div>
          <dt>Artist</dt>
          <dd>HERSOID</dd>
        </div>
        <div>
          <dt>Edition</dt>
          <dd>1 of 1</dd>
        </div>
        <div>
          <dt>Chain</dt>
          <dd>Solana{devnet ? " (devnet test)" : ""}</dd>
        </div>
        <div>
          <dt>Cost to you</dt>
          <dd style={{ color: "var(--green)" }}>Free</dd>
        </div>
      </dl>

      <section className="section stack" style={{ marginTop: 28, gap: 14 }}>
        <label className="consent">
          <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
          <span>I’m happy for this portrait to be published permanently and publicly on Solana.</span>
        </label>

        {error && (
          <div className="error" role="alert">
            {error}
          </div>
        )}

        {busy ? (
          <button className="btn btn-primary" disabled aria-live="polite">
            <span className="spinner" aria-hidden="true" /> Minting your portrait…
          </button>
        ) : (
          <>
            {wallet && (
              <>
                <button className="btn btn-primary" disabled={!consent || !wallet.ready} onClick={() => start("wallet")}>
                  {wallet.address ? `Claim to ${wallet.address.slice(0, 4)}…${wallet.address.slice(-4)}` : "Claim to my wallet"}
                </button>
                {!wallet.address && (
                  <button className="btn btn-secondary" disabled={!consent || !wallet.ready} onClick={() => start("email")}>
                    No wallet? Claim with email
                  </button>
                )}
              </>
            )}

            {wallet && !manual && (
              <button
                className="small"
                style={{ background: "none", border: 0, color: "var(--mute)", textDecoration: "underline", cursor: "pointer" }}
                onClick={() => setManual(true)}
              >
                Or paste a wallet address
              </button>
            )}

            {manual && (
              <form
                className="stack"
                style={{ gap: 10 }}
                onSubmit={(e) => {
                  e.preventDefault();
                  claim(pasted.trim());
                }}
              >
                <label className="label" htmlFor="addr">
                  Your Solana wallet address
                </label>
                <input
                  id="addr"
                  className="input"
                  value={pasted}
                  onChange={(e) => setPasted(e.target.value)}
                  placeholder="e.g. 7xKX…9fQa"
                  autoComplete="off"
                  autoCapitalize="off"
                  spellCheck={false}
                />
                <button className={wallet ? "btn btn-quiet" : "btn btn-primary"} disabled={!consent || pasted.trim().length < 32}>
                  Claim to this address
                </button>
              </form>
            )}
          </>
        )}

        {!busy && wallet && !wallet.address && <WalletAppLinks />}

        <p className="small" style={{ textAlign: "center", margin: 0 }}>
          We cover the network fee. Email creates a wallet you own and can move to Phantom or Solflare any time.
        </p>
      </section>

      <footer className="footer">
        <span>HERSOID × Solana Spaces</span>
        <span>No. {number}</span>
      </footer>
    </main>
  );
}

function Success({ number, imageUrl, devnet, claimed }: Props & { claimed: Claimed }) {
  const share = encodeURIComponent(
    `I sat for HERSOID at Solana Spaces, Breakpoint London. Portrait No. ${number}, drawn by hand and minted on Solana. #Solanafaces`,
  );
  return (
    <main className="wrap" style={{ padding: "24px 20px 26px" }}>
      <div className="row label" style={{ justifyContent: "space-between" }}>
        <span>Solanafaces</span>
        <span>No. {number}</span>
      </div>
      <div className="stack" style={{ alignItems: "center", marginTop: 36, gap: 22 }}>
        <div className="paper" style={{ width: 210, padding: 8, transform: "rotate(-2deg)", boxShadow: "0 20px 50px rgba(153,69,255,.28)" }}>
          <img src={imageUrl} alt={`Portrait No. ${number}`} />
        </div>
        <span className="ok-pill">✓ Minted on Solana{devnet ? " (devnet)" : ""}</span>
      </div>
      <h1 className="h1" style={{ marginTop: 22, fontSize: 28, textAlign: "center" }}>
        It’s in your wallet.
      </h1>
      <p style={{ margin: "10px 0 0", fontSize: 14, lineHeight: 1.5, color: "var(--soft)", textAlign: "center" }}>
        Portrait No. {number} now lives on-chain. The paper original is yours to take home.
      </p>
      <div className="panel mono stack" style={{ marginTop: 22, fontSize: 12, gap: 8, padding: "14px 16px" }}>
        <div className="row" style={{ justifyContent: "space-between" }}>
          <span style={{ color: "var(--mute)" }}>Wallet</span>
          <span>
            {claimed.owner.slice(0, 4)}…{claimed.owner.slice(-4)}
          </span>
        </div>
        <div className="row" style={{ justifyContent: "space-between" }}>
          <span style={{ color: "var(--mute)" }}>Transaction</span>
          <a href={claimed.txUrl} target="_blank" rel="noreferrer">
            View on Solscan
          </a>
        </div>
      </div>
      <div className="stack" style={{ marginTop: "auto", paddingTop: 32, gap: 10 }}>
        <a className="btn btn-primary" href={`https://x.com/intent/post?text=${share}`} target="_blank" rel="noreferrer">
          Share your portrait
        </a>
        <p className="small" style={{ textAlign: "center", margin: 0 }}>
          It can take a minute to appear in your wallet’s collectibles tab.
        </p>
      </div>
    </main>
  );
}
