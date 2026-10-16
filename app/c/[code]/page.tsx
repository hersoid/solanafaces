import { notFound } from "next/navigation";
import { getPortrait } from "@/lib/store";
import { cluster, explorerAddress, explorerTx } from "@/lib/solana";
import { pad } from "@/lib/metadata";
import ClaimClient from "./ClaimClient";
import AutoRefresh from "./AutoRefresh";

export const dynamic = "force-dynamic";

function Header() {
  return (
    <header className="header">
      <img className="logo" src="/solanafaces.jpg" alt="" />
      <div>
        <div className="brand">Solanafaces</div>
        <div className="label">at Solana Spaces · Breakpoint London</div>
      </div>
    </header>
  );
}

export default async function ClaimPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const p = await getPortrait(code);
  if (!p) notFound();

  const dateLabel = new Date(p.capturedAt ?? p.createdAt).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "Europe/London",
  });

  if (p.status === "reserved" || p.status === "captured") {
    return (
      <main className="wrap">
        <Header />
        <section className="section stack" style={{ paddingTop: 32 }}>
          <div className="label">Portrait No. {pad(p.number)}</div>
          <h1 className="h1">{p.status === "reserved" ? "Not drawn yet." : "The critic is writing."}</h1>
          <p style={{ margin: 0, color: "var(--soft)", lineHeight: 1.55 }}>
            {p.status === "reserved"
              ? "This card hasn't been matched to a drawing yet. If you've just sat for your portrait, give it a minute."
              : "Your drawing is in. Herod Hersché is composing his verdict, which takes as long as it takes. This page will update by itself."}
          </p>
          <AutoRefresh seconds={20} />
        </section>
      </main>
    );
  }

  if (p.status === "claimed" || p.status === "minting") {
    return (
      <main className="wrap">
        <Header />
        <section className="section stack" style={{ paddingTop: 28, alignItems: "center", textAlign: "center" }}>
          <div className="paper" style={{ width: 220, transform: "rotate(-2deg)", boxShadow: "0 20px 50px rgba(153,69,255,.28)" }}>
            <img src={p.arweaveImage ?? p.imageUrl} alt={`Portrait No. ${pad(p.number)}`} />
          </div>
          <span className="ok-pill">On Solana{cluster() === "devnet" ? " (devnet)" : ""}</span>
          <h1 className="h1" style={{ fontSize: 28 }}>Portrait No. {pad(p.number)} has been claimed.</h1>
          {p.owner && (
            <p className="small mono">
              Held by <a href={explorerAddress(p.owner)}>{p.owner.slice(0, 4)}…{p.owner.slice(-4)}</a>
              {p.signature && (
                <>
                  {" · "}
                  <a href={explorerTx(p.signature)}>transaction</a>
                </>
              )}
            </p>
          )}
        </section>
      </main>
    );
  }

  return (
    <ClaimClient
      code={p.code}
      number={pad(p.number)}
      dateLabel={dateLabel}
      imageUrl={p.imageUrl!}
      timelapseUrl={p.timelapseUrl}
      herod={p.herod ?? ""}
      devnet={cluster() === "devnet"}
      privyAppId={process.env.NEXT_PUBLIC_PRIVY_APP_ID || null}
    />
  );
}
