import { formatTime } from '../utils/dateTime';

export default function SessionListItem({ session }) {
  const isWorking = session.status === 'working';

  return (
    <div className={`session-list-item ${isWorking ? 'session-active-card' : ''}`}>
      <div className="session-list-left">
        <div className="session-number">
          Session #{session.session_number}
          {isWorking && (
            <span style={{ marginLeft: '8px' }}>
              <span className="status-dot working" style={{ display: 'inline-block' }} />
            </span>
          )}
        </div>
        <div className="session-forms">
          {session.starting_form_number?.toLocaleString()}
          {session.ending_form_number ? ` → ${session.ending_form_number?.toLocaleString()}` : ' → ...'}
        </div>
        <div className="session-time">
          {formatTime(session.start_time)}
          {session.end_time && ` – ${formatTime(session.end_time)}`}
        </div>
      </div>

      <div className="session-list-right">
        {session.total_forms != null ? (
          <>
            <div className="session-total">{session.total_forms.toLocaleString()}</div>
            <div className="session-total-label">forms</div>
          </>
        ) : (
          <span className="badge badge-working">Working</span>
        )}
      </div>
    </div>
  );
}
