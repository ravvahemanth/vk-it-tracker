import { useState, useEffect, useCallback } from 'react';
import { getAdminSessionsForExport, getAdminDailySummary, getAllProfiles } from '../../services/api';
import { exportToExcel } from '../../utils/excelExport';
import { getTodayIST, formatDate, formatDateDDMMYYYY } from '../../utils/dateTime';
import { MdDownload, MdTableChart, MdError, MdRefresh, MdAssessment } from 'react-icons/md';

export default function AdminReports() {
  const today = getTodayIST();

  const [exportDate, setExportDate] = useState(today);
  const [exportEmployee, setExportEmployee] = useState('');
  const [exportStatus, setExportStatus] = useState('completed');

  const [loading, setLoading] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summary, setSummary] = useState(null);
  const [profiles, setProfiles] = useState([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const handleLoadSummary = useCallback(async () => {
    setSummaryLoading(true);
    setError('');
    try {
      const data = await getAdminDailySummary(exportDate);
      setSummary(data);
    } catch (err) {
      setError('Failed to load summary.');
    } finally {
      setSummaryLoading(false);
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
        setError('No sessions found for the selected filters. Nothing to export.');
        return;
      }

      exportToExcel(sessions, exportDate);
      setMessage(`✅ Exported ${sessions.length} records to Excel successfully.`);
    } catch (err) {
      console.error('Export error:', err);
      setError('Excel export failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  const summaryEmployees = summary?.summary || [];
  const grandTotal = summaryEmployees.reduce((s, e) => s + (e.total_forms_today ?? 0), 0);

  return (
    <div className="g-dashboard-container">
      {/* Header */}
      <div className="g-dashboard-header">
        <div>
          <h1 className="g-page-title">Reports & Export</h1>
          <p className="g-subtitle">Generate Excel reports or review daily production summaries</p>
        </div>
      </div>

      {/* Excel Export Card */}
      <div className="g-leaderboard-card p-4 mb-4" style={{ padding: '20px' }}>
        <h2 style={{ marginBottom: '16px', fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <MdDownload size={22} color="var(--brand-primary)" />
          Download Excel Report
        </h2>

        {error && (
          <div className="alert alert-error mb-md" role="alert">
            <MdError size={18} /> {error}
          </div>
        )}

        {message && (
          <div className="alert alert-success mb-md" role="status">
            {message}
          </div>
        )}

        <div className="filter-bar mb-lg">
          <div className="filter-group">
            <label className="filter-label" htmlFor="export-date">Date</label>
            <input
              id="export-date"
              type="date"
              className="filter-input-date"
              value={exportDate}
              max={today}
              onChange={e => { setExportDate(e.target.value); setSummary(null); }}
            />
          </div>

          <div className="filter-group">
            <label className="filter-label" htmlFor="export-employee">Employee</label>
            <select
              id="export-employee"
              className="filter-select"
              value={exportEmployee}
              onChange={e => setExportEmployee(e.target.value)}
            >
              <option value="">All Employees</option>
              {profiles.map(p => (
                <option key={p.id} value={p.id}>{p.full_name}</option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label className="filter-label" htmlFor="export-status">Include Status</label>
            <select
              id="export-status"
              className="filter-select"
              value={exportStatus}
              onChange={e => setExportStatus(e.target.value)}
            >
              <option value="">All</option>
              <option value="completed">Completed Only</option>
              <option value="working">Working Only</option>
            </select>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <button
            id="download-excel-btn"
            className="btn btn-primary btn-lg flex-1"
            onClick={handleExport}
            disabled={loading}
          >
            {loading ? (
              <>
                <div className="loading-spinner sm" />
                Generating Excel...
              </>
            ) : (
              <>
                <MdDownload size={20} />
                DOWNLOAD TODAY'S EXCEL
              </>
            )}
          </button>

          <button
            type="button"
            className="btn btn-outline"
            onClick={handleLoadSummary}
            disabled={summaryLoading}
          >
            <MdRefresh size={18} />
            {summaryLoading ? 'Loading...' : 'Load Summary'}
          </button>
        </div>

        <p style={{ marginTop: '12px', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
          File will be saved as: <code>VK_IT_Attendance_{exportDate || 'today'}.xlsx</code>
        </p>
      </div>

      {/* Production Summary Card */}
      <div className="g-section">
        <div className="g-section-header">
          <h2 className="g-section-title">
            Daily Production — {formatDate(exportDate)}
          </h2>
        </div>

        {summaryLoading ? (
          <div className="g-loading-box">
            <div className="loading-spinner" />
            <p>Loading summary...</p>
          </div>
        ) : summaryEmployees.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📊</div>
            <div className="empty-state-text">No completed sessions found for this date.</div>
          </div>
        ) : (
          <div className="g-leaderboard-card">
            {summaryEmployees.map((emp, index) => (
              <div key={emp.employee_id} className="g-leader-row">
                <div className="g-leader-rank">{index + 1}</div>
                <div className="g-leader-name">{emp.full_name}</div>
                <div className="g-leader-sessions">{emp.sessions_today} sess</div>
                <div className="g-leader-forms">{(emp.total_forms_today ?? 0).toLocaleString()} forms</div>
              </div>
            ))}

            <div className="g-leader-total-row">
              <div className="g-leader-rank">Σ</div>
              <div className="g-leader-name font-bold">GRAND TOTAL</div>
              <div className="g-leader-sessions">
                {summaryEmployees.reduce((s, e) => s + (e.sessions_today ?? 0), 0)} sess
              </div>
              <div className="g-leader-forms total">
                {grandTotal.toLocaleString()} forms
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
