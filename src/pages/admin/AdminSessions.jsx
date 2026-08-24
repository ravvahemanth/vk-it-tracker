import { useState, useEffect, useCallback } from 'react';
import { getAdminSessions, getAllProfiles } from '../../services/api';
import { getTodayIST, formatDate, formatDateDDMMYYYY, formatTime } from '../../utils/dateTime';
import { MdRefresh, MdError, MdFilterList, MdSchedule, MdAssignment, MdCheckCircle, MdPlayCircleFilled } from 'react-icons/md';

export default function AdminSessions() {
  const today = getTodayIST();

  const [sessions, setSessions] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState('');

  // Filters
  const [filterDate, setFilterDate] = useState(today);
  const [filterEmployee, setFilterEmployee] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const loadData = useCallback(async (isManual = false) => {
    if (isManual) setIsRefreshing(true);
    setLoading(true);
    setError('');
    try {
      const [sessionsData, profilesData] = await Promise.all([
        getAdminSessions({
          date: filterDate || undefined,
          employeeId: filterEmployee || undefined,
          status: filterStatus || undefined,
          pageSize: 200,
        }),
        getAllProfiles(),
      ]);
      setSessions(sessionsData || []);
      setProfiles(profilesData || []);
    } catch (err) {
      console.error('Sessions load error:', err);
      setError('Failed to load sessions. Please try again.');
    } finally {
      setLoading(false);
      if (isManual) setTimeout(() => setIsRefreshing(false), 500);
    }
  }, [filterDate, filterEmployee, filterStatus]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Computed Metrics
  const completedSessions = sessions.filter(s => s.status === 'completed');
  const workingSessions = sessions.filter(s => s.status === 'working');
  const totalForms = completedSessions.reduce((sum, s) => sum + (s.total_forms || 0), 0);

  return (
    <div className="g-dashboard-container">
      {/* Page Header */}
      <div className="g-dashboard-header" style={{ marginBottom: '24px' }}>
        <div>
          <h1 className="g-page-title" style={{ fontSize: '1.5rem', fontWeight: '800', marginBottom: '4px' }}>
            Work Sessions Management
          </h1>
          <p className="g-subtitle" style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>
            Real-time track, filter, and audit employee form entry sessions
          </p>
        </div>
        <button
          className={`btn btn-outline ${isRefreshing ? 'is-loading' : ''}`}
          onClick={() => loadData(true)}
          id="refresh-sessions-btn"
          disabled={isRefreshing || loading}
          style={{ gap: '8px', minWidth: '110px', justifyContent: 'center' }}
        >
          <MdRefresh size={18} className={isRefreshing ? 'spin-anim' : ''} />
          <span>{isRefreshing ? 'Updating...' : 'Refresh'}</span>
        </button>
      </div>


      {error && (
        <div className="alert alert-error mb-lg" role="alert">
          <MdError size={18} /> {error}
        </div>
      )}

      {/* KPI Stats Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div className="stat-card" style={{ padding: '16px' }}>
          <div className="stat-icon blue">
            <MdAssignment size={22} />
          </div>
          <div>
            <div className="stat-value" style={{ fontSize: '1.5rem' }}>{sessions.length}</div>
            <div className="stat-label">Total Sessions</div>
          </div>
        </div>

        <div className="stat-card" style={{ padding: '16px' }}>
          <div className="stat-icon green">
            <MdCheckCircle size={22} />
          </div>
          <div>
            <div className="stat-value" style={{ fontSize: '1.5rem', color: 'var(--brand-primary)' }}>
              {totalForms.toLocaleString()}
            </div>
            <div className="stat-label">Forms Completed</div>
          </div>
        </div>

        <div className="stat-card" style={{ padding: '16px' }}>
          <div className="stat-icon orange">
            <MdPlayCircleFilled size={22} />
          </div>
          <div>
            <div className="stat-value" style={{ fontSize: '1.5rem' }}>{workingSessions.length}</div>
            <div className="stat-label">Active Working</div>
          </div>
        </div>
      </div>

      {/* Filter Bar Card */}
      <div className="card mb-4" style={{ padding: '20px', marginBottom: '24px' }}>
        <div className="filter-bar">
          <div className="filter-group">
            <label className="filter-label" htmlFor="filter-date">Date</label>
            <input
              id="filter-date"
              type="date"
              className="filter-input-date"
              value={filterDate}
              onChange={e => setFilterDate(e.target.value)}
              max={today}
            />
          </div>

          <div className="filter-group">
            <label className="filter-label" htmlFor="filter-employee">Employee</label>
            <select
              id="filter-employee"
              className="filter-select"
              value={filterEmployee}
              onChange={e => setFilterEmployee(e.target.value)}
            >
              <option value="">All Employees ({profiles.length})</option>
              {profiles.map(p => (
                <option key={p.id} value={p.id}>{p.full_name}</option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label className="filter-label" htmlFor="filter-status">Status</label>
            <select
              id="filter-status"
              className="filter-select"
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
            >
              <option value="">All Status</option>
              <option value="working">Working Now</option>
              <option value="completed">Completed</option>
            </select>
          </div>

          <div className="filter-group" style={{ justifyContent: 'flex-end', alignSelf: 'flex-end' }}>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={() => { setFilterDate(today); setFilterEmployee(''); setFilterStatus(''); }}
            >
              Reset Filters
            </button>
          </div>
        </div>
      </div>

      {/* Directory Section Header */}
      {!loading && sessions.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', padding: '0 4px' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Sessions Log ({sessions.length})
          </span>
          <span style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--brand-primary)', fontFamily: 'var(--font-heading)' }}>
            Total Forms: {totalForms.toLocaleString()}
          </span>
        </div>
      )}

      {/* Sessions Views: Mobile Cards + Desktop Table */}
      {loading ? (
        <div className="g-loading-box" style={{ marginTop: '24px' }}>
          <div className="loading-spinner" />
          <p>Loading session records...</p>
        </div>
      ) : sessions.length === 0 ? (
        <div className="empty-state" style={{ marginTop: '24px' }}>
          <div className="empty-state-icon">📋</div>
          <div className="empty-state-text">No work sessions match your filter criteria.</div>
        </div>
      ) : (
        <>
          {/* Mobile Card Layout (< 768px) */}
          <div className="mobile-sessions-list" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {sessions.map(s => {
              const initials = s.profiles?.full_name
                ? s.profiles.full_name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
                : '??';

              const isWorking = s.status === 'working';

              return (
                <div key={s.id} className="card" style={{ padding: '16px', gap: '12px', display: 'flex', flexDirection: 'column' }}>
                  {/* Top Info Row */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div className="employee-avatar" style={{ width: '38px', height: '38px', fontSize: '0.9rem', flexShrink: 0 }}>
                        {initials}
                      </div>
                      <div>
                        <div style={{ fontWeight: '700', fontSize: '0.98rem', color: 'var(--text-primary)' }}>
                          {s.profiles?.full_name || 'Employee'}
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                          Session #{s.session_number}
                        </div>
                      </div>
                    </div>

                    <span className={`badge ${isWorking ? 'badge-working' : 'badge-completed'}`}>
                      <span className={`status-dot ${isWorking ? 'working' : 'completed'}`} />
                      {isWorking ? 'Working' : 'Completed'}
                    </span>
                  </div>

                  {/* Form Range & Total Cards */}
                  <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '8px', background: 'var(--bg-elevated)', padding: '10px 12px', borderRadius: 'var(--border-radius-sm)', alignItems: 'center' }}>
                    <div>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '2px' }}>
                        Form Range
                      </span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: '700', fontSize: '0.92rem', color: 'var(--text-primary)' }}>
                        {s.starting_form_number?.toLocaleString()} → {s.ending_form_number != null ? s.ending_form_number?.toLocaleString() : 'In Progress'}
                      </span>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase', display: 'block', marginBottom: '2px' }}>
                        Forms
                      </span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: '800', fontSize: '1.15rem', color: 'var(--brand-primary)' }}>
                        {s.total_forms != null ? s.total_forms?.toLocaleString() : '—'}
                      </span>
                    </div>
                  </div>

                  {/* Timestamps */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-muted)', paddingTop: '4px' }}>
                    <span>📅 {formatDateDDMMYYYY(s.work_date)}</span>
                    <span>⏱️ {formatTime(s.start_time)} {s.end_time ? `– ${formatTime(s.end_time)}` : ''}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Desktop Table View (>= 768px) */}
          <div className="table-wrapper desktop-sessions-table">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Employee</th>
                  <th>Session</th>
                  <th>Starting Form</th>
                  <th>Ending Form</th>
                  <th>Total Forms</th>
                  <th>Start Time</th>
                  <th>End Time</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map(s => (
                  <tr key={s.id} id={`session-row-${s.id}`}>
                    <td>{formatDateDDMMYYYY(s.work_date)}</td>
                    <td style={{ fontWeight: '600' }}>
                      {s.profiles?.full_name || '—'}
                    </td>
                    <td className="td-mono">#{s.session_number}</td>
                    <td className="td-mono">{s.starting_form_number?.toLocaleString()}</td>
                    <td className="td-mono">
                      {s.ending_form_number != null
                        ? s.ending_form_number?.toLocaleString()
                        : <span style={{ color: 'var(--text-muted)' }}>—</span>
                      }
                    </td>
                    <td className="td-mono" style={{ fontWeight: '700', color: 'var(--brand-primary)' }}>
                      {s.total_forms != null ? s.total_forms?.toLocaleString() : '—'}
                    </td>
                    <td className="td-mono">{formatTime(s.start_time)}</td>
                    <td className="td-mono">
                      {s.end_time ? formatTime(s.end_time) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                    </td>
                    <td>
                      <span className={`badge ${s.status === 'working' ? 'badge-working' : 'badge-completed'}`}>
                        {s.status === 'working' && <span className="status-dot working" />}
                        {s.status === 'working' ? 'Working' : 'Completed'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
