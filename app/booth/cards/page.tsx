import QRCode from "qrcode";
import { isBooth } from "@/lib/auth";
import { cardCount, getByNumber, type Portrait } from "@/lib/store";
import { pad } from "@/lib/metadata";
import Login from "../Login";
import ReserveForm from "./ReserveForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Claim cards · Solanafaces", robots: { index: false } };

export default async function CardsPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  if (!(await isBooth())) return <Login />;
  const sp = await searchParams;
  const total = await cardCount();
  const from = Math.max(1, Number(sp.from) || Math.max(1, total - 9));
  const to = Math.min(total, Number(sp.to) || total);
  const site = (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "");

  const cards: { p: Portrait; svg: string }[] = [];
  for (let n = from; n <= to && cards.length < 100; n++) {
    const p = await getByNumber(n);
    if (!p) continue;
    const svg = await QRCode.toString(`${site}/c/${p.code}`, { type: "svg", margin: 0, errorCorrectionLevel: "M", color: { dark: "#0b0b10", light: "#ffffff" } });
    cards.push({ p, svg });
  }

  return (
    <main>
      <style>{`
        @page { size: A4; margin: 10mm; }
        .sheet { display: grid; grid-template-columns: repeat(2, 88mm); gap: 4mm; justify-content: center; padding: 8mm 0; }
        .card { width: 88mm; height: 55mm; background: #fff; color: #0b0b10; display: flex; overflow: hidden; border: 0.2mm dashed #c8c8d0; break-inside: avoid; font-family: var(--sans); }
        .card .art { width: 36mm; height: 55mm; overflow: hidden; flex-shrink: 0; }
        .card .art img { width: 55mm; height: 55mm; margin-left: -9mm; object-fit: cover; display: block; }
        .card .body { flex: 1; padding: 3.5mm 4mm 3mm; display: flex; flex-direction: column; }
        .card .top { display: flex; justify-content: space-between; font-family: var(--mono); font-size: 6.5pt; letter-spacing: .06em; text-transform: uppercase; color: #55556a; }
        .card .mid { margin-top: 2.5mm; display: flex; gap: 3mm; align-items: center; }
        .card .qr { width: 19mm; height: 19mm; flex-shrink: 0; }
        .card .qr svg { width: 100%; height: 100%; display: block; }
        .card .cta { font-size: 9pt; font-weight: 700; line-height: 1.15; }
        .card .sub { margin-top: 1mm; font-size: 6.5pt; line-height: 1.35; color: #3a3a48; }
        .card .foot { margin-top: auto; padding-top: 2mm; border-top: 0.2mm solid #dcdce4; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 1.5mm; font-family: var(--mono); font-size: 5.5pt; text-transform: uppercase; letter-spacing: .04em; }
        .card .foot span:first-child { color: #6a6a7c; display: block; }
        @media print { .sheet { padding: 0; } .card { border-color: #e2e2e8; } }
      `}</style>

      <div className="wide no-print stack">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <div>
            <div className="brand">Claim cards</div>
            <div className="label">
              {total} printed so far · showing {cards.length ? `No. ${pad(from)}–${pad(to)}` : "none"}
            </div>
          </div>
          <a className="btn btn-quiet btn-sm" href="/booth">
            Back to booth
          </a>
        </div>
        {!site && <div className="error">Set NEXT_PUBLIC_SITE_URL before printing, or the QR codes won’t point anywhere.</div>}
        <ReserveForm total={total} />
        <p className="small">
          Print on A4 at 100% scale (no “fit to page”), then cut along the dashed lines. Each card’s QR code is unique; never
          print the same range twice.
        </p>
      </div>

      <div className="sheet">
        {cards.map(({ p, svg }) => (
          <div className="card" key={p.code}>
            <div className="art">
              <img src="/solanafaces.jpg" alt="" />
            </div>
            <div className="body">
              <div className="top">
                <span>Certificate of sitting</span>
                <span>No. {pad(p.number)}</span>
              </div>
              <div className="mid">
                <div className="qr" dangerouslySetInnerHTML={{ __html: svg }} />
                <div>
                  <div className="cta">Scan to claim your portrait on Solana</div>
                  <div className="sub">Free. No wallet needed: you can claim with email.</div>
                </div>
              </div>
              <div className="foot">
                <div>
                  <span>Artist</span>HERSOID
                </div>
                <div>
                  <span>Venue</span>Solana Spaces
                </div>
                <div>
                  <span>Event</span>Breakpoint ’26
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
