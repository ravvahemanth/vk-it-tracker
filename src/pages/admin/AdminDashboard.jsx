import { useState, useEffect, useCallback, useRef } from 'react';
import { getAdminDailySummary } from '../../services/api';
import { supabase } from '../../services/supabase';
import { useAuth } from '../../context/AuthContext';
import { getTodayIST, formatTime, formatDate } from '../../utils/dateTime';
import {
  MdPeople, MdWork, MdCheckCircle, MdAssignment,
  MdRefresh, MdError, MdSchedule, MdTrendingUp, MdLeaderboard
} from 'react-icons/md';

export default function AdminDashboard() {
  const today = getTodayIST();
  const { user, loading: authLoading } = useAuth();
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);
  const realtimeRef = useRef(null);

  const loadSummary = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) {
      setIsRefreshing(true);
    }
    setError('');
    try {
      const data = await getAdminDailySummary(today);
      if (data && data.success !== false) {
        setSummary(data);
        setLastUpdated(new Date());
      } else {
        setError(data?.error || 'Failed to load dashboard data.');
      }
    } catch (err) {
      console.error('Admin summary error:', err);
      setError('Failed to load dashboard data. Please click Refresh.');
    } finally {
      setLoading(false);
      if (isManualRefresh) {
        setTimeout(() => setIsRefreshing(false), 500);
      }
    }
  }, [today]);

  useEffect(() => {
    // Wait for auth to be confirmed before loading data
    // This prevents empty data when session is being restored from localStorage
    if (authLoading || !user) return;
    loadSummary();

    const channel = supabase
      .channel('admin-dashboard-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'work_sessions',
        },
        (payload) => {
          if (payload.new?.work_date === today || payload.old?.work_date === today) {
            loadSummary();
          }
        }
      )
      .subscribe();

    realtimeRef.current = channel;

    return () => {
      if (realtimeRef.current) {
        supabase.removeChannel(realtimeRef.current);
      }
    };
  }, [loadSummary, today]);

  if (loading) {
    return (
      <div className="g-dashboard-container">
        <div className="g-loading-box">
          <div className="loading-spinner" />
          <p>Loading real-time admin metrics...</p>
        </div>
      </div>
    );
  }

  const totals = summary?.totals || {};
  const employees = summary?.summary || [];
  const workingEmployees = employees.filter(e => e.last_status === 'working');
  const grandTotalForms = totals.grand_total_forms || employees.reduce((s, e) => s + (e.total_forms_today || 0), 0);

  return (
    <div className="g-dashboard-container">
      {/* Header */}
      <div className="g-dashboard-header">
        <div className="g-header-text">
          <h1 className="g-page-title">Admin Dashboard</h1>
          <div className="g-subtitle">
            <span>{formatDate(today)}</span>
            <span className="g-live-badge">
              <span className="g-live-dot" /> LIVE
            </span>
            {lastUpdated && (
              <span className="g-updated-time">
                · Updated {formatTime(lastUpdated)}
              </span>
            )}
          </div>
        </div>
        <button
          className={`btn btn-outline ${isRefreshing ? 'is-loading' : ''}`}
          onClick={() => loadSummary(true)}
          id="refresh-dashboard-btn"
          aria-label="Refresh Dashboard"
          disabled={isRefreshing}
          style={{ gap: '8px', minWidth: '110px', justifyContent: 'center' }}
        >
          <MdRefresh size={18} className={isRefreshing ? 'spin-anim' : ''} />
          <span>{isRefreshing ? 'Updating...' : 'Refresh'}</span>
        </button>
      </div>

      {error && (
        <div className="alert alert-error mb-lg" role="alert">
          <MdError size={18} /> {error}
          <button className="btn btn-sm btn-ghost ml-auto" onClick={() => loadSummary(true)}>Retry</button>
        </div>
      )}

      {/* Stats Cards Grid */}
      <div className="g-stats-grid">
        <div className="g-stat-card g-blue">
          <div className="g-stat-header">
            <div className="g-stat-icon-badge blue">
              <MdPeople size={20} />
            </div>
            <span className="g-stat-trend">DIRECTORY</span>
          </div>
          <div className="g-stat-value">{employees.length}</div>
          <div className="g-stat-label">Total Employees</div>
        </div>

        <div className="g-stat-card g-green">
          <div className="g-stat-header">
            <div className="g-stat-icon-badge green">
              <MdWork size={20} />
            </div>
            <span className="g-stat-trend active">ACTIVE</span>
          </div>
          <div className="g-stat-value">{totals.currently_working ?? workingEmployees.length}</div>
          <div className="g-stat-label">Working Now</div>
        </div>

        <div className="g-stat-card g-orange">
          <div className="g-stat-header">
            <div className="g-stat-icon-badge orange">
              <MdCheckCircle size={20} />
            </div>
            <span className="g-stat-trend">SESSIONS</span>
          </div>
          <div className="g-stat-value">{totals.total_completed_sessions ?? 0}</div>
          <div className="g-stat-label">Completed Today</div>
        </div>

        <div className="g-stat-card g-purple">
          <div className="g-stat-header">
            <div className="g-stat-icon-badge purple">
              <MdAssignment size={20} />
            </div>
            <span className="g-stat-trend">OUTPUT</span>
          </div>
          <div className="g-stat-value">{grandTotalForms.toLocaleString()}</div>
          <div className="g-stat-label">Forms Today</div>
        </div>
      </div>

      {/* Employee Status List Section */}
      <div className="g-section">
        <div className="g-section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '16px' }}>
          <h2 className="g-section-title" style={{ margin: 0, fontSize: '1.2rem', fontWeight: '800', color: 'var(--text-primary)' }}>
            Today's Employee Activity
          </h2>
          <span style={{
            padding: '5px 12px',
            borderRadius: '20px',
            fontSize: '0.78rem',
            fontWeight: '700',
            background: 'rgba(34, 197, 94, 0.12)',
            color: '#22c55e',
            border: '1px solid rgba(34, 197, 94, 0.3)',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px'
          }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
            {workingEmployees.length} Active Now
          </span>
        </div>


        {employees.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">👥</div>
            <div className="empty-state-text">No employee data recorded for today yet.</div>
          </div>
        ) : (
          <div className="g-employee-list">
            {employees.map(emp => {
              const initials = emp.full_name
                ? emp.full_name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
                : '??';
              const isWorking = emp.last_status === 'working';
              const isCompleted = emp.sessions_today > 0 && !isWorking;

              return (
                <div
                  key={emp.employee_id}
                  className={`g-employee-card ${isWorking ? 'is-working' : ''}`}
                  id={`emp-${emp.username}`}
                >
                  <div className="g-emp-left">
                    <div className={`g-avatar ${isWorking ? 'active' : ''}`}>{initials}</div>
                    <div className="g-emp-info">
                      <div className="g-emp-name">{emp.full_name}</div>
                      <div className="g-emp-sub font-mono">@{emp.username}</div>
                      {isWorking && emp.active_session && (
                        <div className="g-emp-active-detail">
                          <MdSchedule size={12} className="inline mr-1" />
                          Session #{emp.active_session.session_number} · Started at Form {emp.active_session.starting_form_number?.toLocaleString()}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="g-emp-right">
                    <div className="g-emp-forms">
                      <span className="g-forms-num">{(emp.total_forms_today ?? 0).toLocaleString()}</span>
                      <span className="g-forms-lbl">forms</span>
                    </div>
                    <div className="g-status-tag">
                      {isWorking ? (
                        <span className="g-chip chip-working">
                          <span className="g-chip-dot working" /> Working
                        </span>
                      ) : isCompleted ? (
                        <span className="g-chip chip-completed">
                          Completed ({emp.sessions_today})
                        </span>
                      ) : (
                        <span className="g-chip chip-idle">Idle</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Production Summary Card */}
      {employees.some(e => (e.total_forms_today > 0 || e.sessions_today > 0)) && (
        <div className="g-section">
          <div className="g-section-header">
            <h2 className="g-section-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <MdLeaderboard size={20} color="var(--brand-primary)" /> Daily Form Output Breakdown
            </h2>
          </div>
          <div className="g-leaderboard-card">
            {employees
              .filter(e => (e.total_forms_today > 0 || e.sessions_today > 0))
              .sort((a, b) => (b.total_forms_today ?? 0) - (a.total_forms_today ?? 0))
              .map((emp, index) => {
                const maxForms = Math.max(...employees.map(e => e.total_forms_today || 0), 1);
                const percent = Math.min(Math.round(((emp.total_forms_today || 0) / maxForms) * 100), 100);

                return (
                  <div key={emp.employee_id} className="g-leader-row" style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div className="g-leader-rank">{index + 1}</div>
                        <div className="g-leader-name">{emp.full_name}</div>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <div className="g-leader-sessions">{emp.sessions_today} sess</div>
                        <div className="g-leader-forms">{(emp.total_forms_today ?? 0).toLocaleString()} forms</div>
                      </div>
                    </div>
                    {/* Visual Meter Bar */}
                    <div style={{ width: '100%', background: 'rgba(255, 255, 255, 0.06)', borderRadius: '4px', height: '6px', overflow: 'hidden' }}>
                      <div style={{ width: percent + '%', background: 'linear-gradient(90deg, #3b82f6 0%, #60a5fa 100%)', height: '100%', borderRadius: '4px', transition: 'width 0.4s ease' }} />
                    </div>

                  </div>
                );
              })}

            <div className="g-leader-total-row">
              <div className="g-leader-rank">Σ</div>
              <div className="g-leader-name font-bold">TOTAL TODAY</div>
              <div className="g-leader-sessions">{employees.reduce((s, e) => s + (e.sessions_today ?? 0), 0)} sess</div>
              <div className="g-leader-forms total">{grandTotalForms.toLocaleString()} forms</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
