import { requireBooth } from "@/lib/auth";
import { cardCount, getRange } from "@/lib/store";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Print-ready A6 postcards (3 mm bleed, one card per page) for cards from..to. */
export async function GET(req: Request) {
  const denied = await requireBooth();
  if (denied) return denied;
  try {
    const url = new URL(req.url);
    const total = await cardCount();
    const from = Math.max(1, Number(url.searchParams.get("from")) || 1);
    const to = Math.min(total, Number(url.searchParams.get("to")) || total, from + 499);
    if (!total || to < from) return Response.json({ error: "No cards in that range yet. Make them first." }, { status: 400 });

    const site = process.env.NEXT_PUBLIC_SITE_URL;
    if (!site) return Response.json({ error: "Set NEXT_PUBLIC_SITE_URL first, or the QR codes won't point anywhere." }, { status: 400 });

    // Assets live in public/print; Vercel doesn't bundle them into server code, so fetch them from the site.
    const get = async (p: string) => {
      const r = await fetch(`${url.origin}/print/${p}`);
      if (!r.ok) throw new Error(`Could not load ${p} (${r.status})`);
      return new Uint8Array(await r.arrayBuffer());
    };
    const [logoJpg, archivo400, archivo700, mono400] = await Promise.all([
      get("solanafaces-print.jpg"),
      get("archivo-latin-400-normal.woff"),
      get("archivo-latin-700-normal.woff"),
      get("dm-mono-latin-400-normal.woff"),
    ]);

    const cards = await getRange(from, to);
    const { buildPostcards } = await import("@/lib/postcard");
    const pdf = await buildPostcards(cards, site, { logoJpg, archivo400, archivo700, mono400 });
    const pad = (n: number) => String(n).padStart(3, "0");
    return new Response(Buffer.from(pdf), {
      headers: {
        "content-type": "application/pdf",
        "content-disposition": `attachment; filename="solanafaces-postcards-A6-${pad(from)}-${pad(to)}.pdf"`,
        "cache-control": "no-store",
      },
    });
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}
