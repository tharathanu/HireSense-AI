import { useNavigate } from 'react-router-dom';
import { Bell } from 'lucide-react';
import api from '../../api/client';
import useApi from '../../hooks/useApi';
import { PageHeader, Loading, ErrorAlert, EmptyState } from '../../components/ui';
import { timeAgo } from '../../utils/format';

export default function Notifications() {
  const { data, loading, error, reload } = useApi('/notifications');
  const navigate = useNavigate();
  const list = data?.notifications || [];

  async function open(n) {
    if (!n.isRead) await api.post(`/notifications/${n.id}/read`).catch(() => {});
    if (n.link) navigate(n.link);
    else reload();
  }

  async function readAll() {
    await api.post('/notifications/read-all').catch(() => {});
    reload();
  }

  return (
    <div className="page">
      <PageHeader
        title="Notifications"
        subtitle="Updates about your hiring activity. Important ones are also sent by email."
        actions={data?.unread ? <button className="btn btn-outline" type="button" onClick={readAll}>Mark all as read</button> : null}
      />
      <ErrorAlert message={error} />
      {loading ? (
        <Loading />
      ) : list.length === 0 ? (
        <div className="card"><EmptyState icon={Bell} title="You’re all caught up" text="New updates will appear here." /></div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          {list.map((n) => (
            <div key={n.id} className={`notif${n.isRead ? '' : ' unread'}`}>
              {!n.isRead ? <span className="dot-unread" aria-label="Unread" /> : <span style={{ width: 8 }} />}
              <div style={{ flex: 1 }}>
                <div className="row between">
                  <strong>{n.title}</strong>
                  <span className="muted" style={{ fontSize: 13 }}>{timeAgo(n.createdAt)}</span>
                </div>
                <p style={{ color: 'var(--text-body)', fontSize: 14, marginTop: 4 }}>{n.message}</p>
                {n.link && (
                  <button type="button" className="btn btn-ghost btn-sm" style={{ paddingLeft: 0, color: 'var(--signal)' }} onClick={() => open(n)}>
                    Open
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
