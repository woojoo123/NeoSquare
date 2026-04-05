export default function AppLayout({ eyebrow, title, description }) {
  return (
    <main className="app-shell">
      <section className="app-panel">
        <p className="app-eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p>{description}</p>
      </section>
    </main>
  );
}
