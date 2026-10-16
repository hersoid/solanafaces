"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
import { encodeTimelapse, grabFrame, normalizePhoto } from "./timelapse";
import { stash, type Stashed } from "./stash";

type Portrait = {
  code: string;
  number: number;
  status: "reserved" | "captured" | "approved" | "minting" | "claimed";
  imageUrl?: string;
  herod?: string;
  sitterName?: string;
  lastError?: string;
};

type Stage = "idle" | "drawing" | "photo" | "encoding";

const pad = (n: number) => String(n).padStart(3, "0");

export default function BoothClient() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const frames = useRef<Blob[]>([]);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const [camError, setCamError] = useState<string | null>(null);
  const [stage, setStage] = useState<Stage>("idle");
  const [interval, setIntervalSec] = useState(4);
  const [elapsed, setElapsed] = useState(0);
  const [frameCount, setFrameCount] = useState(0);
  const [photo, setPhoto] = useState<Blob | null>(null);
  const [sitter, setSitter] = useState("");
  const [progress, setProgress] = useState(0);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!photo) return setPhotoUrl(null);
    const u = URL.createObjectURL(photo);
    setPhotoUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [photo]);

  const [next, setNext] = useState<number | null>(null);
  const [printed, setPrinted] = useState(0);
  const [portraits, setPortraits] = useState<Portrait[]>([]);
  const [pending, setPending] = useState<(Stashed & { number?: number; error?: string })[]>([]);
  const [lastCard, setLastCard] = useState<number | null>(null);
  const [online, setOnline] = useState(true);

  // ── server state ──
  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/booth/portrait", { cache: "no-store" });
      if (!res.ok) return;
      const data = await res.json();
      setNext(data.next);
      setPrinted(data.printed);
      setPortraits(data.portraits);
    } catch {}
  }, []);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 15000);
    const on = () => setOnline(navigator.onLine);
    on();
    window.addEventListener("online", on);
    window.addEventListener("offline", on);
    return () => {
      clearInterval(id);
      window.removeEventListener("online", on);
      window.removeEventListener("offline", on);
    };
  }, [refresh]);

  // ── camera ──
  useEffect(() => {
    let stream: MediaStream | null = null;
    navigator.mediaDevices
      ?.getUserMedia({
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1440 } },
        audio: false,
      })
      .then((s) => {
        stream = s;
        if (videoRef.current) videoRef.current.srcObject = s;
      })
      .catch((e) => setCamError(`Camera unavailable: ${e.message}. Allow camera access for this site.`));
    return () => stream?.getTracks().forEach((t) => t.stop());
  }, []);

  // ── uploads (run from the on-device stash, survive reloads) ──
  const uploading = useRef(false);
  const processStash = useCallback(async () => {
    if (uploading.current) return;
    uploading.current = true;
    try {
      const items = (await stash.all()).sort((a, b) => a.createdAt - b.createdAt);
      setPending(items);
      for (const item of items) {
        try {
          const base = `sittings/${item.id}`;
          const img = await upload(`${base}/photo.jpg`, item.photo, {
            access: "public",
            handleUploadUrl: "/api/booth/upload",
            contentType: "image/jpeg",
          });
          let lapseUrl: string | undefined;
          if (item.timelapse) {
            const ext = item.timelapse.type.includes("mp4") ? "mp4" : "webm";
            const vid = await upload(`${base}/timelapse.${ext}`, item.timelapse, {
              access: "public",
              handleUploadUrl: "/api/booth/upload",
              contentType: item.timelapse.type,
            });
            lapseUrl = vid.url;
          }
          const res = await fetch("/api/booth/portrait", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              imageUrl: img.url,
              timelapseUrl: lapseUrl,
              sitterName: item.sitterName,
              number: (item as Stashed & { number?: number }).number,
            }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error);
          await stash.remove(item.id);
          // ask Herod in the background
          fetch("/api/booth/herod", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ code: data.portrait.code }),
          }).finally(refresh);
        } catch (e) {
          setPending((list) => list.map((p) => (p.id === item.id ? { ...p, error: (e as Error).message } : p)));
        }
      }
      setPending(await stash.all());
      refresh();
    } finally {
      uploading.current = false;
    }
  }, [refresh]);

  useEffect(() => {
    processStash();
    const id = setInterval(processStash, 30000);
    return () => clearInterval(id);
  }, [processStash]);

  useEffect(() => {
    if (online) processStash();
  }, [online, processStash]);

  // ── the sitting ──
  function startSitting() {
    frames.current = [];
    setFrameCount(0);
    setElapsed(0);
    setPhoto(null);
    setSitter("");
    setStage("drawing");
    const started = Date.now();
    let lastShot = 0;
    timer.current = setInterval(async () => {
      const now = Date.now();
      setElapsed(Math.floor((now - started) / 1000));
      if (now - lastShot >= interval * 1000 && videoRef.current) {
        lastShot = now;
        try {
          frames.current.push(await grabFrame(videoRef.current, 960, 0.75));
          setFrameCount(frames.current.length);
        } catch {}
      }
    }, 500);
  }

  function finishDrawing() {
    if (timer.current) clearInterval(timer.current);
    setStage("photo");
  }

  async function useCameraFrame() {
    if (videoRef.current) setPhoto(await grabFrame(videoRef.current, 2400, 0.92));
  }

  async function save() {
    if (!photo) return;
    setStage("encoding");
    setProgress(0);
    let timelapse: Blob | null = null;
    try {
      timelapse = await encodeTimelapse(frames.current, photo, { onProgress: setProgress });
    } catch {
      timelapse = null; // the drawing still goes through without a film
    }
    const number = next ?? undefined;
    const item: Stashed & { number?: number } = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      photo,
      timelapse: timelapse ?? undefined,
      sitterName: sitter.trim() || undefined,
      createdAt: Date.now(),
      number,
    };
    await stash.put(item);
    if (number) {
      setLastCard(number);
      setNext(number + 1);
    }
    frames.current = [];
    setStage("idle");
    setPhoto(null);
    processStash();
  }

  const toApprove = portraits.filter((p) => p.status === "captured");
  const cardsLeft = next ? printed - next + 1 : 0;
  const mm = String(Math.floor(elapsed / 60)).padStart(2, "0");
  const ss = String(elapsed % 60).padStart(2, "0");

  return (
    <main className="wide">
      <div className="row" style={{ justifyContent: "space-between", marginBottom: 18 }}>
        <div className="row">
          <img className="logo" src="/solanafaces.jpg" alt="" style={{ width: 40, height: 40 }} />
          <div>
            <div className="brand">Booth</div>
            <div className="label">
              {online ? "Online" : "Offline — drawings are saved on this device"}
              {pending.length > 0 && ` · ${pending.length} waiting to upload`}
            </div>
          </div>
        </div>
        <div className="row">
          <a className="btn btn-quiet btn-sm" href="/booth/cards">
            Cards
          </a>
          <a className="btn btn-quiet btn-sm" href="/booth/setup">
            Setup
          </a>
        </div>
      </div>

      {lastCard && stage === "idle" && (
        <div className="panel row" style={{ marginBottom: 16, borderColor: "var(--green)", justifyContent: "space-between" }}>
          <div>
            <div className="label">Give the sitter</div>
            <div style={{ fontSize: 28, fontWeight: 700 }}>Card No. {pad(lastCard)}</div>
          </div>
          <button className="btn btn-quiet btn-sm" onClick={() => setLastCard(null)}>
            Done
          </button>
        </div>
      )}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 20 }}>
        {/* camera + controls */}
        <section style={{ flex: "999 1 520px", minWidth: 0 }} className="stack">
          <div style={{ position: "relative", background: "#000", borderRadius: 10, overflow: "hidden", aspectRatio: "4 / 3" }}>
            <video ref={videoRef} autoPlay playsInline muted style={{ width: "100%", height: "100%", objectFit: "contain", display: stage === "photo" && photo ? "none" : "block" }} />
            {stage === "photo" && photo && (
              <img src={photoUrl ?? undefined} alt="Final photo" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
            )}
            {stage === "drawing" && (
              <div className="mono" style={{ position: "absolute", top: 12, left: 12, padding: "6px 10px", borderRadius: 6, background: "rgba(0,0,0,.6)", fontSize: 13 }}>
                ● REC {mm}:{ss} · {frameCount} frames
              </div>
            )}
            {camError && (
              <div className="error" style={{ position: "absolute", inset: 16, height: "fit-content" }}>
                {camError}
              </div>
            )}
          </div>

          {stage === "idle" && (
            <div className="stack">
              <div className="row" style={{ justifyContent: "space-between" }}>
                <div>
                  <div className="label">Next card</div>
                  <div className="row" style={{ gap: 8 }}>
                    <span style={{ fontSize: 22, fontWeight: 700 }}>{next ? `No. ${pad(next)}` : "—"}</span>
                    <button
                      className="small"
                      style={{ background: "none", border: 0, color: "var(--mute)", textDecoration: "underline", cursor: "pointer" }}
                      onClick={async () => {
                        const v = Number(prompt("Use which card number next?", String(next ?? 1)));
                        if (!v || v < 1) return;
                        await fetch("/api/booth/portrait", {
                          method: "PATCH",
                          headers: { "content-type": "application/json" },
                          body: JSON.stringify({ setNext: v }),
                        });
                        refresh();
                      }}
                    >
                      change
                    </button>
                  </div>
                </div>
                <label className="label row" style={{ gap: 8 }}>
                  Frame every
                  <select className="input" style={{ width: 90, height: 40 }} value={interval} onChange={(e) => setIntervalSec(Number(e.target.value))}>
                    {[2, 3, 4, 6, 8].map((s) => (
                      <option key={s} value={s}>
                        {s}s
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              {next && cardsLeft <= 5 && (
                <div className="error">
                  {cardsLeft <= 0 ? "No printed cards left." : `Only ${cardsLeft} printed card${cardsLeft === 1 ? "" : "s"} left.`} Print more from Cards.
                </div>
              )}
              <button className="btn btn-primary" onClick={startSitting} disabled={!!camError}>
                Start sitting
              </button>
            </div>
          )}

          {stage === "drawing" && (
            <button className="btn btn-primary" onClick={finishDrawing}>
              Finished drawing
            </button>
          )}

          {stage === "photo" && (
            <div className="stack">
              <div className="row" style={{ gap: 10 }}>
                <button className="btn btn-quiet" style={{ flex: 1 }} onClick={() => fileRef.current?.click()}>
                  Take final photo
                </button>
                <button className="btn btn-quiet" style={{ flex: 1 }} onClick={useCameraFrame}>
                  Use live frame
                </button>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                capture="environment"
                hidden
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (f) setPhoto(await normalizePhoto(f));
                  e.target.value = "";
                }}
              />
              <label className="label" htmlFor="sitter">
                Sitter’s first name or handle (optional, goes on-chain)
              </label>
              <input id="sitter" className="input" value={sitter} onChange={(e) => setSitter(e.target.value)} maxLength={40} />
              <div className="row" style={{ gap: 10 }}>
                <button className="btn btn-quiet" style={{ flex: 1 }} onClick={() => setStage("drawing")}>
                  Back
                </button>
                <button className="btn btn-primary" style={{ flex: 2 }} disabled={!photo} onClick={save}>
                  Save portrait{next ? ` to card No. ${pad(next)}` : ""}
                </button>
              </div>
            </div>
          )}

          {stage === "encoding" && (
            <div className="panel row">
              <span className="spinner" aria-hidden="true" /> Making the timelapse… {Math.round(progress * 100)}%
              <span className="small">Keep this screen open.</span>
            </div>
          )}
        </section>

        {/* approvals + recent */}
        <aside style={{ flex: "1 1 320px", minWidth: 0 }} className="stack">
          <div className="label">Herod awaiting your approval ({toApprove.length})</div>
          {toApprove.length === 0 && <div className="small">Nothing waiting.</div>}
          {toApprove.map((p) => (
            <Approval key={p.code} p={p} onDone={refresh} />
          ))}

          {pending.map((p) => (
            <div key={p.id} className="panel small">
              Uploading {p.number ? `No. ${pad(p.number)}` : "drawing"}…{p.error && <div style={{ color: "#ffb3b3" }}>{p.error}</div>}
            </div>
          ))}

          <div className="label" style={{ marginTop: 12 }}>
            Recent
          </div>
          {portraits
            .filter((p) => p.status !== "reserved")
            .slice(0, 12)
            .map((p) => (
              <div key={p.code} className="panel" style={{ padding: 10 }}>
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <a className="mono" href={`/c/${p.code}`} target="_blank" rel="noreferrer" style={{ color: "var(--ink)" }}>
                    No. {pad(p.number)}
                  </a>
                  <span className="label" style={{ color: p.status === "claimed" ? "var(--green)" : undefined }}>
                    {p.status === "approved" ? "ready to claim" : p.status}
                  </span>
                </div>
                {p.lastError && p.status !== "claimed" && (
                  <div className="small" style={{ color: "#ffb3b3", marginTop: 6 }}>
                    Last claim attempt failed: {p.lastError}
                  </div>
                )}
              </div>
            ))}
        </aside>
      </div>
    </main>
  );
}

function Approval({ p, onDone }: { p: Portrait; onDone: () => void }) {
  const [text, setText] = useState(p.herod ?? "");
  const [busy, setBusy] = useState<"redraft" | "approve" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => setText(p.herod ?? ""), [p.herod]);

  async function redraft() {
    setBusy("redraft");
    setError(null);
    const res = await fetch("/api/booth/herod", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code: p.code }),
    });
    const data = await res.json();
    setBusy(null);
    if (res.ok) setText(data.herod);
    else setError(data.error);
  }

  async function approve() {
    setBusy("approve");
    setError(null);
    const res = await fetch("/api/booth/portrait", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code: p.code, herod: text, approve: true }),
    });
    setBusy(null);
    if (res.ok) onDone();
    else setError((await res.json()).error);
  }

  return (
    <div className="panel stack" style={{ gap: 10 }}>
      <div className="row" style={{ alignItems: "flex-start" }}>
        {p.imageUrl && <img src={p.imageUrl} alt="" style={{ width: 64, borderRadius: 4, background: "#fff" }} />}
        <div className="mono" style={{ fontSize: 13 }}>
          No. {pad(p.number)}
          {p.sitterName ? ` · ${p.sitterName}` : ""}
        </div>
      </div>
      {text ? (
        <textarea className="input" rows={7} value={text} onChange={(e) => setText(e.target.value)} aria-label={`Herod's note for No. ${pad(p.number)}`} />
      ) : (
        <div className="row small">
          <span className="spinner" aria-hidden="true" /> Herod is writing…
        </div>
      )}
      {error && <div className="error">{error}</div>}
      <div className="row">
        <button className="btn btn-quiet btn-sm" onClick={redraft} disabled={!!busy}>
          {busy === "redraft" ? "Writing…" : text ? "Another draft" : "Ask Herod"}
        </button>
        <button className="btn btn-primary btn-sm" onClick={approve} disabled={!text || !!busy}>
          {busy === "approve" ? "Saving…" : "Approve"}
        </button>
      </div>
    </div>
  );
}
