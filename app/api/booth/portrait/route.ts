import { requireBooth } from "@/lib/auth";
import {
  cardCount,
  getByNumber,
  getPortrait,
  listPortraits,
  nextCardNumber,
  savePortrait,
  setNextCardNumber,
} from "@/lib/store";

export const dynamic = "force-dynamic";

/** Booth overview: every card and its status, plus the next card to use. */
export async function GET() {
  const denied = await requireBooth();
  if (denied) return denied;
  const [portraits, next, printed] = await Promise.all([listPortraits(), nextCardNumber(), cardCount()]);
  return Response.json({
    next,
    printed,
    portraits: portraits.map(({ code, ...rest }) => ({ ...rest, code })),
  });
}

/** A finished drawing: attach photo + timelapse to the next printed card. */
export async function POST(req: Request) {
  const denied = await requireBooth();
  if (denied) return denied;
  const body = (await req.json()) as { imageUrl?: string; timelapseUrl?: string; sitterName?: string; number?: number };
  if (!body.imageUrl) return Response.json({ error: "Photo missing." }, { status: 400 });

  const number = body.number ?? (await nextCardNumber());
  const card = await getByNumber(number);
  if (!card) return Response.json({ error: `Card No. ${number} has not been printed yet. Print more cards first.` }, { status: 400 });
  if (card.status !== "reserved") return Response.json({ error: `Card No. ${number} is already used.` }, { status: 409 });

  const updated = {
    ...card,
    status: "captured" as const,
    imageUrl: body.imageUrl,
    timelapseUrl: body.timelapseUrl,
    sitterName: body.sitterName?.trim().slice(0, 40) || undefined,
    capturedAt: new Date().toISOString(),
  };
  await savePortrait(updated);
  if (number >= (await nextCardNumber())) await setNextCardNumber(number + 1);
  return Response.json({ portrait: updated });
}

/** Approve (or edit) Herod's note, change the sitter's name, or set the next card number. */
export async function PATCH(req: Request) {
  const denied = await requireBooth();
  if (denied) return denied;
  const body = (await req.json()) as {
    code?: string;
    herod?: string;
    sitterName?: string;
    approve?: boolean;
    setNext?: number;
  };
  if (typeof body.setNext === "number" && body.setNext >= 1) {
    await setNextCardNumber(Math.floor(body.setNext));
    return Response.json({ ok: true });
  }
  const p = body.code ? await getPortrait(body.code) : null;
  if (!p) return Response.json({ error: "Card not found." }, { status: 404 });
  if (p.status === "claimed" || p.status === "minting")
    return Response.json({ error: "Already claimed — it can no longer be edited." }, { status: 409 });

  const herod = typeof body.herod === "string" ? body.herod.trim() : p.herod;
  if (body.approve && !herod) return Response.json({ error: "Herod's note is empty." }, { status: 400 });
  const updated = {
    ...p,
    herod,
    sitterName: typeof body.sitterName === "string" ? body.sitterName.trim().slice(0, 40) || undefined : p.sitterName,
    status: body.approve ? ("approved" as const) : p.status,
  };
  await savePortrait(updated);
  return Response.json({ portrait: updated });
}
