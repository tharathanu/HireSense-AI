import { Link } from 'react-router-dom';
import Logo from '../components/Logo';

export default function AuthLayout({ heading, text, photo = '/images/photo-coder.webp', photoAlt = '', children }) {
  return (
    <div className="auth-page">
      <aside className="auth-aside" style={{ '--auth-photo': `url(${photo})` }}>
        {photoAlt && <span className="sr-only">{photoAlt}</span>}
        <Link to="/" aria-label="HireSense AI home" style={{ textDecoration: 'none' }}>
          <Logo size={38} light />
        </Link>
        <div className="auth-aside-copy">
          <h2>{heading}</h2>
          <p>{text}</p>
        </div>
      </aside>
      <main className="auth-main">
        <div className="auth-card">{children}</div>
      </main>
    </div>
  );
}
