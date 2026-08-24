import { useState, useEffect, useCallback } from 'react';
import { getMySessionHistory } from '../../services/api';
import { getTodayIST, formatDate, formatDateDDMMYYYY, formatTime } from '../../utils/dateTime';
import SessionListItem from '../../components/SessionListItem';
import { MdError, MdRefresh } from 'react-icons/md';

export default function EmployeeHistory() {
  const today = getTodayIST();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedDate, setSelectedDate] = useState(today);
  const [customDate, setCustomDate] = useState('');

  // Get unique dates from sessions
  const [availableDates, setAvailableDates] = useState([today, yesterdayStr]);

  const loadSessions = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getMySessionHistory(0, 200);
      setSessions(data || []);

      // Build available dates (unique dates from sessions + today + yesterday)
      const dates = new Set([today, yesterdayStr]);
      data?.forEach(s => { if (s.work_date) dates.add(s.work_date); });
      setAvailableDates(Array.from(dates).sort().reverse().slice(0, 30));
    } catch (err) {
      console.error('History load error:', err);
      setError('Failed to load history. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [today, yesterdayStr]);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const filteredSessions = sessions.filter(s => s.work_date === (customDate || selectedDate));
  const completedFiltered = filteredSessions.filter(s => s.status === 'completed');
  const totalForms = completedFiltered.reduce((sum, s) => sum + (s.total_forms || 0), 0);

  const quickDates = [
    { label: 'Today', value: today },
    { label: 'Yesterday', value: yesterdayStr },
  ];

  return (
    <div className="main-content">
      <h2 style={{ marginBottom: 'var(--space-md)' }}>My History</h2>

      {error && (
        <div className="alert alert-error mb-md" role="alert">
          <MdError /> {error}
          <button onClick={loadSessions} style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}>
            <MdRefresh size={18} />
          </button>
        </div>
      )}

      {/* Date Filter */}
      <div style={{ marginBottom: 'var(--space-md)' }}>
        <div className="section-title mb-sm">Select Date</div>
        <div className="date-selector">
          {quickDates.map(d => (
            <button
              key={d.value}
              className={`date-chip ${(customDate || selectedDate) === d.value ? 'active' : ''}`}
              onClick={() => { setSelectedDate(d.value); setCustomDate(''); }}
              id={`date-chip-${d.label.toLowerCase()}`}
            >
              {d.label}
            </button>
          ))}
          {availableDates
            .filter(d => d !== today && d !== yesterdayStr)
            .slice(0, 10)
            .map(d => (
              <button
                key={d}
                className={`date-chip ${(customDate || selectedDate) === d ? 'active' : ''}`}
                onClick={() => { setSelectedDate(d); setCustomDate(''); }}
              >
                {formatDateDDMMYYYY(d)}
              </button>
            ))}
        </div>

        {/* Custom Date Picker */}
        <div style={{ marginTop: '12px' }}>
          <input
            type="date"
            className="filter-input-date"
            value={customDate}
            max={today}
            onChange={e => setCustomDate(e.target.value)}
            aria-label="Select custom date"
            style={{ width: '100%' }}
          />
        </div>
      </div>

      {/* Summary for selected date */}
      {!loading && (
        <div className="card mb-md" style={{ padding: '12px 16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {formatDate(customDate || selectedDate)}
              </div>
              <div style={{ fontWeight: '600', marginTop: '2px' }}>
                {completedFiltered.length} sessions · {totalForms.toLocaleString()} forms
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontFamily: 'var(--font-heading)', fontSize: '1.6rem', fontWeight: '800', color: 'var(--brand-primary)' }}>
                {totalForms.toLocaleString()}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Total Forms</div>
            </div>
          </div>
        </div>
      )}

      {/* Sessions List */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <div className="loading-spinner" style={{ margin: '0 auto' }} />
        </div>
      ) : filteredSessions.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📅</div>
          <div className="empty-state-text">No sessions found for this date.</div>
        </div>
      ) : (
        <div className="session-list">
          {filteredSessions.map(session => (
            <SessionListItem key={session.id} session={session} />
          ))}
        </div>
      )}
    </div>
  );
}
