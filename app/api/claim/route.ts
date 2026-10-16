import { mintPortrait } from "@/lib/mint";
import { explorerTx, isValidAddress } from "@/lib/solana";
import { acquireLock, getPortrait, releaseLock, savePortrait } from "@/lib/store";

export const maxDuration = 120;

export async function POST(req: Request) {
  const { code, address, consent } = (await req.json().catch(() => ({}))) as {
    code?: string;
    address?: string;
    consent?: boolean;
  };
  if (!consent) return Response.json({ error: "Please tick the consent box first." }, { status: 400 });
  if (!address || !isValidAddress(address)) return Response.json({ error: "That doesn't look like a Solana wallet address." }, { status: 400 });

  const p = code ? await getPortrait(code) : null;
  if (!p) return Response.json({ error: "We can't find this card." }, { status: 404 });
  if (p.status === "claimed") return Response.json({ error: "This portrait has already been claimed.", owner: p.owner }, { status: 409 });
  if (p.status !== "approved")
    return Response.json({ error: "Your portrait isn't ready yet — the critic is still writing. Try again in a few minutes." }, { status: 425 });

  if (!(await acquireLock(p.code))) return Response.json({ error: "Already minting — hang on a moment." }, { status: 409 });
  try {
    const claimed = await mintPortrait(p, address);
    await savePortrait(claimed);
    return Response.json({ ok: true, asset: claimed.asset, txUrl: explorerTx(claimed.signature!) });
  } catch (e) {
    const message = (e as Error).message;
    // Keep any finished uploads so a retry doesn't pay for them twice.
    await savePortrait({ ...p, lastError: message.slice(0, 500) });
    console.error("claim failed", p.number, message);
    return Response.json({ error: "Minting hit a snag. Please try again in a minute — nothing was charged to you." }, { status: 500 });
  } finally {
    await releaseLock(p.code);
  }
}
