import { requireBooth } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// The Solana libraries are loaded lazily so that any problem loading them
// shows up as a readable message on the Setup page instead of a bare 500.
function fail(e: unknown) {
  const err = e as Error;
  console.error("setup failed", err);
  return Response.json({ error: `${err.name}: ${err.message}` }, { status: 500 });
}

export async function GET() {
  const denied = await requireBooth();
  if (denied) return denied;
  try {
    const { status } = await import("@/lib/setupImpl");
    return await status();
  } catch (e) {
    return fail(e);
  }
}

export async function POST(req: Request) {
  const denied = await requireBooth();
  if (denied) return denied;
  try {
    const { action } = (await req.json()) as { action?: string };
    const { runAction } = await import("@/lib/setupImpl");
    return await runAction(action);
  } catch (e) {
    return fail(e);
  }
}
