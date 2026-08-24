import { useState, useEffect, useCallback } from 'react';
import {
  getAllProfiles,
  adminCreateEmployee,
  adminUpdateEmployee,
  adminResetEmployeePassword,
  adminToggleEmployeeStatus,
  adminDeleteEmployee
} from '../../services/api';
import { formatDate } from '../../utils/dateTime';
import SafeDeleteModal from '../../components/SafeDeleteModal';
import { useToast } from '../../components/Toast';
import {
  MdPersonAdd, MdSearch, MdEdit, MdLockReset, MdCheckCircle,
  MdBlock, MdRefresh, MdError, MdVisibility, MdVisibilityOff,
  MdClose, MdWarning, MdDeleteForever
} from 'react-icons/md';

export default function AdminEmployees() {
  const toast = useToast();
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showResetPasswordModal, setShowResetPasswordModal] = useState(false);
  const [deleteModalEmployee, setDeleteModalEmployee] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);

  // Form States — Add Employee
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Form States — Edit Employee
  const [editFullName, setEditFullName] = useState('');
  const [editUsername, setEditUsername] = useState('');
  const [editIsActive, setEditIsActive] = useState(true);

  // Form States — Reset Password
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);

  const loadEmployees = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getAllProfiles();
      setEmployees(data || []);
    } catch (err) {
      console.error('Error loading employees:', err);
      setError('Failed to load employees list.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadEmployees();
  }, [loadEmployees]);

  // Password validation checks
  const hasMinLength = password.length >= 6;
  const isPasswordValid = password.length >= 6;

  // Reset Add Form
  function resetAddForm() {
    setFullName('');
    setUsername('');
    setPassword('');
    setConfirmPassword('');
    setIsActive(true);
    setShowPassword(false);
    setFormError('');
  }

  // Handle Add Employee
  async function handleAddEmployee(e) {
    e.preventDefault();
    setFormError('');

    if (!fullName.trim()) {
      setFormError('Full name is required.');
      return;
    }
    if (!username.trim()) {
      setFormError('Username is required.');
      return;
    }
    if (!isPasswordValid) {
      setFormError('Password does not meet requirements.');
      return;
    }
    if (password !== confirmPassword) {
      setFormError('Password and Confirm Password do not match.');
      return;
    }

    setSubmitting(true);
    try {
      const result = await adminCreateEmployee({
        fullName: fullName.trim(),
        username: username.trim().toLowerCase().replace(/\s+/g, ''),
        password,
        isActive,
      });

      if (result?.success) {
        setSuccessMessage(`Employee "${fullName.trim()}" created successfully!`);
        setShowAddModal(false);
        resetAddForm();
        await loadEmployees();
        setTimeout(() => setSuccessMessage(''), 5000);
      } else {
        setFormError(result?.error || 'Failed to create employee account.');
      }
    } catch (err) {
      console.error('Create employee error:', err);
      setFormError(err.message || 'An error occurred while creating employee.');
    } finally {
      setSubmitting(false);
    }
  }

  // Handle Open Edit Modal
  function openEditModal(emp) {
    setSelectedEmployee(emp);
    setEditFullName(emp.full_name);
    setEditUsername(emp.username);
    setEditIsActive(emp.is_active);
    setFormError('');
    setShowEditModal(true);
  }

  // Handle Edit Employee Submit
  async function handleEditEmployee(e) {
    e.preventDefault();
    setFormError('');

    if (!editFullName.trim()) {
      setFormError('Full name is required.');
      return;
    }
    if (!editUsername.trim()) {
      setFormError('Username is required.');
      return;
    }

    setSubmitting(true);
    try {
      const result = await adminUpdateEmployee({
        employeeId: selectedEmployee.id,
        fullName: editFullName.trim(),
        username: editUsername.trim().toLowerCase(),
        isActive: editIsActive,
      });

      if (result?.success) {
        setSuccessMessage(`Employee "${editFullName.trim()}" updated successfully.`);
        setShowEditModal(false);
        await loadEmployees();
        setTimeout(() => setSuccessMessage(''), 5000);
      } else {
        setFormError(result?.error || 'Failed to update employee.');
      }
    } catch (err) {
      setFormError(err.message || 'Failed to update employee.');
    } finally {
      setSubmitting(false);
    }
  }

  // Handle Open Reset Password Modal
  function openResetPasswordModal(emp) {
    setSelectedEmployee(emp);
    setNewPassword('');
    setConfirmNewPassword('');
    setShowNewPassword(false);
    setFormError('');
    setShowResetPasswordModal(true);
  }

  // Handle Reset Password Submit
  async function handleResetPassword(e) {
    e.preventDefault();
    setFormError('');

    if (newPassword.length < 8) {
      setFormError('New password must be at least 8 characters long.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setFormError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      const result = await adminResetEmployeePassword({
        employeeId: selectedEmployee.id,
        newPassword,
      });

      if (result?.success) {
        setSuccessMessage(`Password updated for ${selectedEmployee.full_name}.`);
        setShowResetPasswordModal(false);
        setNewPassword('');
        setConfirmNewPassword('');
        setTimeout(() => setSuccessMessage(''), 5000);
      } else {
        setFormError(result?.error || 'Failed to reset password.');
      }
    } catch (err) {
      setFormError(err.message || 'Failed to reset password.');
    } finally {
      setSubmitting(false);
    }
  }

  // Handle Toggle Active Status
  async function handleToggleStatus(emp) {
    const targetStatus = !emp.is_active;
    try {
      const result = await adminToggleEmployeeStatus({
        employeeId: emp.id,
        isActive: targetStatus,
      });

      if (result?.success) {
        setSuccessMessage(
          `Employee "${emp.full_name}" is now ${targetStatus ? 'Active' : 'Inactive'}.`
        );
        await loadEmployees();
        setTimeout(() => setSuccessMessage(''), 4000);
      } else {
        setError(result?.error || 'Failed to change status.');
      }
    } catch (err) {
      setError(err.message || 'Failed to change status.');
    }
  }

  // Handle Permanent Delete Employee
  async function handleConfirmDeleteEmployee(emp) {
    if (!emp) return;
    setIsDeleting(true);
    setError('');
    try {
      const res = await adminDeleteEmployee(emp.id);
      if (res?.success !== false) {
        toast.showSuccess(`Employee ${emp.username} permanently deleted.`);
        setDeleteModalEmployee(null);
        await loadEmployees();
      } else {
        toast.showError(res?.error || 'Failed to delete employee.');
      }
    } catch (err) {
      toast.showError(err.message || 'Failed to delete employee.');
    } finally {
      setIsDeleting(false);
    }
  }

  // Filtered employees list
  const filteredEmployees = employees.filter(emp => {
    const matchesSearch =
      emp.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      emp.username.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'active' && emp.is_active) ||
      (statusFilter === 'inactive' && !emp.is_active);

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="g-dashboard-container">
      {/* Header */}
      <div className="g-dashboard-header">
        <div>
          <h1 className="g-page-title">Employee Management</h1>
          <p className="g-subtitle">Create, manage, reset passwords, or remove employee accounts</p>
        </div>
        <button
          className="btn btn-primary btn-md"
          onClick={() => setShowAddModal(true)}
          id="add-employee-btn"
        >
          <MdPersonAdd size={20} />
          Add Employee
        </button>
      </div>

      {/* Filter & Search Bar Card */}
      <div className="g-leaderboard-card p-4 mb-4" style={{ padding: '18px', marginBottom: '24px' }}>
        <div className="filter-bar">
          <div className="filter-group flex-1">
            <div style={{ position: 'relative', width: '100%' }}>
              <MdSearch
                size={20}
                style={{
                  position: 'absolute',
                  left: '14px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)',
                }}
              />
              <input
                id="search-employee"
                type="text"
                className="form-input"
                placeholder="Search by name or username..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{ paddingLeft: '44px' }}
              />
            </div>
          </div>

          <div className="filter-group">
            <select
              id="filter-status"
              className="filter-select"
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
            >
              <option value="all">All Status</option>
              <option value="active">Active Only</option>
              <option value="inactive">Inactive Only</option>
            </select>
          </div>

          <button
            className="btn btn-ghost btn-sm"
            onClick={loadEmployees}
            title="Refresh list"
          >
            <MdRefresh size={18} />
          </button>
        </div>
      </div>

      {/* Section Header */}
      {!loading && filteredEmployees.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', marginTop: '8px', padding: '0 4px' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Employees Directory ({filteredEmployees.length})
          </span>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Showing {filteredEmployees.length} of {employees.length}
          </span>
        </div>
      )}

      {/* Employee List: Mobile Cards + Desktop Table */}
      {loading ? (
        <div className="g-loading-box" style={{ marginTop: '24px' }}>
          <div className="loading-spinner" />
          <p>Loading employees...</p>
        </div>
      ) : filteredEmployees.length === 0 ? (
        <div className="empty-state" style={{ marginTop: '24px' }}>
          <div className="empty-state-icon">👥</div>
          <div className="empty-state-text">No employees match your search criteria.</div>
        </div>
      ) : (
        <>
          {/* Mobile Employee Cards (< 768px) */}
          <div className="mobile-sessions-list" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {filteredEmployees.map(emp => {
              const initials = emp.full_name
                ? emp.full_name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
                : '??';

              return (
                <div key={emp.id} className="card mb-3" style={{ padding: '16px', gap: '14px', display: 'flex', flexDirection: 'column' }}>
                  {/* Top Header Row */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div className="employee-avatar" style={{ width: '44px', height: '44px', fontSize: '1rem', flexShrink: 0 }}>
                        {initials}
                      </div>
                      <div>
                        <div style={{ fontWeight: '700', fontSize: '1.05rem', color: 'var(--text-primary)', lineHeight: '1.3' }}>
                          {emp.full_name}
                        </div>
                        <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', marginTop: '2px' }}>
                          @{emp.username}
                        </div>
                      </div>
                    </div>

                    <span className={`badge ${emp.is_active ? 'badge-working' : 'badge-idle'}`} style={{ flexShrink: 0, marginTop: '2px' }}>
                      <span className={`status-dot ${emp.is_active ? 'working' : 'idle'}`} />
                      {emp.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>

                  {/* Registered Date Info */}
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', background: 'var(--bg-elevated)', padding: '6px 12px', borderRadius: 'var(--border-radius-sm)', display: 'flex', justifyContent: 'space-between' }}>
                    <span>Registered Date</span>
                    <span style={{ fontWeight: '600', color: 'var(--text-secondary)' }}>{formatDate(emp.created_at)}</span>
                  </div>

                  {/* Actions Grid (2x2) */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', paddingTop: '8px', borderTop: '1px solid var(--border-color)' }}>
                    <button
                      className="btn btn-outline btn-sm"
                      onClick={() => openEditModal(emp)}
                      style={{ justifyContent: 'center', minHeight: '38px' }}
                      id={`mob-edit-${emp.username}`}
                    >
                      <MdEdit size={16} /> Edit
                    </button>

                    <button
                      className="btn btn-outline btn-sm"
                      onClick={() => openResetPasswordModal(emp)}
                      style={{ justifyContent: 'center', minHeight: '38px' }}
                      id={`mob-pwd-${emp.username}`}
                    >
                      <MdLockReset size={16} /> Password
                    </button>

                    <button
                      className={`btn btn-sm ${emp.is_active ? 'btn-outline' : 'btn-success'}`}
                      onClick={() => handleToggleStatus(emp)}
                      style={{ justifyContent: 'center', minHeight: '38px' }}
                      id={`mob-status-${emp.username}`}
                    >
                      {emp.is_active ? (
                        <>
                          <MdBlock size={16} color="var(--color-error)" /> Deactivate
                        </>
                      ) : (
                        <>
                          <MdCheckCircle size={16} /> Activate
                        </>
                      )}
                    </button>

                    <button
                      className="btn btn-ghost btn-sm text-danger"
                      onClick={() => setDeleteModalEmployee(emp)}
                      style={{ justifyContent: 'center', minHeight: '38px', border: '1px solid rgba(239, 68, 68, 0.2)' }}
                      id={`mob-del-${emp.username}`}
                    >
                      <MdDeleteForever size={18} /> Delete
                    </button>
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
                  <th>Employee Name</th>
                  <th>Username</th>
                  <th>Status</th>
                  <th>Created Date</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredEmployees.map(emp => {
                  const initials = emp.full_name
                    ? emp.full_name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
                    : '??';

                  return (
                    <tr key={emp.id} id={`emp-row-${emp.username}`}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div className="employee-avatar" style={{ width: '34px', height: '34px', fontSize: '0.85rem' }}>
                            {initials}
                          </div>
                          <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>
                            {emp.full_name}
                          </span>
                        </div>
                      </td>
                      <td className="td-mono">@{emp.username}</td>
                      <td>
                        <span className={`badge ${emp.is_active ? 'badge-working' : 'badge-idle'}`}>
                          <span className={`status-dot ${emp.is_active ? 'working' : 'idle'}`} />
                          {emp.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td>{formatDate(emp.created_at)}</td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => openEditModal(emp)}
                            title="Edit Employee"
                            id={`edit-btn-${emp.username}`}
                          >
                            <MdEdit size={16} /> Edit
                          </button>

                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => openResetPasswordModal(emp)}
                            title="Reset Password"
                            id={`reset-pwd-btn-${emp.username}`}
                          >
                            <MdLockReset size={16} /> Password
                          </button>

                          <button
                            className={`btn btn-sm ${emp.is_active ? 'btn-outline' : 'btn-success'}`}
                            onClick={() => handleToggleStatus(emp)}
                            title={emp.is_active ? 'Deactivate' : 'Activate'}
                            id={`toggle-status-btn-${emp.username}`}
                          >
                            {emp.is_active ? (
                              <>
                                <MdBlock size={16} color="var(--color-error)" />
                                Deactivate
                              </>
                            ) : (
                              <>
                                <MdCheckCircle size={16} />
                                Activate
                              </>
                            )}
                          </button>

                          <button
                            className="btn btn-ghost btn-sm text-danger"
                            onClick={() => setDeleteModalEmployee(emp)}
                            title="Delete Employee"
                            id={`delete-btn-${emp.username}`}
                          >
                            <MdDeleteForever size={18} /> Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* ============================================================
          MODAL: ADD EMPLOYEE
          ============================================================ */}
      {showAddModal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget && !submitting) setShowAddModal(false); }}>
          <div className="modal-sheet" style={{ maxWidth: '520px', margin: '0 auto' }}>
            <div className="modal-handle" />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-md)' }}>
              <h2 className="modal-title" style={{ margin: 0 }}>Create New Employee</h2>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setShowAddModal(false)}
                disabled={submitting}
              >
                <MdClose size={20} />
              </button>
            </div>

            {formError && (
              <div className="alert alert-error mb-md" role="alert">
                <MdWarning size={18} /> {formError}
              </div>
            )}

            <form onSubmit={handleAddEmployee} noValidate>
              <div className="form-group mb-md">
                <label className="form-label" htmlFor="new-fullname">Full Name *</label>
                <input
                  id="new-fullname"
                  type="text"
                  className="form-input"
                  placeholder="e.g. Ramesh Kumar"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  disabled={submitting}
                  required
                />
              </div>

              <div className="form-group mb-md">
                <label className="form-label" htmlFor="new-username">Username *</label>
                <input
                  id="new-username"
                  type="text"
                  className="form-input"
                  placeholder="e.g. ramesh"
                  value={username}
                  onChange={e => setUsername(e.target.value.toLowerCase().trim())}
                  disabled={submitting}
                  required
                  autoCapitalize="none"
                />
                <span className="form-hint">Username will be used for login (e.g. ramesh)</span>
              </div>

              <div className="form-group mb-md">
                <label className="form-label" htmlFor="new-password">Password *</label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="new-password"
                    type={showPassword ? 'text' : 'password'}
                    className="form-input"
                    placeholder="Enter secure password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    disabled={submitting}
                    style={{ paddingRight: '48px' }}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: 'absolute',
                      right: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'var(--text-muted)',
                    }}
                  >
                    {showPassword ? <MdVisibilityOff size={20} /> : <MdVisibility size={20} />}
                  </button>
                </div>

                {/* Password requirement checklist */}
                <div style={{ marginTop: '8px', fontSize: '0.78rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
                  <span style={{ color: hasMinLength ? 'var(--color-success)' : 'var(--text-muted)' }}>
                    {hasMinLength ? '✓' : '○'} At least 8 chars
                  </span>
                  <span style={{ color: hasUpper ? 'var(--color-success)' : 'var(--text-muted)' }}>
                    {hasUpper ? '✓' : '○'} One uppercase
                  </span>
                  <span style={{ color: hasLower ? 'var(--color-success)' : 'var(--text-muted)' }}>
                    {hasLower ? '✓' : '○'} One lowercase
                  </span>
                  <span style={{ color: hasNumber ? 'var(--color-success)' : 'var(--text-muted)' }}>
                    {hasNumber ? '✓' : '○'} One number
                  </span>
                </div>
              </div>

              <div className="form-group mb-md">
                <label className="form-label" htmlFor="new-confirm-password">Confirm Password *</label>
                <input
                  id="new-confirm-password"
                  type={showPassword ? 'text' : 'password'}
                  className={`form-input ${confirmPassword && password !== confirmPassword ? 'error' : ''}`}
                  placeholder="Re-enter password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  disabled={submitting}
                  required
                />
                {confirmPassword && password !== confirmPassword && (
                  <span className="form-error">Passwords do not match</span>
                )}
              </div>

              <div className="form-group mb-lg">
                <label className="form-label" htmlFor="new-status">Account Status</label>
                <select
                  id="new-status"
                  className="filter-select"
                  value={isActive ? 'active' : 'inactive'}
                  onChange={e => setIsActive(e.target.value === 'active')}
                  disabled={submitting}
                >
                  <option value="active">Active (Can log in)</option>
                  <option value="inactive">Inactive (Disabled)</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  type="button"
                  className="btn btn-outline flex-1"
                  onClick={() => setShowAddModal(false)}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  id="submit-create-emp-btn"
                  type="submit"
                  className="btn btn-primary flex-1 btn-lg"
                  disabled={submitting}
                >
                  {submitting ? (
                    <>
                      <div className="loading-spinner sm" /> Creating...
                    </>
                  ) : (
                    'Create Employee'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================
          MODAL: EDIT EMPLOYEE
          ============================================================ */}
      {showEditModal && selectedEmployee && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget && !submitting) setShowEditModal(false); }}>
          <div className="modal-sheet" style={{ maxWidth: '480px', margin: '0 auto' }}>
            <div className="modal-handle" />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-md)' }}>
              <h2 className="modal-title" style={{ margin: 0 }}>Edit Employee</h2>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setShowEditModal(false)}
                disabled={submitting}
              >
                <MdClose size={20} />
              </button>
            </div>

            {formError && (
              <div className="alert alert-error mb-md" role="alert">
                <MdWarning size={18} /> {formError}
              </div>
            )}

            <form onSubmit={handleEditEmployee}>
              <div className="form-group mb-md">
                <label className="form-label" htmlFor="edit-fullname">Full Name</label>
                <input
                  id="edit-fullname"
                  type="text"
                  className="form-input"
                  value={editFullName}
                  onChange={e => setEditFullName(e.target.value)}
                  disabled={submitting}
                  required
                />
              </div>

              <div className="form-group mb-md">
                <label className="form-label" htmlFor="edit-username">Username</label>
                <input
                  id="edit-username"
                  type="text"
                  className="form-input"
                  value={editUsername}
                  onChange={e => setEditUsername(e.target.value.toLowerCase().trim())}
                  disabled={submitting}
                  required
                />
              </div>

              <div className="form-group mb-lg">
                <label className="form-label" htmlFor="edit-status">Status</label>
                <select
                  id="edit-status"
                  className="filter-select"
                  value={editIsActive ? 'active' : 'inactive'}
                  onChange={e => setEditIsActive(e.target.value === 'active')}
                  disabled={submitting}
                >
                  <option value="active">Active (Can log in)</option>
                  <option value="inactive">Inactive (Blocked from login)</option>
                </select>
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  type="button"
                  className="btn btn-outline flex-1"
                  onClick={() => setShowEditModal(false)}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary flex-1"
                  disabled={submitting}
                >
                  {submitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================
          MODAL: RESET PASSWORD
          ============================================================ */}
      {showResetPasswordModal && selectedEmployee && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget && !submitting) setShowResetPasswordModal(false); }}>
          <div className="modal-sheet" style={{ maxWidth: '480px', margin: '0 auto' }}>
            <div className="modal-handle" />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-md)' }}>
              <h2 className="modal-title" style={{ margin: 0 }}>Reset Password</h2>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setShowResetPasswordModal(false)}
                disabled={submitting}
              >
                <MdClose size={20} />
              </button>
            </div>

            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: 'var(--space-md)' }}>
              Setting new password for <strong>{selectedEmployee.full_name}</strong> (@{selectedEmployee.username}).
            </p>

            {formError && (
              <div className="alert alert-error mb-md" role="alert">
                <MdWarning size={18} /> {formError}
              </div>
            )}

            <form onSubmit={handleResetPassword}>
              <div className="form-group mb-md">
                <label className="form-label" htmlFor="reset-new-pwd">New Password</label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="reset-new-pwd"
                    type={showNewPassword ? 'text' : 'password'}
                    className="form-input"
                    placeholder="Enter new password (min 8 chars)"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    disabled={submitting}
                    style={{ paddingRight: '48px' }}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    style={{
                      position: 'absolute',
                      right: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: 'var(--text-muted)',
                    }}
                  >
                    {showNewPassword ? <MdVisibilityOff size={20} /> : <MdVisibility size={20} />}
                  </button>
                </div>
              </div>

              <div className="form-group mb-lg">
                <label className="form-label" htmlFor="reset-confirm-pwd">Confirm New Password</label>
                <input
                  id="reset-confirm-pwd"
                  type={showNewPassword ? 'text' : 'password'}
                  className="form-input"
                  placeholder="Re-enter new password"
                  value={confirmNewPassword}
                  onChange={e => setConfirmNewPassword(e.target.value)}
                  disabled={submitting}
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  type="button"
                  className="btn btn-outline flex-1"
                  onClick={() => setShowResetPasswordModal(false)}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary flex-1"
                  disabled={submitting}
                >
                  {submitting ? 'Updating...' : 'Update Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Safe Delete Modal */}
      {deleteModalEmployee && (
        <SafeDeleteModal
          employee={deleteModalEmployee}
          onClose={() => setDeleteModalEmployee(null)}
          onConfirmDelete={handleConfirmDeleteEmployee}
          onDeactivate={handleToggleStatus}
          isDeleting={isDeleting}
        />
      )}
    </div>
  );
}
