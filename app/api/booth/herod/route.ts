import { requireBooth } from "@/lib/auth";
import { draftHerod } from "@/lib/herod";
import { getPortrait, savePortrait } from "@/lib/store";

export const maxDuration = 60;

/** Ask Herod for a (new) draft. Nick approves or edits it in the booth app. */
export async function POST(req: Request) {
  const denied = await requireBooth();
  if (denied) return denied;
  const { code } = (await req.json()) as { code?: string };
  const p = code ? await getPortrait(code) : null;
  if (!p?.imageUrl) return Response.json({ error: "Card or photo not found." }, { status: 404 });
  try {
    const herod = await draftHerod(p.imageUrl, p.number);
    await savePortrait({ ...p, herod, herodError: undefined });
    return Response.json({ herod });
  } catch (e) {
    const msg = `Herod is indisposed: ${(e as Error).message}`.slice(0, 500);
    await savePortrait({ ...p, herodError: msg });
    return Response.json({ error: msg }, { status: 502 });
  }
}
