import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import {
  startWorkSession,
  completeWorkSession,
  getMyActiveSession,
  getExpectedNextForm,
  getMySessions,
} from '../../services/api';
import { getTodayIST, formatTime, formatDate, getElapsedTime } from '../../utils/dateTime';
import {
  MdPlayArrow, MdStop, MdCheckCircle, MdWarning,
  MdTimer, MdRefresh, MdError
} from 'react-icons/md';
import SessionTimer from '../../components/SessionTimer';
import SessionListItem from '../../components/SessionListItem';

export default function EmployeeDashboard() {
  const { profile } = useAuth();
  const today = getTodayIST();

  // State
  const [activeSession, setActiveSession] = useState(null);
  const [todaySessions, setTodaySessions] = useState([]);
  const [nextFormInfo, setNextFormInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [startingForm, setStartingForm] = useState('');
  const [startError, setStartError] = useState('');
  const [startLoading, setStartLoading] = useState(false);

  // Finish work modal state
  const [showFinishModal, setShowFinishModal] = useState(false);
  const [endingForm, setEndingForm] = useState('');
  const [endError, setEndError] = useState('');
  const [endLoading, setEndLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmedTotal, setConfirmedTotal] = useState(null);

  // Success state
  const [justCompleted, setJustCompleted] = useState(null);
  const [pageError, setPageError] = useState('');

  const loadData = useCallback(async () => {
    try {
      setPageError('');
      const [activeData, nextFormData, sessionsData] = await Promise.all([
        getMyActiveSession(),
        getExpectedNextForm(),
        getMySessions(today),
      ]);

      setActiveSession(activeData?.session || null);
      setNextFormInfo(nextFormData);
      setTodaySessions(sessionsData || []);

      // Auto-fill starting form if there's an expected next
      if (!activeData?.has_active && nextFormData?.has_previous) {
        setStartingForm(String(nextFormData.expected_next));
      } else if (!activeData?.has_active && !nextFormData?.has_previous) {
        setStartingForm('');
      }
    } catch (err) {
      console.error('Load data error:', err);
      setPageError('Failed to load session data. Please refresh the page.');
    } finally {
      setLoading(false);
    }
  }, [today]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ============================================================
  // START WORK
  // ============================================================
  async function handleStartWork(e) {
    e.preventDefault();
    setStartError('');

    const formNum = parseInt(startingForm, 10);
    if (!startingForm.trim()) {
      setStartError('Please enter a starting form number.');
      return;
    }
    if (isNaN(formNum) || String(formNum) !== startingForm.trim() || formNum <= 0) {
      setStartError('Starting form number must be a valid positive whole number.');
      return;
    }

    setStartLoading(true);
    try {
      const result = await startWorkSession(formNum);
      if (result?.success) {
        setActiveSession(result.session);
        setJustCompleted(null);
        await loadData();
      } else {
        setStartError(result?.error || 'Failed to start session. Please try again.');
      }
    } catch (err) {
      console.error('Start session error:', err);
      if (!navigator.onLine) {
        setStartError('You are offline. Please check your internet connection and try again.');
      } else {
        setStartError('Unable to save your session. Please check your connection and try again.');
      }
    } finally {
      setStartLoading(false);
    }
  }

  // ============================================================
  // FINISH WORK — Step 1: Enter ending form
  // ============================================================
  function handleEndingFormSubmit(e) {
    e.preventDefault();
    setEndError('');

    const endNum = parseInt(endingForm, 10);
    const startNum = activeSession?.starting_form_number;

    if (!endingForm.trim()) {
      setEndError('Please enter the ending form number.');
      return;
    }
    if (isNaN(endNum) || String(endNum) !== endingForm.trim() || endNum <= 0) {
      setEndError('Ending form number must be a valid positive whole number.');
      return;
    }
    if (endNum < startNum) {
      setEndError(`Ending form number cannot be less than starting form number (${startNum}).`);
      return;
    }

    const total = endNum - startNum + 1;
    setConfirmedTotal(total);
    setShowConfirm(true);
  }

  // ============================================================
  // FINISH WORK — Step 2: Confirm & save
  // ============================================================
  async function handleConfirmComplete() {
    setEndLoading(true);
    try {
      const endNum = parseInt(endingForm, 10);
      const result = await completeWorkSession(activeSession.id, endNum);

      if (result?.success) {
        setJustCompleted(result.session);
        setActiveSession(null);
        setShowFinishModal(false);
        setShowConfirm(false);
        setEndingForm('');
        setConfirmedTotal(null);
        await loadData();
      } else {
        setEndError(result?.error || 'Failed to complete session. Please try again.');
        setShowConfirm(false);
      }
    } catch (err) {
      console.error('Complete session error:', err);
      if (!navigator.onLine) {
        setEndError('You are offline. Please check your internet connection and try again.');
      } else {
        setEndError('Unable to save your session. Please check your connection and try again.');
      }
      setShowConfirm(false);
    } finally {
      setEndLoading(false);
    }
  }

  // ============================================================
  // Computed values
  // ============================================================
  const completedSessions = todaySessions.filter(s => s.status === 'completed');
  const totalFormsToday = completedSessions.reduce((sum, s) => sum + (s.total_forms || 0), 0);

  if (loading) {
    return (
      <div className="main-content" style={{ paddingTop: '40px', textAlign: 'center' }}>
        <div className="loading-spinner" style={{ margin: '0 auto' }} />
        <p style={{ marginTop: '16px', color: 'var(--text-muted)' }}>Loading your dashboard...</p>
      </div>
    );
  }

  return (
    <div className="main-content">
      {/* Greeting */}
      <div style={{ marginBottom: 'var(--space-lg)' }}>
        <h1 style={{ fontSize: '1.5rem', marginBottom: '4px' }}>
          Welcome, {profile?.full_name?.split(' ')[0]} 👋
        </h1>
        <p style={{ fontSize: '0.875rem' }}>{formatDate(today)} · {today}</p>
      </div>

      {/* Page Error */}
      {pageError && (
        <div className="alert alert-error mb-md" role="alert">
          <MdError /> {pageError}
          <button
            onClick={loadData}
            style={{ marginLeft: 'auto', background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}
            aria-label="Retry"
          >
            <MdRefresh size={18} />
          </button>
        </div>
      )}

      {/* Today's Summary */}
      <div style={{ marginBottom: 'var(--space-lg)' }}>
        <div className="section-heading">
          <span className="section-title">Today's Summary</span>
        </div>
        <div className="today-summary">
          <div className="summary-item">
            <div className="summary-value">{totalFormsToday.toLocaleString()}</div>
            <div className="summary-label">Forms Done</div>
          </div>
          <div className="summary-item">
            <div className="summary-value">{completedSessions.length}</div>
            <div className="summary-label">Sessions</div>
          </div>
        </div>
      </div>

      {/* === ACTIVE SESSION === */}
      {activeSession && (
        <div style={{ marginBottom: 'var(--space-lg)' }}>
          <div className="session-active-card">
            <div className="session-active-header">
              <div className="session-active-title">
                <div className="status-dot working" />
                WORK SESSION ACTIVE
              </div>
              <SessionTimer startTime={activeSession.start_time} />
            </div>

            <div className="session-info-grid">
              <div className="session-info-item">
                <div className="session-info-label">Session</div>
                <div className="session-info-value">#{activeSession.session_number}</div>
              </div>
              <div className="session-info-item">
                <div className="session-info-label">Started At</div>
                <div className="session-info-value">{formatTime(activeSession.start_time)}</div>
              </div>
              <div className="session-info-item" style={{ gridColumn: '1 / -1' }}>
                <div className="session-info-label">Starting Form Number</div>
                <div className="session-info-value" style={{ fontSize: '1.5rem' }}>
                  {activeSession.starting_form_number?.toLocaleString()}
                </div>
              </div>
            </div>

            <button
              id="finish-work-btn"
              className="btn btn-danger btn-full btn-lg"
              onClick={() => { setShowFinishModal(true); setEndError(''); setEndingForm(''); }}
            >
              <MdStop size={22} />
              FINISH WORK
            </button>
          </div>
        </div>
      )}

      {/* === JUST COMPLETED BANNER === */}
      {justCompleted && !activeSession && (
        <div className="completion-card mb-lg">
          <div className="completion-icon">✅</div>
          <div className="completion-title">Work Session Completed!</div>
          <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
            Session #{justCompleted.session_number}
            · {justCompleted.starting_form_number} → {justCompleted.ending_form_number}
          </div>
          <div className="completion-forms">{justCompleted.total_forms?.toLocaleString()}</div>
          <div className="completion-forms-label">Forms Recorded</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            {formatTime(justCompleted.start_time)} – {formatTime(justCompleted.end_time)}
          </div>
        </div>
      )}

      {/* === START NEW SESSION === */}
      {!activeSession && (
        <div style={{ marginBottom: 'var(--space-lg)' }}>
          <div className="section-heading">
            <span className="section-title">
              {completedSessions.length > 0 ? 'Start Next Session' : 'Start Work'}
            </span>
          </div>

          <div className="start-work-card">
            {/* Next Form Hint */}
            {nextFormInfo?.has_previous && (
              <div className="next-form-hint">
                <div className="next-form-row">
                  <span className="next-form-row-label">Last Completed Form</span>
                  <span className="next-form-row-value">
                    {nextFormInfo.last_ending_form?.toLocaleString()}
                  </span>
                </div>
                <div className="next-form-row">
                  <span className="next-form-row-label">Next Starting Form</span>
                  <span className="next-form-row-value" style={{ color: 'var(--brand-secondary)' }}>
                    {nextFormInfo.expected_next?.toLocaleString()}
                  </span>
                </div>
              </div>
            )}

            {startError && (
              <div className="alert alert-error mb-md" role="alert" id="start-error">
                <MdWarning size={18} />
                {startError}
              </div>
            )}

            <form onSubmit={handleStartWork}>
              <div className="form-group mb-md">
                <label className="form-label" htmlFor="starting-form">
                  Starting Form Number
                </label>
                <input
                  id="starting-form"
                  type="number"
                  className={`form-input form-input-number ${startError ? 'error' : ''}`}
                  value={startingForm}
                  onChange={e => {
                    setStartingForm(e.target.value);
                    setStartError('');
                  }}
                  placeholder="e.g. 1000"
                  min="1"
                  step="1"
                  inputMode="numeric"
                  disabled={startLoading}
                  aria-label="Starting form number"
                  aria-required="true"
                  aria-describedby={startError ? 'start-error' : undefined}
                />
                {nextFormInfo?.has_previous && (
                  <div className="form-hint">
                    Expected: {nextFormInfo.expected_next?.toLocaleString()}
                  </div>
                )}
              </div>

              <button
                id="start-work-btn"
                type="submit"
                className="btn btn-success btn-full btn-lg"
                disabled={startLoading}
              >
                {startLoading ? (
                  <>
                    <div className="loading-spinner sm" />
                    Starting session...
                  </>
                ) : (
                  <>
                    <MdPlayArrow size={24} />
                    START WORK
                  </>
                )}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* === TODAY'S SESSIONS LIST === */}
      {completedSessions.length > 0 && (
        <div>
          <div className="section-heading">
            <span className="section-title">Today's Sessions</span>
          </div>
          <div className="session-list">
            {completedSessions.map(session => (
              <SessionListItem key={session.id} session={session} />
            ))}
          </div>
        </div>
      )}

      {/* No sessions today */}
      {!activeSession && completedSessions.length === 0 && !justCompleted && (
        <div className="empty-state">
          <div className="empty-state-icon">📋</div>
          <div className="empty-state-text">No sessions today yet.<br />Start your first work session above.</div>
        </div>
      )}

      {/* ============================================================
          FINISH WORK MODAL
          ============================================================ */}
      {showFinishModal && activeSession && (
        <div className="modal-overlay" onClick={e => { if(e.target === e.currentTarget && !showConfirm) { setShowFinishModal(false); setEndError(''); } }}>
          <div className="modal-sheet">
            <div className="modal-handle" />

            {!showConfirm ? (
              <>
                <div className="modal-title">Complete Work Session</div>

                <div className="confirm-summary mb-md">
                  <div className="confirm-row">
                    <span className="confirm-row-label">Session</span>
                    <span className="confirm-row-value">#{activeSession.session_number}</span>
                  </div>
                  <div className="confirm-row">
                    <span className="confirm-row-label">Starting Form</span>
                    <span className="confirm-row-value">{activeSession.starting_form_number?.toLocaleString()}</span>
                  </div>
                  <div className="confirm-row">
                    <span className="confirm-row-label">Started At</span>
                    <span className="confirm-row-value">{formatTime(activeSession.start_time)}</span>
                  </div>
                </div>

                {endError && (
                  <div className="alert alert-error mb-md" role="alert" id="end-error">
                    <MdWarning size={18} />
                    {endError}
                  </div>
                )}

                <form onSubmit={handleEndingFormSubmit}>
                  <div className="form-group mb-md">
                    <label className="form-label" htmlFor="ending-form">
                      Ending Form Number
                    </label>
                    <input
                      id="ending-form"
                      type="number"
                      className={`form-input form-input-number ${endError ? 'error' : ''}`}
                      value={endingForm}
                      onChange={e => {
                        setEndingForm(e.target.value);
                        setEndError('');
                      }}
                      placeholder={`≥ ${activeSession.starting_form_number}`}
                      min={activeSession.starting_form_number}
                      step="1"
                      inputMode="numeric"
                      autoFocus
                      disabled={endLoading}
                      aria-label="Ending form number"
                      aria-required="true"
                      aria-describedby={endError ? 'end-error' : undefined}
                    />
                    <div className="form-hint">
                      Must be ≥ {activeSession.starting_form_number?.toLocaleString()}
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '12px', flexDirection: 'column' }}>
                    <button
                      id="calculate-btn"
                      type="submit"
                      className="btn btn-danger btn-full btn-lg"
                      disabled={endLoading}
                    >
                      Calculate & Review
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline btn-full"
                      onClick={() => { setShowFinishModal(false); setEndError(''); setEndingForm(''); }}
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <>
                {/* Confirmation Step */}
                <div className="modal-title">Confirm Completion</div>

                <div className="confirm-summary">
                  <div className="confirm-row">
                    <span className="confirm-row-label">Starting Form</span>
                    <span className="confirm-row-value">{activeSession.starting_form_number?.toLocaleString()}</span>
                  </div>
                  <div className="confirm-row">
                    <span className="confirm-row-label">Ending Form</span>
                    <span className="confirm-row-value">{parseInt(endingForm).toLocaleString()}</span>
                  </div>
                </div>

                <div className="confirm-total-forms">{confirmedTotal?.toLocaleString()}</div>
                <div className="confirm-total-label">Forms Completed</div>

                <p style={{ textAlign: 'center', marginBottom: '24px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                  Are you sure you want to complete this session?
                </p>

                <div style={{ display: 'flex', gap: '12px', flexDirection: 'column' }}>
                  <button
                    id="confirm-complete-btn"
                    className="btn btn-success btn-full btn-lg"
                    onClick={handleConfirmComplete}
                    disabled={endLoading}
                  >
                    {endLoading ? (
                      <>
                        <div className="loading-spinner sm" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <MdCheckCircle size={22} />
                        YES, COMPLETE SESSION
                      </>
                    )}
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline btn-full"
                    onClick={() => setShowConfirm(false)}
                    disabled={endLoading}
                  >
                    Go Back
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
