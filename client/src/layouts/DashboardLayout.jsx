import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import Logo from '../components/Logo';
import NotificationBell from '../components/NotificationBell';
import { useAuth } from '../context/AuthContext';

// Sidebar + top bar shell shared by all three dashboards.
// `links` items: { to, label, icon, end }
export default function DashboardLayout({ links, roleLabel, basePath }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const initials = user.fullName
    .split(' ')
    .filter(Boolean)
    .map((part) => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  function handleLogout() {
    logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Logo size={32} light />
        <nav aria-label={`${roleLabel} menu`}>
          {links.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => (isActive ? 'active' : undefined)}>
              <Icon size={18} aria-hidden="true" />
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>

      <div className="app-main">
        <header className="topbar">
          <span className="badge">{roleLabel}</span>
          <div className="user-chip">
            <NotificationBell to={`${basePath}/notifications`} />
            <div className="avatar" aria-hidden="true">{initials}</div>
            <div style={{ lineHeight: 1.3 }}>
              <div style={{ fontWeight: 600 }}>{user.fullName}</div>
              <div className="muted" style={{ fontSize: 13 }}>{user.email}</div>
            </div>
            <button className="btn btn-outline btn-sm" type="button" onClick={handleLogout}>
              <LogOut size={16} aria-hidden="true" /> Log out
            </button>
          </div>
        </header>
        <Outlet />
      </div>
    </div>
  );
}
