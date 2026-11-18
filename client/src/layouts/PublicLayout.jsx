import { Link, Outlet } from 'react-router-dom';
import Logo from '../components/Logo';
import { useAuth, homePathFor } from '../context/AuthContext';

export default function PublicLayout() {
  const { user } = useAuth();
  const year = new Date().getFullYear();

  return (
    <>
      <header className="site-header">
        <div className="container">
          <Link to="/" aria-label="HireSense AI home" style={{ textDecoration: 'none' }}>
            <Logo size={34} />
          </Link>
          <nav className="site-nav" aria-label="Main">
            <a className="navlink" href="/#how-it-works">How it works</a>
            <a className="navlink" href="/#recruiters">Fairness</a>
            {user ? (
              <Link className="btn btn-primary" to={homePathFor(user.role)}>Open dashboard</Link>
            ) : (
              <>
                <Link className="btn btn-ghost" to="/login">Log in</Link>
                <Link className="btn btn-primary" to="/register">Get started</Link>
              </>
            )}
          </nav>
        </div>
      </header>

      <main>
        <Outlet />
      </main>

      <footer className="site-footer">
        <div className="container">
          <span>© {year} HireSense AI · Built by Thanushri R in Puducherry</span>
          <a href="https://github.com/tharathanu" target="_blank" rel="noreferrer">GitHub</a>
        </div>
      </footer>
    </>
  );
}
