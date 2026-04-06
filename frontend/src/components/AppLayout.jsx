export default function AppLayout({
  eyebrow,
  title,
  description,
  children,
  panelClassName = '',
}) {
  const panelClassNames = ['app-panel', panelClassName].filter(Boolean).join(' ');

  return (
    <main className="app-shell">
      <section className={panelClassNames}>
        <p className="app-eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p>{description}</p>
        {children}
      </section>
    </main>
  );
}
