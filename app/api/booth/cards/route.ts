import { requireBooth } from "@/lib/auth";
import { reserveCards, resetAll } from "@/lib/store";

/** Reserve a batch of new claim cards (each gets a number and a secret QR code). */
export async function POST(req: Request) {
  const denied = await requireBooth();
  if (denied) return denied;
  const { count } = (await req.json()) as { count?: number };
  const n = Math.max(1, Math.min(300, Math.floor(count ?? 0)));
  const cards = await reserveCards(n);
  return Response.json({ first: cards[0].number, last: cards[cards.length - 1].number });
}

/**
 * Clears all rehearsal cards and portraits so the event starts at No. 001.
 * Only allowed on devnet: on mainnet, claimed portraits are real and their cards must keep working.
 */
export async function DELETE(req: Request) {
  const denied = await requireBooth();
  if (denied) return denied;
  const { confirm } = (await req.json().catch(() => ({}))) as { confirm?: string };
  if (confirm !== "RESET") return Response.json({ error: 'Type RESET to confirm.' }, { status: 400 });
  if (process.env.SOLANA_CLUSTER === "mainnet-beta")
    return Response.json({ error: "Reset is switched off on mainnet, so real portraits can never be orphaned." }, { status: 403 });
  const deleted = await resetAll();
  return Response.json({ ok: true, deleted });
}
