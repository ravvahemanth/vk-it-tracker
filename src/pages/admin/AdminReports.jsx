import { useState, useEffect, useCallback } from 'react';
import { getAdminSessionsForExport, getAdminDailySummary, getAllProfiles } from '../../services/api';
import { exportToExcel } from '../../utils/excelExport';
import { getTodayIST, formatDate } from '../../utils/dateTime';
import {
  MdDownload, MdRefresh, MdError, MdCheckCircle,
  MdFilterList, MdAssessment, MdAssignment, MdPeople, MdWork
} from 'react-icons/md';

export default function AdminReports() {
  const today = getTodayIST();

  const [exportDate, setExportDate] = useState(today);
  const [exportEmployee, setExportEmployee] = useState('');
  const [exportStatus, setExportStatus] = useState('');

  const [loading, setLoading] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
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
      if (isManual) {
        setTimeout(() => setIsRefreshing(false), 500);
      }
    }
  }, [exportDate]);

  useEffect(() => {
    getAllProfiles().then(data => setProfiles(data || [])).catch(() => {});
    handleLoadSummary();
  }, [handleLoadSummary]);

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
        setError('No sessions found for the selected date and filters. Nothing to export.');
        return;
      }

      exportToExcel(sessions, exportDate);
      setMessage(`✅ Successfully exported ${sessions.length} session records to Excel.`);
      setTimeout(() => setMessage(''), 6000);
    } catch (err) {
      console.error('Export error:', err);
      setError('Excel export failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const rawEmployees = summary?.summary || [];
  const filteredEmployees = rawEmployees.filter(emp => {
    if (exportEmployee && emp.employee_id !== exportEmployee) return false;
    if (exportStatus === 'working' && emp.last_status !== 'working') return false;
    if (exportStatus === 'completed' && emp.sessions_today === 0) return false;
    return true;
  });

  const totalFormsCount = filteredEmployees.reduce((sum, emp) => sum + (emp.total_forms_today || 0), 0);
  const totalSessionsCount = filteredEmployees.reduce((sum, emp) => sum + (emp.sessions_today || 0), 0);
  const activeWorkingCount = filteredEmployees.filter(e => e.last_status === 'working').length;

  return (
    <div className="g-dashboard-container">
      {/* Header */}
      <div className="g-dashboard-header">
        <div className="g-header-text">
          <h1 className="g-page-title">Reports & Export</h1>
          <p className="g-subtitle">Generate Excel reports and analyze daily employee form production</p>
        </div>
        <button
          className={`btn btn-outline ${isRefreshing ? 'is-loading' : ''}`}
          onClick={() => handleLoadSummary(true)}
          id="refresh-reports-btn"
          disabled={isRefreshing || summaryLoading}
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

      {message && (
        <div className="alert alert-success mb-lg" role="status">
          <MdCheckCircle size={18} /> {message}
        </div>
      )}

      {/* Control Panel: Filters + Download */}
      <div className="card p-4 mb-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <MdFilterList size={22} color="var(--brand-primary)" />
          <h2 style={{ fontSize: '1.1rem', fontWeight: '700', margin: 0, color: 'var(--text-primary)' }}>
            Filter & Download Controls
          </h2>
        </div>

        <div className="filter-bar mb-lg" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
          <div className="filter-group">
            <label className="filter-label" htmlFor="export-date">Select Date</label>
            <input
              id="export-date"
              type="date"
              className="filter-input-date form-input"
              value={exportDate}
              max={today}
              onChange={e => {
                setExportDate(e.target.value);
                setMessage('');
                setError('');
              }}
              style={{ width: '100%' }}
            />
          </div>

          <div className="filter-group">
            <label className="filter-label" htmlFor="export-employee">Filter Employee</label>
            <select
              id="export-employee"
              className="filter-select form-input"
              value={exportEmployee}
              onChange={e => setExportEmployee(e.target.value)}
              style={{ width: '100%' }}
            >
              <option value="">All Employees ({profiles.length})</option>
              {profiles.map(p => (
                <option key={p.id} value={p.id}>{p.full_name} (@{p.username})</option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label className="filter-label" htmlFor="export-status">Status Filter</label>
            <select
              id="export-status"
              className="filter-select form-input"
              value={exportStatus}
              onChange={e => setExportStatus(e.target.value)}
              style={{ width: '100%' }}
            >
              <option value="">All Statuses</option>
              <option value="completed">Completed Sessions Only</option>
              <option value="working">Currently Working Only</option>
            </select>
          </div>
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '16px' }}>
          <button
            id="download-excel-btn"
            className="btn btn-primary btn-lg flex-1"
            onClick={handleExport}
            disabled={loading}
            style={{ justifyContent: 'center', minHeight: '46px', gap: '10px' }}
          >
            {loading ? (
              <>
                <div className="loading-spinner sm" />
                Generating Excel Report...
              </>
            ) : (
              <>
                <MdDownload size={22} />
                DOWNLOAD EXCEL REPORT ({formatDate(exportDate)})
              </>
            )}
          </button>
        </div>

        <p style={{ marginTop: '12px', fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span>Output file will be saved as:</span>
          <code style={{ background: 'var(--bg-elevated)', padding: '2px 8px', borderRadius: '4px', color: 'var(--brand-primary)', fontFamily: 'var(--font-mono)' }}>
            VK_IT_Attendance_{exportDate}.xlsx
          </code>
        </p>
      </div>

      {/* Live Metric Cards for Selected Date */}
      <div className="g-stats-grid mb-4">
        <div className="g-stat-card g-purple">
          <div className="g-stat-header">
            <div className="g-stat-icon-badge purple"><MdAssignment size={20} /></div>
            <span className="g-stat-trend">PRODUCTION</span>
          </div>
          <div className="g-stat-value">{totalFormsCount.toLocaleString()}</div>
          <div className="g-stat-label">Total Forms ({formatDate(exportDate)})</div>
        </div>

        <div className="g-stat-card g-orange">
          <div className="g-stat-header">
            <div className="g-stat-icon-badge orange"><MdCheckCircle size={20} /></div>
            <span className="g-stat-trend">WORK LOGS</span>
          </div>
          <div className="g-stat-value">{totalSessionsCount}</div>
          <div className="g-stat-label">Completed Sessions</div>
        </div>

        <div className="g-stat-card g-green">
          <div className="g-stat-header">
            <div className="g-stat-icon-badge green"><MdWork size={20} /></div>
            <span className="g-stat-trend">ACTIVE</span>
          </div>
          <div className="g-stat-value">{activeWorkingCount}</div>
          <div className="g-stat-label">Working Now</div>
        </div>

        <div className="g-stat-card g-blue">
          <div className="g-stat-header">
            <div className="g-stat-icon-badge blue"><MdPeople size={20} /></div>
            <span className="g-stat-trend">SHOWN</span>
          </div>
          <div className="g-stat-value">{filteredEmployees.length}</div>
          <div className="g-stat-label">Filtered Employees</div>
        </div>
      </div>

      {/* Production Summary Section */}
      <div className="g-section">
        <div className="g-section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 className="g-section-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <MdAssessment size={20} color="var(--brand-primary)" />
            Employee Production Breakdown — {formatDate(exportDate)}
          </h2>
          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: '600' }}>
            {filteredEmployees.length} Employees Listed
          </span>
        </div>

        {summaryLoading ? (
          <div className="g-loading-box">
            <div className="loading-spinner" />
            <p>Loading production metrics for {formatDate(exportDate)}...</p>
          </div>
        ) : filteredEmployees.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📊</div>
            <div className="empty-state-text">No employee work records found for {formatDate(exportDate)} with selected filters.</div>
          </div>
        ) : (
          <div className="g-leaderboard-card">
            {filteredEmployees.map((emp, index) => {
              const maxForms = Math.max(...filteredEmployees.map(e => e.total_forms_today || 0), 1);
              const percent = Math.min(Math.round(((emp.total_forms_today || 0) / maxForms) * 100), 100);
              const isWorking = emp.last_status === 'working';

              return (
                <div key={emp.employee_id} className="g-leader-row" style={{ display: 'flex', flexDirection: 'column', gap: '8px', padding: '14px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div className="g-leader-rank" style={{ width: '28px', height: '28px', fontSize: '0.85rem', borderRadius: '50%', background: 'var(--bg-elevated)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700' }}>
                        {index + 1}
                      </div>
                      <div>
                        <div className="g-leader-name" style={{ fontWeight: '700', fontSize: '0.95rem' }}>{emp.full_name}</div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>@{emp.username}</div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      <div className="g-leader-sessions" style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        {emp.sessions_today} sessions
                      </div>
                      <div className="g-leader-forms" style={{ fontWeight: '700', fontSize: '1rem', color: 'var(--brand-primary)' }}>
                        {(emp.total_forms_today ?? 0).toLocaleString()} forms
                      </div>
                      <span className={`g-chip ${isWorking ? 'chip-working' : emp.sessions_today > 0 ? 'chip-completed' : 'chip-idle'}`}>
                        {isWorking ? 'Working' : emp.sessions_today > 0 ? 'Completed' : 'Idle'}
                      </span>
                    </div>
                  </div>

                  {/* Progress Meter Bar */}
                  <div style={{ width: '100%', background: 'rgba(255, 255, 255, 0.06)', borderRadius: '4px', height: '6px', overflow: 'hidden' }}>
                    <div style={{ width: percent + '%', background: 'linear-gradient(90deg, #3b82f6 0%, #60a5fa 100%)', height: '100%', borderRadius: '4px', transition: 'width 0.4s ease' }} />
                  </div>

                </div>
              );
            })}

            {/* Total Row */}
            <div className="g-leader-total-row" style={{ padding: '16px', background: 'rgba(255, 255, 255, 0.03)', borderTop: '2px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div className="g-leader-rank" style={{ fontWeight: '800' }}>Σ</div>
                <div className="g-leader-name font-bold" style={{ fontSize: '1rem' }}>TOTAL OUTPUT ({formatDate(exportDate)})</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                <div className="g-leader-sessions" style={{ fontWeight: '600' }}>{totalSessionsCount} sessions</div>
                <div className="g-leader-forms total" style={{ fontSize: '1.2rem', fontWeight: '800', color: 'var(--brand-primary)' }}>
                  {totalFormsCount.toLocaleString()} forms
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
