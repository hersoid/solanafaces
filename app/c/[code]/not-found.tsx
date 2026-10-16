export default function NotFound() {
  return (
    <main className="wrap">
      <section className="section stack" style={{ paddingTop: 48 }}>
        <div className="label">Solanafaces</div>
        <h1 className="h1">We can’t find this card.</h1>
        <p style={{ margin: 0, color: "var(--soft)", lineHeight: 1.55 }}>
          Check you scanned the QR code on your claim card, or come back to the booth at Solana Spaces.
        </p>
      </section>
    </main>
  );
}
