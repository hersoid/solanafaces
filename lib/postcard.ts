import { PDFDocument, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import QRCode from "qrcode";

/**
 * Print-ready A6 portrait claim postcards, one card per page.
 * Trim 105 × 148 mm with 3 mm bleed on every side (page 111 × 154 mm).
 * Top: the Solanafaces logo, full bleed. Bottom strip: QR code, card number, instructions.
 * QR codes are drawn as vector squares so they stay sharp at any print resolution.
 */

export type PostcardAssets = {
  logoJpg: Uint8Array;
  archivo400: Uint8Array;
  archivo700: Uint8Array;
  mono400: Uint8Array;
};

const MM = 72 / 25.4;
const BLEED = 3;
const TRIM_W = 105;
const TRIM_H = 148;
const PAGE_W = TRIM_W + 2 * BLEED;
const PAGE_H = TRIM_H + 2 * BLEED;
const ART_H = 108; // logo occupies the top 108 mm of the trimmed card

const ink = rgb(0x0b / 255, 0x0b / 255, 0x10 / 255);
const grey = rgb(0x55 / 255, 0x55 / 255, 0x6a / 255);
const rule = rgb(0xdc / 255, 0xdc / 255, 0xe4 / 255);

/** Trimmed-card coordinates in mm (x from left, y from top) → PDF points. */
const X = (x: number) => (x + BLEED) * MM;
const Y = (y: number) => (PAGE_H - (y + BLEED)) * MM;

function pad(n: number) {
  return String(n).padStart(3, "0");
}

function text(page: PDFPage, s: string, x: number, y: number, size: number, font: PDFFont, color = ink, tracking = 0) {
  if (!tracking) return page.drawText(s, { x: X(x), y: Y(y), size, font, color });
  let cx = X(x);
  for (const ch of s) {
    page.drawText(ch, { x: cx, y: Y(y), size, font, color });
    cx += font.widthOfTextAtSize(ch, size) + tracking;
  }
}

function drawQr(page: PDFPage, url: string, x: number, y: number, size: number) {
  const qr = QRCode.create(url, { errorCorrectionLevel: "M" });
  const n = qr.modules.size;
  const cell = size / n;
  for (let row = 0; row < n; row++) {
    for (let col = 0; col < n; col++) {
      if (!qr.modules.get(row, col)) continue;
      page.drawRectangle({
        x: X(x + col * cell),
        y: Y(y + (row + 1) * cell),
        width: cell * MM + 0.05, // hairline overlap so no white seams appear between modules
        height: cell * MM + 0.05,
        color: ink,
      });
    }
  }
}

export async function buildPostcards(
  cards: { number: number; code: string }[],
  siteUrl: string,
  a: PostcardAssets,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  doc.setTitle(`Solanafaces claim postcards ${pad(cards[0]?.number ?? 0)}–${pad(cards.at(-1)?.number ?? 0)}`);
  doc.setAuthor("HERSOID");
  doc.setCreator("Solanafaces");

  const logo = await doc.embedJpg(a.logoJpg);
  const sans = await doc.embedFont(a.archivo400, { subset: true });
  const bold = await doc.embedFont(a.archivo700, { subset: true });
  const mono = await doc.embedFont(a.mono400, { subset: true });
  const site = siteUrl.replace(/\/$/, "");

  for (const card of cards) {
    const page = doc.addPage([PAGE_W * MM, PAGE_H * MM]);
    page.setTrimBox(BLEED * MM, BLEED * MM, TRIM_W * MM, TRIM_H * MM);
    page.setBleedBox(0, 0, PAGE_W * MM, PAGE_H * MM);

    // Logo: full bleed across the top, square, covering the left/right/top bleed.
    const side = PAGE_W; // 111 mm
    page.drawImage(logo, { x: 0, y: Y(ART_H), width: side * MM, height: side * MM });

    // Bottom strip (paper white): QR on the left, words on the right.
    const left = 7;
    const qrY = ART_H + 6;
    const qrSize = 23;
    drawQr(page, `${site}/c/${card.code}`, left, qrY, qrSize);

    const tx = left + qrSize + 6; // 38 mm
    text(page, "CERTIFICATE OF SITTING", tx, qrY + 2.6, 5.6, mono, grey, 0.6);
    text(page, `No. ${pad(card.number)}`, tx, qrY + 10.6, 17, bold);
    text(page, "Scan to claim your portrait on Solana.", tx, qrY + 16.6, 7.4, sans);
    text(page, "Free. No wallet needed: claim with email.", tx, qrY + 20.6, 6.4, sans, grey);

    // Footer rule + credits, inside the 4 mm safe zone.
    const fy = 143; // 5 mm above the trim edge
    page.drawLine({ start: { x: X(left), y: Y(fy - 3.4) }, end: { x: X(TRIM_W - left), y: Y(fy - 3.4) }, thickness: 0.35, color: rule });
    text(page, "HERSOID", left, fy, 5.4, mono, grey, 0.5);
    const right = "SOLANA SPACES · BREAKPOINT LONDON 2026";
    const w = right.length * 0.5 + mono.widthOfTextAtSize(right, 5.4);
    text(page, right, TRIM_W - left - w / MM, fy, 5.4, mono, grey, 0.5);
  }

  return doc.save();
}
