import { Link } from 'react-router-dom';

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
          <header className="app-page-header">
            <div className="app-page-header__copy">
              <p className="app-eyebrow">{eyebrow}</p>
              <h1>{title}</h1>
              <p>{description}</p>
            </div>
            <Link className="secondary-button app-home-button" to="/">
              홈
            </Link>
          </header>
        ) : null}
        {children}
      </section>
    </main>
  );
}
