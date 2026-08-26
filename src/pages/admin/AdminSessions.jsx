import { useState, useEffect, useCallback } from 'react';
import { getAdminSessions, getAllProfiles } from '../../services/api';
import { getTodayIST, formatDateDDMMYYYY, formatTime } from '../../utils/dateTime';
import { useAuth } from '../../context/AuthContext';
import {
  MdRefresh, MdFilterList, MdAssignment, MdCheckCircle,
  MdPlayCircleFilled, MdRestartAlt, MdSearch, MdCalendarToday,
  MdPerson, MdAccessTime, MdNumbers, MdWarning
} from 'react-icons/md';

export default function AdminSessions() {
  const today = getTodayIST();
  const { user, loading: authLoading } = useAuth();

  const [sessions, setSessions] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState('');

  const [filterDate, setFilterDate] = useState('');
  const [filterEmployee, setFilterEmployee] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const loadData = useCallback(async (isManual = false) => {
    if (isManual) setIsRefreshing(true);
    setLoading(true);
    setError('');
    try {
      const [sessionsRes, profilesRes] = await Promise.allSettled([
        getAdminSessions({
          date: filterDate || undefined,
          employeeId: filterEmployee || undefined,
          status: filterStatus || undefined,
          pageSize: 200,
        }),
        getAllProfiles(),
      ]);

      const fetchedSessions = sessionsRes.status === 'fulfilled' ? sessionsRes.value : [];
      const fetchedProfiles = profilesRes.status === 'fulfilled' ? profilesRes.value : [];

      setSessions(fetchedSessions || []);
      setProfiles(fetchedProfiles || []);

      if (sessionsRes.status === 'rejected' && profilesRes.status === 'rejected') {
        setError('Unable to reach database. Please click Refresh.');
      }
    } catch (err) {
      console.error('Sessions load error:', err);
      setError('Failed to load sessions. Please try again.');
    } finally {
      setLoading(false);
      if (isManual) setTimeout(() => setIsRefreshing(false), 600);
    }
  }, [filterDate, filterEmployee, filterStatus]);

  useEffect(() => {
    if (authLoading || !user) return;
    loadData();
  }, [loadData, authLoading, user]);

  const completedSessions = sessions.filter(s => s.status === 'completed');
  const workingSessions = sessions.filter(s => s.status === 'working');
  const totalForms = completedSessions.reduce((sum, s) => sum + (s.total_forms || 0), 0);

  const resetFilters = () => {
    setFilterDate(today);
    setFilterEmployee('');
    setFilterStatus('');
  };

  const hasActiveFilters = filterDate !== today || filterEmployee !== '' || filterStatus !== '';

  return (
    <div className="g-dashboard-container">

      {/* ── Page Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '28px', gap: '16px', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: '800', color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.02em' }}>
            Work Sessions
          </h1>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>
            Track and audit all employee form entry sessions
          </p>
        </div>
        <button
          className={`btn btn-outline ${isRefreshing ? 'is-loading' : ''}`}
          onClick={() => loadData(true)}
          id="refresh-sessions-btn"
          disabled={isRefreshing || loading}
          style={{ gap: '8px', minWidth: '120px', justifyContent: 'center', height: '42px' }}
        >
          <MdRefresh size={18} className={isRefreshing ? 'spin-anim' : ''} />
          {isRefreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {/* ── KPI Cards ── */}
      <div className="g-stats-grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px', marginBottom: '24px' }}>
        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '14px', padding: '18px 20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'rgba(79,126,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <MdAssignment size={22} color="#4f7eff" />
          </div>
          <div>
            <div style={{ fontSize: '1.6rem', fontWeight: '800', color: 'var(--text-primary)', lineHeight: 1 }}>{sessions.length}</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '4px' }}>Total Sessions</div>
          </div>
        </div>

        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '14px', padding: '18px 20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'rgba(34,197,94,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <MdCheckCircle size={22} color="#22c55e" />
          </div>
          <div>
            <div style={{ fontSize: '1.6rem', fontWeight: '800', color: '#22c55e', lineHeight: 1 }}>{totalForms.toLocaleString()}</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '4px' }}>Forms Completed</div>
          </div>
        </div>

        <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '14px', padding: '18px 20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: 'rgba(245,158,11,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <MdPlayCircleFilled size={22} color="#f59e0b" />
          </div>
          <div>
            <div style={{ fontSize: '1.6rem', fontWeight: '800', color: '#f59e0b', lineHeight: 1 }}>{workingSessions.length}</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '4px' }}>Active Now</div>
          </div>
        </div>
      </div>

      {/* ── Filter Panel ── */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '14px', padding: '20px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <MdFilterList size={18} color="var(--brand-primary)" />
          <span style={{ fontSize: '0.9rem', fontWeight: '700', color: 'var(--text-primary)' }}>Filter Sessions</span>
        </div>

        <div className="g-filter-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', alignItems: 'end' }}>

          <div>
            <label style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '6px' }}>
              <MdCalendarToday size={12} style={{ marginRight: '4px', verticalAlign: 'middle' }} />Date
            </label>
            <input
              id="filter-date"
              type="date"
              className="form-input"
              value={filterDate}
              onChange={e => setFilterDate(e.target.value)}
              max={today}
              style={{ width: '100%', height: '40px', fontSize: '0.9rem' }}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '6px' }}>
              <MdPerson size={12} style={{ marginRight: '4px', verticalAlign: 'middle' }} />Employee
            </label>
            <select
              id="filter-employee"
              className="form-input"
              value={filterEmployee}
              onChange={e => setFilterEmployee(e.target.value)}
              style={{ width: '100%', height: '40px', fontSize: '0.9rem' }}
            >
              <option value="">All Employees ({profiles.length})</option>
              {profiles.map(p => (
                <option key={p.id} value={p.id}>{p.full_name}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ fontSize: '0.75rem', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '6px' }}>
              <MdSearch size={12} style={{ marginRight: '4px', verticalAlign: 'middle' }} />Status
            </label>
            <select
              id="filter-status"
              className="form-input"
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              style={{ width: '100%', height: '40px', fontSize: '0.9rem' }}
            >
              <option value="">All Status</option>
              <option value="working">🟡 Working Now</option>
              <option value="completed">✅ Completed</option>
            </select>
          </div>

          {hasActiveFilters && (
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: '600', color: 'transparent', display: 'block', marginBottom: '6px' }}>.</label>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={resetFilters}
                style={{ width: '100%', height: '40px', gap: '6px', justifyContent: 'center' }}
              >
                <MdRestartAlt size={16} /> Reset
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Error Banner ── */}
      {error && (
        <div style={{ background: 'var(--color-error-bg)', border: '1px solid var(--color-error-border)', borderRadius: '10px', padding: '14px 18px', display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', color: 'var(--color-error)', fontSize: '0.9rem', fontWeight: '500' }}>
          <MdWarning size={18} />
          <span>{error}</span>
          <button onClick={() => loadData(true)} style={{ marginLeft: 'auto', background: 'transparent', border: 'none', color: 'var(--color-error)', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '600', textDecoration: 'underline' }}>
            Retry
          </button>
        </div>
      )}

      {/* ── Sessions List ── */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
          <div className="loading-spinner" style={{ margin: '0 auto 16px' }} />
          <p style={{ fontSize: '0.95rem' }}>Loading session records...</p>
        </div>
      ) : sessions.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: '3rem', marginBottom: '12px' }}>📋</div>
          <div style={{ fontSize: '1.05rem', fontWeight: '600', marginBottom: '6px' }}>No sessions found</div>
          <div style={{ fontSize: '0.85rem' }}>Try changing the date or clearing filters</div>
        </div>
      ) : (
        <>
          {/* Count bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', padding: '0 2px' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              {sessions.length} Session{sessions.length !== 1 ? 's' : ''} Found
            </span>
            <span style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--brand-primary)' }}>
              {totalForms.toLocaleString()} Total Forms
            </span>
          </div>

          {/* ── MOBILE CARDS (hidden on desktop) ── */}
          <div className="mobile-sessions-list" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {sessions.map(s => {
              const isWorking = s.status === 'working';
              const initials = s.profiles?.full_name
                ? s.profiles.full_name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
                : '??';
              return (
                <div key={s.id} style={{ background: 'var(--bg-card)', border: `1px solid ${isWorking ? 'rgba(245,158,11,0.3)' : 'var(--border-color)'}`, borderRadius: '14px', overflow: 'hidden' }}>
                  {/* Header */}
                  <div style={{ padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <div className="employee-avatar" style={{ width: '36px', height: '36px', fontSize: '0.85rem', flexShrink: 0 }}>{initials}</div>
                      <div>
                        <div style={{ fontWeight: '700', fontSize: '0.95rem', color: 'var(--text-primary)' }}>{s.profiles?.full_name || 'Employee'}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>Session #{s.session_number} · {formatDateDDMMYYYY(s.work_date)}</div>
                      </div>
                    </div>
                    <span style={{
                      padding: '4px 10px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: '700',
                      background: isWorking ? 'rgba(245,158,11,0.15)' : 'rgba(34,197,94,0.12)',
                      color: isWorking ? '#f59e0b' : '#22c55e',
                      border: `1px solid ${isWorking ? 'rgba(245,158,11,0.3)' : 'rgba(34,197,94,0.3)'}`,
                      display: 'flex', alignItems: 'center', gap: '5px'
                    }}>
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: isWorking ? '#f59e0b' : '#22c55e', display: 'inline-block' }} />
                      {isWorking ? 'Working' : 'Done'}
                    </span>
                  </div>

                  {/* Data Grid */}
                  <div style={{ padding: '14px 16px', display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                    <div>
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '600', marginBottom: '4px' }}>Start Form</div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontWeight: '700', fontSize: '1rem', color: 'var(--text-primary)' }}>{s.starting_form_number?.toLocaleString() ?? '—'}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '600', marginBottom: '4px' }}>End Form</div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontWeight: '700', fontSize: '1rem', color: s.ending_form_number != null ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                        {s.ending_form_number != null ? s.ending_form_number.toLocaleString() : '—'}
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '600', marginBottom: '4px' }}>Total</div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontWeight: '800', fontSize: '1.1rem', color: 'var(--brand-primary)' }}>
                        {s.total_forms != null ? s.total_forms.toLocaleString() : '—'}
                      </div>
                    </div>
                  </div>

                  {/* Time Row */}
                  <div style={{ padding: '10px 16px', background: 'var(--bg-elevated)', display: 'flex', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <MdAccessTime size={14} />Start: {formatTime(s.start_time)}
                    </span>
                    {s.end_time && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <MdAccessTime size={14} />End: {formatTime(s.end_time)}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── DESKTOP TABLE (hidden on mobile) ── */}
          <div className="desktop-sessions-table" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '14px', overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--bg-elevated)', borderBottom: '2px solid var(--border-color)' }}>
                  {['Date', 'Employee', 'Session', 'Start Form', 'End Form', 'Total Forms', 'Start Time', 'End Time', 'Status'].map(h => (
                    <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '0.72rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', whiteSpace: 'nowrap' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sessions.map((s, idx) => {
                  const isWorking = s.status === 'working';
                  return (
                    <tr key={s.id} id={`session-row-${s.id}`}
                      style={{ borderBottom: '1px solid var(--border-color)', background: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)', transition: 'background 0.15s' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-card-hover)'}
                      onMouseLeave={e => e.currentTarget.style.background = idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)'}
                    >
                      <td style={{ padding: '13px 16px', fontSize: '0.88rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{formatDateDDMMYYYY(s.work_date)}</td>
                      <td style={{ padding: '13px 16px', fontWeight: '600', color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>{s.profiles?.full_name || '—'}</td>
                      <td style={{ padding: '13px 16px', fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: 'var(--text-muted)' }}>#{s.session_number}</td>
                      <td style={{ padding: '13px 16px', fontFamily: 'var(--font-mono)', fontWeight: '600', color: 'var(--text-primary)' }}>{s.starting_form_number?.toLocaleString()}</td>
                      <td style={{ padding: '13px 16px', fontFamily: 'var(--font-mono)', fontWeight: '600', color: s.ending_form_number != null ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                        {s.ending_form_number != null ? s.ending_form_number.toLocaleString() : '—'}
                      </td>
                      <td style={{ padding: '13px 16px', fontFamily: 'var(--font-mono)', fontWeight: '800', fontSize: '0.95rem', color: 'var(--brand-primary)' }}>
                        {s.total_forms != null ? s.total_forms.toLocaleString() : '—'}
                      </td>
                      <td style={{ padding: '13px 16px', fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{formatTime(s.start_time)}</td>
                      <td style={{ padding: '13px 16px', fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        {s.end_time ? formatTime(s.end_time) : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                      </td>
                      <td style={{ padding: '13px 16px' }}>
                        <span style={{
                          padding: '4px 10px', borderRadius: '20px', fontSize: '0.73rem', fontWeight: '700', whiteSpace: 'nowrap',
                          background: isWorking ? 'rgba(245,158,11,0.15)' : 'rgba(34,197,94,0.12)',
                          color: isWorking ? '#f59e0b' : '#22c55e',
                          border: `1px solid ${isWorking ? 'rgba(245,158,11,0.3)' : 'rgba(34,197,94,0.3)'}`,
                          display: 'inline-flex', alignItems: 'center', gap: '5px'
                        }}>
                          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: isWorking ? '#f59e0b' : '#22c55e', display: 'inline-block', ...(isWorking ? { animation: 'pulse 1.5s infinite' } : {}) }} />
                          {isWorking ? 'Working' : 'Completed'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
