export default function AppLayout({
  eyebrow,
  title,
  description,
  children,
  panelClassName = '',
  shellClassName = '',
  headerHidden = false,
}) {
  const shellClassNames = ['app-shell', shellClassName].filter(Boolean).join(' ');
  const panelClassNames = ['app-panel', panelClassName].filter(Boolean).join(' ');

  return (
    <main className={shellClassNames}>
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
