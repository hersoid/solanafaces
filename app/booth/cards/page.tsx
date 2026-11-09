import QRCode from "qrcode";
import { isBooth } from "@/lib/auth";
import { cardCount, getRange } from "@/lib/store";
import { pad } from "@/lib/metadata";
import Login from "../Login";
import ReserveForm from "./ReserveForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Claim cards · Solanafaces", robots: { index: false } };

const QR_LIMIT = 12; // on-screen QR codes only for small ranges, e.g. spare test cards

const statusLabel: Record<string, string> = {
  reserved: "not drawn",
  captured: "Herod writing",
  approved: "ready to claim",
  minting: "minting",
  claimed: "claimed",
  void: "void",
};

export default async function CardsPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  if (!(await isBooth())) return <Login />;
  const sp = await searchParams;
  const total = await cardCount();
  const from = Math.max(1, Number(sp.from) || 1);
  const to = Math.min(total, Number(sp.to) || total);
  const site = (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "");

  const cards = total ? await getRange(from, to) : [];
  const showQr = cards.length <= QR_LIMIT;
  const qrs = showQr
    ? await Promise.all(
        cards.map((p) =>
          QRCode.toString(`${site}/c/${p.code}`, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#0b0b10", light: "#ffffff" } }),
        ),
      )
    : [];

  return (
    <main className="wide stack">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div>
          <div className="brand">Claim cards</div>
          <div className="label">
            {total} made so far · showing {cards.length ? `No. ${pad(from)}–${pad(to)}` : "none"}
          </div>
        </div>
        <a className="btn btn-quiet btn-sm" href="/booth">
          Back to booth
        </a>
      </div>
      {!site && <div className="error">Set NEXT_PUBLIC_SITE_URL before printing, or the QR codes won&rsquo;t point anywhere.</div>}
      <ReserveForm total={total} from={from} to={to} devnet={process.env.SOLANA_CLUSTER !== "mainnet-beta"} />

      {cards.length > 0 && (
        <div className="panel" style={{ padding: 0 }}>
          {!showQr && (
            <div className="small" style={{ padding: "12px 16px", borderBottom: "1px solid var(--line)" }}>
              To scan a card from this screen (a spare test card, say), show {QR_LIMIT} or fewer, e.g.{" "}
              <a href={`/booth/cards?from=${to}&to=${to}`}>just No. {pad(to)}</a>.
            </div>
          )}
          {cards.map((p, i) => (
            <div
              key={p.code}
              className="row"
              style={{ padding: "10px 16px", borderBottom: "1px solid var(--line)", justifyContent: "space-between", alignItems: "center" }}
            >
              <div className="row" style={{ gap: 16 }}>
                {showQr && (
                  <div
                    style={{ width: 96, height: 96, background: "#fff", borderRadius: 4, padding: 2 }}
                    dangerouslySetInnerHTML={{ __html: qrs.at(i) ?? "" }}
                  />
                )}
                <a className="mono" href={`/c/${p.code}`} target="_blank" rel="noreferrer" style={{ color: "var(--ink)" }}>
                  No. {pad(p.number)}
                </a>
              </div>
              <span className="label" style={{ color: p.status === "claimed" ? "var(--green)" : p.status === "void" ? "#ffb3b3" : undefined }}>
                {statusLabel[p.status] ?? p.status}
              </span>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
