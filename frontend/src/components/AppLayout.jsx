export default function AppLayout({ eyebrow, title, description, children }) {
  return (
    <main className="app-shell">
      <section className="app-panel">
        <p className="app-eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p>{description}</p>
        {children}
      </section>
    </main>
  );
}
