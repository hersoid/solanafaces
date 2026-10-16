export default function Home() {
  return (
    <main className="wrap">
      <header className="header">
        <img className="logo" src="/solanafaces.jpg" alt="" />
        <div>
          <div className="brand">Solanafaces</div>
          <div className="label">at Solana Spaces · Breakpoint London</div>
        </div>
      </header>
      <section className="section stack" style={{ paddingTop: 32 }}>
        <h1 className="h1">A human photo booth.</h1>
        <p style={{ margin: 0, fontSize: 16, lineHeight: 1.55, color: "var(--soft)" }}>
          Sit for HERSOID at Solana Spaces, Olympia London, 15–17 November 2026. Ten minutes, graphite on paper, drawn from
          life. You take the original home; the portrait, its timelapse and a note from the critic Herod Hersché are minted
          to your wallet.
        </p>
        <p className="small">Got a claim card? Scan its QR code with your phone camera.</p>
      </section>
      <footer className="footer">
        <span>HERSOID × Solana Spaces</span>
        <a href="https://hersoid.com">hersoid.com</a>
      </footer>
    </main>
  );
}
