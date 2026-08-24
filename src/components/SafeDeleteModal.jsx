import React, { useState } from 'react';
import { MdWarning, MdClose, MdDeleteForever, MdBlock, MdCheckCircle } from 'react-icons/md';

export default function SafeDeleteModal({ employee, onConfirmDelete, onDeactivate, onClose, isDeleting = false }) {
  const [confirmInput, setConfirmInput] = useState('');

  if (!employee) return null;

  const targetUsername = employee.username?.toLowerCase() || '';
  const isMatched = confirmInput.trim().toLowerCase() === targetUsername;

  return (
    <div className="sdm-overlay" onClick={onClose}>
      <div className="sdm-card" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="sdm-header">
          <div className="sdm-header-left">
            <div className="sdm-warning-icon">
              <MdWarning />
            </div>
            <div>
              <h3 className="sdm-title">Delete Employee Account</h3>
              <p className="sdm-subtitle">Permanent action — cannot be undone</p>
            </div>
          </div>
          <button 
            type="button" 
            className="sdm-close-btn" 
            onClick={onClose}
          >
            <MdClose />
          </button>
        </div>

        {/* Alert Description */}
        <div className="sdm-alert-box">
          You are about to permanently delete employee <strong style={{ color: '#ffffff' }}>{employee.full_name}</strong> (<code style={{ color: '#fca5a5' }}>@{employee.username}</code>).
        </div>

        {/* Recommended Action Card */}
        {onDeactivate && employee.is_active && (
          <div className="sdm-rec-box">
            <div className="sdm-rec-title">
              <MdBlock style={{ fontSize: '1.1rem' }} />
              <span>Recommended Action: Deactivate Account</span>
            </div>
            <p className="sdm-rec-desc">
              Deactivating disables login while preserving all work-session records for accuracy in business analytics and form logs.
            </p>
            <button
              type="button"
              className="sdm-deactivate-btn"
              onClick={() => {
                onDeactivate(employee);
                onClose();
              }}
            >
              <MdBlock /> Deactivate Instead
            </button>
          </div>
        )}

        {/* Type username confirmation */}
        <div>
          <label htmlFor="confirmUsername" className="sdm-input-label">
            To proceed with permanent deletion, type <code className="sdm-code-tag">{employee.username}</code> below:
          </label>
          <div className="sdm-input-wrapper">
            <input
              id="confirmUsername"
              type="text"
              className="sdm-input"
              placeholder={`Type "${employee.username}" to confirm`}
              value={confirmInput}
              onChange={e => setConfirmInput(e.target.value)}
              autoComplete="off"
            />
            {isMatched && (
              <div className="sdm-match-icon">
                <MdCheckCircle />
              </div>
            )}
          </div>
        </div>

        {/* Footer Buttons */}
        <div className="sdm-footer">
          <button 
            type="button" 
            className="sdm-btn-cancel" 
            onClick={onClose} 
            disabled={isDeleting}
          >
            Cancel
          </button>
          <button
            type="button"
            className={`sdm-btn-delete ${isMatched && !isDeleting ? 'active' : 'disabled'}`}
            disabled={!isMatched || isDeleting}
            onClick={() => onConfirmDelete(employee)}
          >
            <MdDeleteForever style={{ fontSize: '1.2rem' }} />
            {isDeleting ? 'Deleting Employee...' : 'DELETE PERMANENTLY'}
          </button>
        </div>
      </div>
    </div>
  );
}
