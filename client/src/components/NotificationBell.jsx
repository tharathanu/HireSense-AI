import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Bell } from 'lucide-react';
import api from '../api/client';

// Bell with the unread count; refreshes on navigation and every minute
export default function NotificationBell({ to }) {
  const [unread, setUnread] = useState(0);
  const location = useLocation();

  useEffect(() => {
    let alive = true;
    const load = () =>
      api.get('/notifications').then((res) => alive && setUnread(res.data.unread)).catch(() => {});
    load();
    const timer = setInterval(load, 60000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, [location.pathname]);

  return (
    <Link to={to} className="icon-btn" aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}>
      <Bell size={20} aria-hidden="true" />
      {unread > 0 && <span className="bell-count" aria-hidden="true">{unread > 9 ? '9+' : unread}</span>}
    </Link>
  );
}
