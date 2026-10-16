"use client";
import { useState } from "react";

export default function ReserveForm({ total }: { total: number }) {
  const [count, setCount] = useState(40);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="row panel">
      <label className="label row" style={{ gap: 8 }}>
        Make
        <input
          className="input"
          type="number"
          min={1}
          max={200}
          value={count}
          onChange={(e) => setCount(Number(e.target.value))}
          style={{ width: 90, height: 40 }}
        />
        new cards
      </label>
      <button
        className="btn btn-primary btn-sm"
        disabled={busy || count < 1}
        onClick={async () => {
          setBusy(true);
          setError(null);
          const res = await fetch("/api/booth/cards", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ count }),
          });
          const data = await res.json();
          setBusy(false);
          if (res.ok) location.href = `/booth/cards?from=${data.first}&to=${data.last}`;
          else setError(data.error);
        }}
      >
        {busy ? "Making…" : "Make and show"}
      </button>
      {total > 0 && (
        <a className="small" href={`/booth/cards?from=1&to=${total}`}>
          Show all {total}
        </a>
      )}
      <button className="btn btn-quiet btn-sm" onClick={() => window.print()}>
        Print this sheet
      </button>
      {error && <div className="error">{error}</div>}
    </div>
  );
}
