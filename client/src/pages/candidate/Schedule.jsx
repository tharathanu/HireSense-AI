import { Link } from 'react-router-dom';
import { CalendarClock } from 'lucide-react';
import useApi from '../../hooks/useApi';
import { PageHeader, Loading, ErrorAlert, EmptyState } from '../../components/ui';
import { EVENT_LABEL, formatDateTime } from '../../utils/format';

export default function Schedule() {
  const { data, loading, error } = useApi('/candidate/events');
  const now = Date.now();
  const events = data?.events || [];
  const upcoming = events.filter((e) => new Date(e.endsAt).getTime() >= now);
  const past = events.filter((e) => new Date(e.endsAt).getTime() < now);

  const renderTable = (list, showJoin) => (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr><th>Round</th><th>Job</th><th>Starts</th><th>Ends</th>{showJoin && <th><span className="sr-only">Action</span></th>}</tr>
        </thead>
        <tbody>
          {list.map((e) => (
            <tr key={e.id}>
              <td><strong>{EVENT_LABEL[e.type]}</strong></td>
              <td>{e.job.title}<div className="muted" style={{ fontSize: 13 }}>{e.job.company.name}</div></td>
              <td>{formatDateTime(e.startsAt)}</td>
              <td>{formatDateTime(e.endsAt)}</td>
              {showJoin && <td>{e.joinPath && <Link className="btn btn-primary btn-sm" to={e.joinPath}>Open</Link>}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="page">
      <PageHeader title="My schedule" subtitle="Aptitude tests, group discussions and interviews you’ve been invited to. Times are shown in your local time." />
      <ErrorAlert message={error} />
      {loading ? (
        <Loading />
      ) : events.length === 0 ? (
        <div className="card"><EmptyState icon={CalendarClock} title="Nothing scheduled yet" text="When a recruiter schedules a round for you, it will appear here and you’ll get an email." /></div>
      ) : (
        <>
          <h2 style={{ fontSize: 18 }}>Upcoming</h2>
          {upcoming.length ? renderTable(upcoming, true) : <p className="muted">No upcoming rounds.</p>}
          {past.length > 0 && (
            <>
              <h2 style={{ fontSize: 18 }}>Past</h2>
              {renderTable(past, false)}
            </>
          )}
        </>
      )}
    </div>
  );
}
