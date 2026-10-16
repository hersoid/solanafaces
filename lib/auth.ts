import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "crypto";

const COOKIE = "sf_booth";

function secret(): string {
  const pin = process.env.BOOTH_PIN;
  if (!pin || pin.length < 6) throw new Error("BOOTH_PIN must be set (6+ characters).");
  return pin;
}

function sign(value: string): string {
  return createHmac("sha256", secret()).update(value).digest("hex");
}

export function checkPin(pin: string): boolean {
  const a = Buffer.from(pin);
  const b = Buffer.from(secret());
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function setBoothCookie(): Promise<void> {
  const issued = Date.now().toString();
  (await cookies()).set(COOKIE, `${issued}.${sign(issued)}`, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function isBooth(): Promise<boolean> {
  try {
    const raw = (await cookies()).get(COOKIE)?.value;
    if (!raw) return false;
    const [issued, mac] = raw.split(".");
    if (!issued || !mac) return false;
    const expected = sign(issued);
    return mac.length === expected.length && timingSafeEqual(Buffer.from(mac), Buffer.from(expected));
  } catch {
    return false;
  }
}

export async function requireBooth(): Promise<Response | null> {
  return (await isBooth()) ? null : Response.json({ error: "Booth login required." }, { status: 401 });
}
