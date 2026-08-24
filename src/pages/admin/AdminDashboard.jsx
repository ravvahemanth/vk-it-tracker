import { useState, useEffect, useCallback, useRef } from 'react';
import { getAdminDailySummary } from '../../services/api';
import { supabase } from '../../services/supabase';
import { getTodayIST, formatTime, formatDate } from '../../utils/dateTime';
import {
  MdPeople, MdWork, MdCheckCircle, MdAssignment,
  MdRefresh, MdError, MdTrendingUp, MdSchedule
} from 'react-icons/md';

export default function AdminDashboard() {
  const today = getTodayIST();
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);
  const realtimeRef = useRef(null);

  const loadSummary = useCallback(async () => {
    setError('');
    try {
      const data = await getAdminDailySummary(today);
      if (data?.success) {
        setSummary(data);
        setLastUpdated(new Date());
      } else {
        setError(data?.error || 'Failed to load dashboard data.');
      }
    } catch (err) {
      console.error('Admin summary error:', err);
      setError('Failed to load dashboard data. Please refresh.');
    } finally {
      setLoading(false);
    }
  }, [today]);

  useEffect(() => {
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
          <p>Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const totals = summary?.totals || {};
  const employees = summary?.summary || [];
  const workingEmployees = employees.filter(e => e.last_status === 'working');

  return (
    <div className="g-dashboard-container">
      {/* Google Style Header */}
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
                · {formatTime(lastUpdated)}
              </span>
            )}
          </div>
        </div>
        <button className="g-refresh-btn" onClick={loadSummary} id="refresh-dashboard-btn" aria-label="Refresh Dashboard">
          <MdRefresh size={20} />
          <span className="g-btn-text">Refresh</span>
        </button>
      </div>

      {error && (
        <div className="alert alert-error mb-lg" role="alert">
          <MdError size={18} /> {error}
        </div>
      )}

      {/* Google Style Stat Cards Grid (2x2 on Mobile, 4x1 on Desktop) */}
      <div className="g-stats-grid">
        <div className="g-stat-card g-blue">
          <div className="g-stat-header">
            <div className="g-stat-icon-badge blue">
              <MdPeople size={20} />
            </div>
            <span className="g-stat-trend">Total</span>
          </div>
          <div className="g-stat-value">{employees.length}</div>
          <div className="g-stat-label">Employees</div>
        </div>

        <div className="g-stat-card g-green">
          <div className="g-stat-header">
            <div className="g-stat-icon-badge green">
              <MdWork size={20} />
            </div>
            <span className="g-stat-trend active">Working</span>
          </div>
          <div className="g-stat-value">{totals.currently_working ?? 0}</div>
          <div className="g-stat-label">Active Now</div>
        </div>

        <div className="g-stat-card g-orange">
          <div className="g-stat-header">
            <div className="g-stat-icon-badge orange">
              <MdCheckCircle size={20} />
            </div>
            <span className="g-stat-trend">Completed</span>
          </div>
          <div className="g-stat-value">{totals.total_completed_sessions ?? 0}</div>
          <div className="g-stat-label">Sessions</div>
        </div>

        <div className="g-stat-card g-purple">
          <div className="g-stat-header">
            <div className="g-stat-icon-badge purple">
              <MdAssignment size={20} />
            </div>
            <span className="g-stat-trend">Production</span>
          </div>
          <div className="g-stat-value">{(totals.grand_total_forms ?? 0).toLocaleString()}</div>
          <div className="g-stat-label">Forms Today</div>
        </div>
      </div>

      {/* Employee Status List Section */}
      <div className="g-section">
        <div className="g-section-header">
          <div className="g-section-title-wrap">
            <h2 className="g-section-title">Today's Employee Status</h2>
            <span className="g-section-count">{workingEmployees.length} Working Now</span>
          </div>
        </div>

        {employees.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">👥</div>
            <div className="empty-state-text">No employee data available.</div>
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
                          Session #{emp.active_session.session_number} · Form {emp.active_session.starting_form_number?.toLocaleString()}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="g-emp-right">
                    <div className="g-emp-forms">
                      <span className="g-forms-num">{emp.total_forms_today?.toLocaleString() ?? 0}</span>
                      <span className="g-forms-lbl">forms</span>
                    </div>
                    <div className="g-status-tag">
                      {isWorking ? (
                        <span className="g-chip chip-working">
                          <span className="g-chip-dot working" /> Working
                        </span>
                      ) : isCompleted ? (
                        <span className="g-chip chip-completed">Done</span>
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

      {/* Production Leaderboard Card */}
      {employees.some(e => e.total_forms_today > 0) && (
        <div className="g-section">
          <div className="g-section-header">
            <h2 className="g-section-title">Daily Production Leaderboard</h2>
          </div>
          <div className="g-leaderboard-card">
            {employees
              .filter(e => e.total_forms_today > 0 || e.sessions_today > 0)
              .sort((a, b) => (b.total_forms_today ?? 0) - (a.total_forms_today ?? 0))
              .map((emp, index) => (
                <div key={emp.employee_id} className="g-leader-row">
                  <div className="g-leader-rank">{index + 1}</div>
                  <div className="g-leader-name">{emp.full_name}</div>
                  <div className="g-leader-sessions">{emp.sessions_today} sess</div>
                  <div className="g-leader-forms">{(emp.total_forms_today ?? 0).toLocaleString()} forms</div>
                </div>
              ))}

            <div className="g-leader-total-row">
              <div className="g-leader-rank">Σ</div>
              <div className="g-leader-name font-bold">TOTAL TODAY</div>
              <div className="g-leader-sessions">{employees.reduce((s, e) => s + (e.sessions_today ?? 0), 0)} sess</div>
              <div className="g-leader-forms total">{(totals.grand_total_forms ?? 0).toLocaleString()} forms</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
