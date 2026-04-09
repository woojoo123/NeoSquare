export default function AppLayout({
  eyebrow,
  title,
  description,
  children,
  panelClassName = '',
  headerHidden = false,
}) {
  const panelClassNames = ['app-panel', panelClassName].filter(Boolean).join(' ');

  return (
    <main className="app-shell">
      <section className={panelClassNames}>
        {!headerHidden ? (
          <>
            <p className="app-eyebrow">{eyebrow}</p>
            <h1>{title}</h1>
            <p>{description}</p>
          </>
        ) : null}
        {children}
      </section>
    </main>
  );
}
