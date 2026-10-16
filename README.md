# Solanafaces at Solana Spaces

A human photo booth for Solana Breakpoint 2026 (Olympia London, 15–17 November). HERSOID draws a visitor from life; the visitor takes the paper home and claims the portrait, its timelapse and a note from the critic Herod Hersché as a Solana NFT.

## How it works

| Who | Where | What happens |
|---|---|---|
| You | `/booth/cards` | Make and print claim cards. Each has a number and a unique QR code. |
| You | `/booth` (iPad on a copy stand) | **Start sitting** records a timelapse frame every few seconds. **Finished drawing**, take the final photo, **Save**. The screen tells you which card to hand over. |
| Herod | `/booth` | Drafts his note within a minute. You edit if needed and tap **Approve**. |
| Visitor | Scans the card → `/c/<code>` | Sees drawing, timelapse and Herod's note; ticks consent; claims with their wallet or with email (a wallet is created for them). |
| Server | — | Uploads image, film and metadata to Arweave (permanent), mints a Metaplex Core 1/1 into the Solanafaces collection, delivered to the visitor's wallet. You pay the fees; the visitor pays nothing. |

Unclaimed portraits are never minted. Drawings are kept on the iPad until they've uploaded, so venue wifi dropping out loses nothing.

**Mint engines.** `MINT_DRIVER=metaplex` mints directly with Metaplex Core and works on devnet and mainnet. `MINT_DRIVER=mallow` uses mallow's v2 API (mainnet only): mallow builds the mint, then a transfer to the visitor. mallow's docs don't fully specify two fields, so press **mallow dry run** on `/booth/setup` (free, sends nothing) before switching.

---

## Setup (about an hour, once)

You'll create five free accounts. Keys only ever go into Vercel's settings, never into chat, email or code.

### 1. Code on GitHub
Create an empty private repository called `solanafaces` on github.com and tell Claude its name. Claude pushes the code to it.

### 2. Vercel (hosting)
1. Sign in at vercel.com with GitHub. **Add New → Project →** import `solanafaces` → **Deploy**. The first deploy will show errors until step 7; that's expected.
2. In the project: **Storage → Create → Blob** (photo storage). Connect it to the project.
3. **Storage → Marketplace → Upstash → Redis** (the database). Free plan. Connect it to the project.

### 3. Minting wallet
A dedicated wallet that pays for every mint. Never use your personal wallet.
1. In Phantom: **Add account → Create new account**. Name it "Solanafaces minter".
2. **Settings → that account → Show private key**. Copy it straight into Vercel (step 7) as `MINTER_SECRET_KEY`. Don't save it anywhere else.

### 4. Privy (visitor login: email + wallets)
1. dashboard.privy.io → **Create app** "Solanafaces".
2. **Login methods:** turn on Email and External wallets (Solana).
3. **Embedded wallets:** turn on Solana; create on login for users without wallets.
4. **Configuration → Domains:** add your Vercel address (e.g. `https://solanafaces.vercel.app`).
5. Copy the **App ID**.

### 5. Anthropic (Herod)
console.anthropic.com → **API keys → Create key**. Add a little credit; a note costs well under a penny.

### 6. mallow
Your mallow API key. The one shared in chat should be regenerated in mallow first, and only the new one pasted into Vercel.

### 7. Vercel environment variables
**Project → Settings → Environment Variables.** Add these (see `.env.example`):

| Name | Value |
|---|---|
| `SOLANA_CLUSTER` | `devnet` for rehearsals |
| `MINTER_SECRET_KEY` | from step 3 |
| `MINT_DRIVER` | `metaplex` |
| `ROYALTY_BPS` | `500` (= 5%) or your choice |
| `ANTHROPIC_API_KEY` | from step 5 |
| `BOOTH_PIN` | a long PIN of your choosing |
| `NEXT_PUBLIC_PRIVY_APP_ID` | from step 4 |
| `NEXT_PUBLIC_SITE_URL` | your Vercel address, no trailing slash |
| `MALLOW_API_KEY` | from step 6 |
| `RPC_URL` | optional on devnet; on mainnet a free key from helius.dev is strongly recommended |

Then **Deployments → ⋯ → Redeploy.** Any change to a `NEXT_PUBLIC_` value needs a redeploy.

### 8. Create the collection
1. Open `/booth` on your site, enter the PIN, go to **Setup**.
2. On devnet, get free test SOL at faucet.solana.com for the minting wallet address shown.
3. When every line is green except Collection, press **Create collection**. Copy the address it gives you into `COLLECTION_ADDRESS` in Vercel and redeploy.

### 9. Rehearse on devnet
1. In Phantom on your phone: **Settings → Developer settings → Testnet mode → Devnet**.
2. Print 3 cards, draw 3 test portraits, approve Herod, scan, claim. Try the email route too.

### 10. Switch to mainnet (by 13 November)
1. `SOLANA_CLUSTER=mainnet-beta`, set `RPC_URL`, send about 1 SOL to the minting wallet.
2. Clear `COLLECTION_ADDRESS`, redeploy, press **Create collection** again (this makes the real mainnet collection), paste the new address, redeploy.
3. Optional: press **mallow dry run**. If it passes, set `MINT_DRIVER=mallow`.
4. Print the event cards, then in the booth use **change** next to "Next card" to start at the first event card.

## Costs (rough)
Per portrait on mainnet: about 0.003 SOL for the mint plus a few cents of Arweave storage for the image, film and metadata. 120 portraits is comfortably under 1 SOL. Hosting, database, storage and Privy stay on free tiers at this volume.

## At the booth
- iPad in landscape on a copy stand, overhead, even light, the sheet filling the frame.
- Keep the booth tab open while a timelapse is being made (about 20 seconds).
- If a claim fails, the reason shows under **Recent**; the visitor can simply try again.
