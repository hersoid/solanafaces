import { Connection, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { requireBooth } from "@/lib/auth";
import { collectionJson, COLLECTION_NAME } from "@/lib/metadata";
import { mintDriver } from "@/lib/mint";
import { createCollectionDirect } from "@/lib/mint/metaplex";
import { mallowDryRun } from "@/lib/mint/mallow";
import {
  cluster,
  collectionAddress,
  explorerAddress,
  explorerTx,
  minterKeypair,
  rpcUrl,
  royaltyBps,
  uploadFile,
  uploadJson,
} from "@/lib/solana";
import { readFile } from "fs/promises";
import path from "path";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function check(name: string, ok: boolean, note: string) {
  return { name, ok, note };
}

/** Health check of every setting, so the booth knows it's ready. */
export async function GET() {
  const denied = await requireBooth();
  if (denied) return denied;
  try {
    return await status();
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 500 });
  }
}

async function status() {
  const checks = [];
  let minter: string | null = null;
  let balance: number | null = null;
  try {
    minter = minterKeypair().publicKey.toBase58();
    const conn = new Connection(rpcUrl(), "confirmed");
    balance = (await conn.getBalance(minterKeypair().publicKey)) / LAMPORTS_PER_SOL;
    checks.push(
      check(
        "Minting wallet",
        balance >= (cluster() === "devnet" ? 0.2 : 0.3),
        `${minter.slice(0, 4)}…${minter.slice(-4)} holds ${balance.toFixed(3)} SOL`,
      ),
    );
  } catch (e) {
    checks.push(check("Minting wallet", false, (e as Error).message));
  }
  const col = collectionAddress();
  checks.push(check("Collection", !!col, col ? "Set" : "Not created yet — use the button below"));
  checks.push(check("Herod (Anthropic key)", !!process.env.ANTHROPIC_API_KEY, process.env.ANTHROPIC_API_KEY ? "Set" : "ANTHROPIC_API_KEY missing"));
  checks.push(check("Photo storage (Vercel Blob)", !!process.env.BLOB_READ_WRITE_TOKEN, process.env.BLOB_READ_WRITE_TOKEN ? "Connected" : "Connect Blob in Vercel → Storage"));
  checks.push(
    check(
      "Database (Upstash Redis)",
      !!(process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL),
      process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL ? "Connected" : "Connect Upstash Redis in Vercel → Storage",
    ),
  );
  checks.push(check("Visitor login (Privy)", !!process.env.NEXT_PUBLIC_PRIVY_APP_ID, process.env.NEXT_PUBLIC_PRIVY_APP_ID ? "Set" : "NEXT_PUBLIC_PRIVY_APP_ID missing — visitors can still paste an address"));
  checks.push(check("Site address for QR codes", !!process.env.NEXT_PUBLIC_SITE_URL, process.env.NEXT_PUBLIC_SITE_URL ?? "NEXT_PUBLIC_SITE_URL missing"));
  if (mintDriver() === "mallow") {
    checks.push(check("mallow API key", !!process.env.MALLOW_API_KEY, process.env.MALLOW_API_KEY ? "Set" : "MALLOW_API_KEY missing"));
    checks.push(check("mallow on mainnet", cluster() === "mainnet-beta", cluster() === "mainnet-beta" ? "Yes" : "mallow is mainnet only — switch MINT_DRIVER to metaplex on devnet"));
  }

  return Response.json({
    cluster: cluster(),
    driver: mintDriver(),
    royaltyBps: royaltyBps(),
    minter,
    minterUrl: minter ? explorerAddress(minter) : null,
    collection: col,
    collectionUrl: col ? explorerAddress(col) : null,
    balance,
    checks,
  });
}

export async function POST(req: Request) {
  const denied = await requireBooth();
  if (denied) return denied;
  const { action } = (await req.json()) as { action?: string };

  if (action === "create-collection") {
    if (collectionAddress()) return Response.json({ error: "A collection is already set. Clear COLLECTION_ADDRESS first if you really want a new one." }, { status: 409 });
    try {
      const logo = await readFile(path.join(process.cwd(), "public", "solanafaces.jpg"));
      const image = await uploadFile(new Uint8Array(logo), "solanafaces.jpg", "image/jpeg");
      const uri = await uploadJson(collectionJson(image));
      const { collection, signature } = await createCollectionDirect({ name: COLLECTION_NAME, uri });
      return Response.json({ collection, txUrl: explorerTx(signature) });
    } catch (e) {
      return Response.json({ error: (e as Error).message }, { status: 500 });
    }
  }

  if (action === "mallow-dry-run") {
    const col = collectionAddress();
    if (!col) return Response.json({ error: "Create the collection first." }, { status: 400 });
    return Response.json(await mallowDryRun(col));
  }

  return Response.json({ error: "Unknown action." }, { status: 400 });
}
