import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="container" style={{ padding: '96px 24px', textAlign: 'center' }}>
      <p className="mono muted">404</p>
      <h1 style={{ fontSize: 32, margin: '8px 0 12px' }}>This page doesn’t exist</h1>
      <p className="muted">The link may be broken or the page may have moved.</p>
      <Link className="btn btn-primary" to="/" style={{ marginTop: 24 }}>Back to home</Link>
    </div>
  );
}
