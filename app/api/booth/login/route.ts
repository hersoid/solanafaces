import { checkPin, setBoothCookie } from "@/lib/auth";

export async function POST(req: Request) {
  const { pin } = (await req.json().catch(() => ({}))) as { pin?: string };
  try {
    checkPin("");
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
  if (!pin || !checkPin(pin)) {
    await new Promise((r) => setTimeout(r, 800)); // slow down guessing
    return Response.json({ error: "Wrong PIN." }, { status: 401 });
  }
  await setBoothCookie();
  return Response.json({ ok: true });
}
