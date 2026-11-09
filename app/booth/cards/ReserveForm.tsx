"use client";
import { useState } from "react";

export default function ReserveForm({
  total,
  from,
  to,
  devnet,
}: {
  total: number;
  from: number;
  to: number;
  devnet: boolean;
}) {
  const [count, setCount] = useState(50);
  const [busy, setBusy] = useState<"make" | "reset" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const pad = (n: number) => String(n).padStart(3, "0");

  async function make() {
    setBusy("make");
    setError(null);
    const res = await fetch("/api/booth/cards", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ count }),
    });
    const data = await res.json();
    setBusy(null);
    if (res.ok) location.href = `/booth/cards?from=${data.first}&to=${data.last}`;
    else setError(data.error);
  }

  async function reset() {
    const typed = prompt(
      `This deletes all ${total} cards and every rehearsal portrait, so numbering starts again at No. 001.\n\nAny cards already printed will stop working.\n\nType RESET to confirm.`,
    );
    if (typed !== "RESET") return;
    setBusy("reset");
    setError(null);
    const res = await fetch("/api/booth/cards", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ confirm: "RESET" }),
    });
    const data = await res.json();
    setBusy(null);
    if (res.ok) {
      setNote("Rehearsal cleared. Numbering starts at No. 001.");
      location.href = "/booth/cards";
    } else setError(data.error);
  }

  return (
    <div className="stack">
      {total > 0 && (
        <div className="panel stack" style={{ borderColor: "var(--green)" }}>
          <div className="label">For the print shop</div>
          <div className="row">
            <a className="btn btn-primary btn-sm" href={`/api/booth/cards/pdf?from=${from}&to=${to}`}>
              Download A6 postcards, No. {pad(from)}–{pad(to)} (PDF)
            </a>
          </div>
          <div className="small">
            A6 portrait, 105 × 148 mm, 3 mm bleed on every side, one card per page, single-sided. Tell the printer:
            &ldquo;variable data, print in page order, keep the stack in order&rdquo;. Takes up to a minute for 250 cards.
          </div>
        </div>
      )}

      <div className="row panel">
        <label className="label row" style={{ gap: 8 }}>
          Make
          <input
            className="input"
            type="number"
            min={1}
            max={300}
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
            style={{ width: 90, height: 40 }}
          />
          new cards
        </label>
        <button className="btn btn-primary btn-sm" disabled={!!busy || count < 1} onClick={make}>
          {busy === "make" ? "Making…" : "Make and show"}
        </button>
        {total > 0 && (
          <a className="small" href={`/booth/cards?from=1&to=${total}`}>
            Show all {total}
          </a>
        )}
      </div>

      {devnet && total > 0 && (
        <div className="row panel" style={{ justifyContent: "space-between" }}>
          <div className="small" style={{ maxWidth: 520 }}>
            <strong style={{ color: "var(--ink)" }}>Reset rehearsal.</strong> Deletes all {total} cards and test portraits so
            the event starts at No. 001. Only available on devnet.
          </div>
          <button className="btn btn-quiet btn-sm" style={{ color: "#ffb3b3" }} disabled={!!busy} onClick={reset}>
            {busy === "reset" ? "Clearing…" : "Reset rehearsal"}
          </button>
        </div>
      )}

      {note && <div className="panel small">{note}</div>}
      {error && <div className="error">{error}</div>}
    </div>
  );
}
