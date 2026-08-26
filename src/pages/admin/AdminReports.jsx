import { useState, useEffect, useCallback } from 'react';
import { getAdminSessionsForExport, getAdminDailySummary, getAllProfiles } from '../../services/api';
import { exportToExcel } from '../../utils/excelExport';
import { getTodayIST, formatDate } from '../../utils/dateTime';
import { useAuth } from '../../context/AuthContext';
import {
  MdDownload, MdRefresh, MdFilterList, MdAssessment,
  MdAssignment, MdPeople, MdWork, MdCheckCircle,
  MdWarning, MdCalendarToday, MdPerson
} from 'react-icons/md';

export default function AdminReports() {
  const today = getTodayIST();
  const { user, loading: authLoading } = useAuth();

  const [exportDate, setExportDate] = useState(today);
  const [exportEmployee, setExportEmployee] = useState('');
  const [exportStatus, setExportStatus] = useState('');

  const [loading, setLoading] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [summary, setSummary] = useState(null);
  const [profiles, setProfiles] = useState([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const handleLoadSummary = useCallback(async (isManual = false) => {
    if (isManual) setIsRefreshing(true);
    setSummaryLoading(true);
    setError('');
    try {
      const data = await getAdminDailySummary(exportDate);
      if (data && data.success !== false) {
        setSummary(data);
      }
    } catch (err) {
      console.error('Error loading summary:', err);
      setError('Failed to load daily production summary.');
    } finally {
      setSummaryLoading(false);
      if (isManual) setTimeout(() => setIsRefreshing(false), 600);
    }
  }, [exportDate]);

  useEffect(() => {
    if (authLoading || !user) return;
    getAllProfiles().then(data => setProfiles(data || [])).catch(() => {});
    handleLoadSummary();
  }, [handleLoadSummary, authLoading, user]);

  async function handleExport() {
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const sessions = await getAdminSessionsForExport({
        date: exportDate || undefined,
        employeeId: exportEmployee || undefined,
        status: exportStatus || undefined,
      });
      if (!sessions || sessions.length === 0) {
        setError('No sessions found for the selected filters. Nothing to export.');
        return;
      }
      exportToExcel(sessions, exportDate);
      setMessage(`✅ Exported ${sessions.length} session records to Excel.`);
      setTimeout(() => setMessage(''), 6000);
    } catch (err) {
      console.error('Export error:', err);
      setError('Excel export failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  // Build employee display source
  const employeeSource = summary?.summary && summary.summary.length > 0
    ? summary.summary
    : profiles.map(p => ({
        employee_id: p.id,
        full_name: p.full_name,
        username: p.username,
        is_active: p.is_active,
        sessions_today: 0,
        total_forms_today: 0,
        last_status: 'not_working'
      }));

  const filteredEmployees = employeeSource.filter(emp => {
    if (exportEmployee && emp.employee_id !== exportEmployee) return false;
    if (exportStatus === 'working' && emp.last_status !== 'working') return false;
    if (exportStatus === 'completed' && emp.sessions_today === 0) return false;
    return true;
  });

  const totalFormsCount = filteredEmployees.reduce((sum, e) => sum + (e.total_forms_today || 0), 0);
  const totalSessionsCount = filteredEmployees.reduce((sum, e) => sum + (e.sessions_today || 0), 0);
  const activeWorkingCount = filteredEmployees.filter(e => e.last_status === 'working').length;
  const maxForms = Math.max(...filteredEmployees.map(e => e.total_forms_today || 0), 1);

  return (
    <div className="g-dashboard-container">

      {/* ── Page Header ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '28px', gap: '16px', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: '800', color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.02em' }}>
            Reports & Export
          </h1>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>
            Analyze daily production and download Excel reports
          </p>
        </div>
        <button
          className={`btn btn-outline ${isRefreshing ? 'is-loading' : ''}`}
          onClick={() => handleLoadSummary(true)}
          id="refresh-reports-btn"
          disabled={isRefreshing || summaryLoading}
          style={{ gap: '8px', minWidth: '120px', justifyContent: 'center', height: '42px' }}
        >
          <MdRefresh size={18} className={isRefreshing ? 'spin-anim' : ''} />
          {isRefreshing ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {/* ── Alerts ── */}
      {error && (
        <div style={{ background: 'var(--color-error-bg)', border: '1px solid var(--color-error-border)', borderRadius: '10px', padding: '14px 18px', display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', color: 'var(--color-error)', fontSize: '0.9rem', fontWeight: '500' }}>
          <MdWarning size={18} />{error}
        </div>
      )}
      {message && (
        <div style={{ background: 'var(--color-success-bg)', border: '1px solid var(--color-success-border)', borderRadius: '10px', padding: '14px 18px', display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', color: 'var(--color-success)', fontSize: '0.9rem', fontWeight: '500' }}>
          <MdCheckCircle size={18} />{message}
        </div>
      )}

      {/* ── Filter + Export Panel ── */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '16px', padding: '24px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
          <MdFilterList size={20} color="var(--brand-primary)" />
          <span style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--text-primary)' }}>Filter & Download</span>
        </div>

        {/* Filter Inputs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '14px', marginBottom: '20px' }}>
          <div>
            <label style={{ fontSize: '0.72rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '7px' }}>
              <MdCalendarToday size={12} />Date
            </label>
            <input
              id="export-date"
              type="date"
              className="form-input"
              value={exportDate}
              max={today}
              onChange={e => { setExportDate(e.target.value); setMessage(''); setError(''); }}
              style={{ width: '100%', height: '42px', fontSize: '0.9rem' }}
            />
          </div>

          <div>
            <label style={{ fontSize: '0.72rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '7px' }}>
              <MdPerson size={12} />Employee
            </label>
            <select
              id="export-employee"
              className="form-input"
              value={exportEmployee}
              onChange={e => setExportEmployee(e.target.value)}
              style={{ width: '100%', height: '42px', fontSize: '0.9rem' }}
            >
              <option value="">All Employees ({profiles.length})</option>
              {profiles.map(p => (
                <option key={p.id} value={p.id}>{p.full_name}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ fontSize: '0.72rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '7px' }}>
              <MdCheckCircle size={12} />Status
            </label>
            <select
              id="export-status"
              className="form-input"
              value={exportStatus}
              onChange={e => setExportStatus(e.target.value)}
              style={{ width: '100%', height: '42px', fontSize: '0.9rem' }}
            >
              <option value="">All Statuses</option>
              <option value="completed">✅ Completed Only</option>
              <option value="working">🟡 Working Only</option>
            </select>
          </div>
        </div>

        {/* Download Button */}
        <button
          id="download-excel-btn"
          className="btn btn-primary"
          onClick={handleExport}
          disabled={loading}
          style={{ width: '100%', height: '48px', fontSize: '0.95rem', fontWeight: '700', justifyContent: 'center', gap: '10px', borderRadius: '10px', letterSpacing: '0.02em' }}
        >
          {loading ? (
            <><div className="loading-spinner sm" />Generating Excel Report...</>
          ) : (
            <><MdDownload size={20} />Download Excel Report — {formatDate(exportDate)}</>
          )}
        </button>

        <p style={{ marginTop: '10px', fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          Output file:
          <code style={{ background: 'var(--bg-elevated)', padding: '2px 8px', borderRadius: '5px', color: 'var(--brand-primary)', fontFamily: 'var(--font-mono)', fontSize: '0.78rem' }}>
            VK_IT_Attendance_{exportDate}.xlsx
          </code>
        </p>
      </div>

      {/* ── KPI Metric Cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '14px', marginBottom: '24px' }}>
        {[
          { icon: <MdAssignment size={20} />, color: '#a78bfa', bg: 'rgba(167,139,250,0.15)', label: 'Total Forms', value: totalFormsCount.toLocaleString(), sub: formatDate(exportDate) },
          { icon: <MdCheckCircle size={20} />, color: '#f59e0b', bg: 'rgba(245,158,11,0.15)', label: 'Completed Sessions', value: totalSessionsCount, sub: 'sessions done' },
          { icon: <MdWork size={20} />, color: '#22c55e', bg: 'rgba(34,197,94,0.15)', label: 'Working Now', value: activeWorkingCount, sub: 'active employees' },
          { icon: <MdPeople size={20} />, color: '#4f7eff', bg: 'rgba(79,126,255,0.15)', label: 'Listed', value: filteredEmployees.length, sub: 'employees shown' },
        ].map((card, i) => (
          <div key={i} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '14px', padding: '18px 20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: card.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, color: card.color }}>
              {card.icon}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '1.6rem', fontWeight: '800', color: card.color, lineHeight: 1 }}>{card.value}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600', marginTop: '3px' }}>{card.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Production Breakdown ── */}
      <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '16px', overflow: 'hidden' }}>
        {/* Section Header */}
        <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <MdAssessment size={20} color="var(--brand-primary)" />
            <span style={{ fontWeight: '700', fontSize: '1rem', color: 'var(--text-primary)' }}>
              Employee Production — {formatDate(exportDate)}
            </span>
          </div>
          <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontWeight: '600' }}>
            {filteredEmployees.length} listed
          </span>
        </div>

        {/* Employee Rows */}
        {summaryLoading ? (
          <div style={{ textAlign: 'center', padding: '50px 20px', color: 'var(--text-muted)' }}>
            <div className="loading-spinner" style={{ margin: '0 auto 14px' }} />
            <p style={{ fontSize: '0.9rem' }}>Loading production data...</p>
          </div>
        ) : filteredEmployees.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '50px 20px', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '10px' }}>📊</div>
            <div style={{ fontWeight: '600', fontSize: '0.95rem' }}>No records found</div>
          </div>
        ) : (
          <div>
            {filteredEmployees.map((emp, index) => {
              const percent = Math.min(Math.round(((emp.total_forms_today || 0) / maxForms) * 100), 100);
              const isWorking = emp.last_status === 'working';
              const isDone = emp.sessions_today > 0;
              const statusColor = isWorking ? '#f59e0b' : isDone ? '#22c55e' : 'var(--text-muted)';
              const statusBg = isWorking ? 'rgba(245,158,11,0.12)' : isDone ? 'rgba(34,197,94,0.1)' : 'rgba(139,149,179,0.1)';
              const statusBorder = isWorking ? 'rgba(245,158,11,0.3)' : isDone ? 'rgba(34,197,94,0.25)' : 'rgba(139,149,179,0.2)';
              const label = isWorking ? 'Working' : isDone ? 'Done' : 'Idle';

              return (
                <div key={emp.employee_id}
                  style={{
                    padding: '14px 20px',
                    borderBottom: index < filteredEmployees.length - 1 ? '1px solid var(--border-color)' : 'none',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-card-hover)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                >
                  {/* Row Top */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginBottom: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                      {/* Rank */}
                      <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)', flexShrink: 0 }}>
                        {index + 1}
                      </div>
                      {/* Name */}
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: '700', fontSize: '0.95rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{emp.full_name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>@{emp.username}</div>
                      </div>
                    </div>

                    {/* Right side stats */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexShrink: 0, flexWrap: 'wrap' }}>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase' }}>Sessions</div>
                        <div style={{ fontWeight: '700', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>{emp.sessions_today}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase' }}>Forms</div>
                        <div style={{ fontWeight: '800', color: 'var(--brand-primary)', fontSize: '1rem', fontFamily: 'var(--font-mono)' }}>{(emp.total_forms_today || 0).toLocaleString()}</div>
                      </div>
                      <span style={{ padding: '4px 11px', borderRadius: '20px', fontSize: '0.72rem', fontWeight: '700', background: statusBg, color: statusColor, border: `1px solid ${statusBorder}`, whiteSpace: 'nowrap' }}>
                        {label}
                      </span>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div style={{ height: '5px', background: 'var(--bg-elevated)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ width: percent + '%', height: '100%', borderRadius: '3px', background: isWorking ? 'linear-gradient(90deg,#f59e0b,#fbbf24)' : isDone ? 'linear-gradient(90deg,#4f7eff,#60a5fa)' : 'var(--bg-elevated)', transition: 'width 0.5s ease' }} />
                  </div>
                </div>
              );
            })}

            {/* Total Footer Row */}
            <div style={{ padding: '16px 20px', background: 'var(--bg-elevated)', borderTop: '2px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--brand-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem', fontWeight: '800', color: '#fff' }}>Σ</div>
                <span style={{ fontWeight: '700', fontSize: '0.95rem', color: 'var(--text-primary)' }}>TOTAL OUTPUT</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontWeight: '600' }}>{totalSessionsCount} sessions</span>
                <span style={{ fontSize: '1.2rem', fontWeight: '800', color: 'var(--brand-primary)', fontFamily: 'var(--font-mono)' }}>{totalFormsCount.toLocaleString()} forms</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
