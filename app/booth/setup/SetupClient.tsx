"use client";
import { useEffect, useState } from "react";

type Status = {
  cluster: string;
  driver: string;
  royaltyBps: number;
  minter: string | null;
  minterUrl: string | null;
  collection: string | null;
  collectionUrl: string | null;
  balance: number | null;
  checks: { name: string; ok: boolean; note: string }[];
};

export default function SetupClient() {
  const [s, setS] = useState<Status | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  async function load() {
    try {
      const res = await fetch("/api/booth/setup", { cache: "no-store" });
      const text = await res.text();
      let data: (Status & { error?: string }) | null = null;
      try {
        data = JSON.parse(text);
      } catch {}
      if (res.ok && data) {
        setS(data);
        setLoadError(null);
      } else setLoadError(`Setup check failed (${res.status}): ${data?.error ?? text.slice(0, 400)}`);
    } catch (e) {
      setLoadError(`Setup check failed: ${(e as Error).message}`);
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function act(action: string) {
    setBusy(action);
    setMsg(null);
    const res = await fetch("/api/booth/setup", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action }),
    });
    const data = await res.json();
    setBusy(null);
    if (action === "create-collection") {
      if (res.ok)
        setMsg({
          ok: true,
          text: `Collection created: ${data.collection}\n\nCopy that address into COLLECTION_ADDRESS in Vercel, then redeploy.\nTransaction: ${data.txUrl}`,
        });
      else setMsg({ ok: false, text: data.error });
    } else {
      setMsg({ ok: !!data.ok, text: data.detail ?? data.error });
    }
    load();
  }

  return (
    <main className="wide stack" style={{ maxWidth: 720 }}>
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div>
          <div className="brand">Setup</div>
          <div className="label">
            {s ? `${s.cluster} · mint engine: ${s.driver} · royalty ${s.royaltyBps / 100}%` : "Loading…"}
          </div>
        </div>
        <a className="btn btn-quiet btn-sm" href="/booth">
          Back to booth
        </a>
      </div>

      {loadError && <div className="error" style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>{loadError}</div>}

      {s?.cluster === "devnet" && (
        <div className="panel small">
          You’re on <strong>devnet</strong> (test network, free test SOL). Get test SOL for the minting wallet at{" "}
          <a href="https://faucet.solana.com" target="_blank" rel="noreferrer">
            faucet.solana.com
          </a>
          {s.minter && (
            <>
              {" "}
              — paste <span className="mono">{s.minter}</span>
            </>
          )}
          .
        </div>
      )}

      <div className="panel stack" style={{ gap: 0, padding: 0 }}>
        {s?.checks.map((c) => (
          <div key={c.name} className="row" style={{ justifyContent: "space-between", padding: "12px 16px", borderBottom: "1px solid var(--line)" }}>
            <span>
              <span style={{ color: c.ok ? "var(--green)" : "#ffb3b3", marginRight: 10 }} aria-label={c.ok ? "OK" : "Needs attention"}>
                {c.ok ? "●" : "○"}
              </span>
              {c.name}
            </span>
            <span className="small" style={{ textAlign: "right", maxWidth: "60%" }}>
              {c.note}
            </span>
          </div>
        ))}
      </div>

      {s?.minterUrl && (
        <p className="small">
          Minting wallet on Solscan:{" "}
          <a href={s.minterUrl} target="_blank" rel="noreferrer">
            {s.minter}
          </a>
          {s.collectionUrl && (
            <>
              <br />
              Collection:{" "}
              <a href={s.collectionUrl} target="_blank" rel="noreferrer">
                {s.collection}
              </a>
            </>
          )}
        </p>
      )}

      <div className="row">
        <button className="btn btn-primary btn-sm" disabled={!!busy || !s || !!s.collection} onClick={() => act("create-collection")}>
          {busy === "create-collection" ? "Creating…" : s?.collection ? "Collection exists" : "Create collection"}
        </button>
        <button className="btn btn-quiet btn-sm" disabled={!!busy || !s?.collection} onClick={() => act("mallow-dry-run")}>
          {busy === "mallow-dry-run" ? "Asking mallow…" : "mallow dry run (free, sends nothing)"}
        </button>
      </div>

      {msg && (
        <div className={msg.ok ? "panel" : "error"} style={{ whiteSpace: "pre-line", wordBreak: "break-all" }}>
          {msg.text}
        </div>
      )}
    </main>
  );
}
