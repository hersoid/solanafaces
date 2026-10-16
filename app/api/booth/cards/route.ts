import { requireBooth } from "@/lib/auth";
import { reserveCards } from "@/lib/store";

/** Reserve a batch of new claim cards (each gets a number and a secret QR code). */
export async function POST(req: Request) {
  const denied = await requireBooth();
  if (denied) return denied;
  const { count } = (await req.json()) as { count?: number };
  const n = Math.max(1, Math.min(200, Math.floor(count ?? 0)));
  const cards = await reserveCards(n);
  return Response.json({ first: cards[0].number, last: cards[cards.length - 1].number });
}
