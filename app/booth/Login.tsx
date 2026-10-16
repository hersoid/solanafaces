"use client";
import { useState } from "react";

export default function Login() {
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <main className="wrap" style={{ justifyContent: "center", padding: 24 }}>
      <form
        className="stack"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          setError(null);
          const res = await fetch("/api/booth/login", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ pin }),
          });
          setBusy(false);
          if (res.ok) location.reload();
          else setError((await res.json()).error ?? "Wrong PIN.");
        }}
      >
        <div className="row">
          <img className="logo" src="/solanafaces.jpg" alt="" />
          <div>
            <div className="brand">Booth</div>
            <div className="label">Solanafaces · staff only</div>
          </div>
        </div>
        <label className="label" htmlFor="pin">
          Booth PIN
        </label>
        <input id="pin" className="input" type="password" value={pin} onChange={(e) => setPin(e.target.value)} autoFocus />
        {error && <div className="error">{error}</div>}
        <button className="btn btn-primary" disabled={busy || !pin}>
          Unlock
        </button>
      </form>
    </main>
  );
}
