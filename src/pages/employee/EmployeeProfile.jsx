import { useAuth } from '../../context/AuthContext';
import { formatDate } from '../../utils/dateTime';
import { MdPerson, MdWork, MdVerified, MdCalendarMonth } from 'react-icons/md';

export default function EmployeeProfile() {
  const { profile, user } = useAuth();

  if (!profile) return null;

  const initials = profile.full_name
    ? profile.full_name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
    : '??';

  return (
    <div className="main-content">
      <h2 style={{ marginBottom: 'var(--space-md)' }}>My Profile</h2>

      <div className="profile-card mb-lg">
        {/* Header */}
        <div className="profile-header">
          <div className="profile-avatar">{initials}</div>
          <div className="profile-name">{profile.full_name}</div>
          <div className="profile-username">@{profile.username}</div>
        </div>

        {/* Body */}
        <div className="profile-body">
          <div className="profile-field">
            <span className="profile-field-label">Full Name</span>
            <span className="profile-field-value">{profile.full_name}</span>
          </div>
          <div className="profile-field">
            <span className="profile-field-label">Username</span>
            <span className="profile-field-value" style={{ fontFamily: 'var(--font-mono)' }}>
              @{profile.username}
            </span>
          </div>
          <div className="profile-field">
            <span className="profile-field-label">Role</span>
            <span className="profile-field-value" style={{ textTransform: 'capitalize' }}>
              {profile.role}
            </span>
          </div>
          <div className="profile-field">
            <span className="profile-field-label">Account Status</span>
            <span className={`badge ${profile.is_active ? 'badge-working' : 'badge-idle'}`}>
              <span className={`status-dot ${profile.is_active ? 'working' : 'idle'}`} />
              {profile.is_active ? 'Active' : 'Inactive'}
            </span>
          </div>
          <div className="profile-field">
            <span className="profile-field-label">Member Since</span>
            <span className="profile-field-value">{formatDate(profile.created_at)}</span>
          </div>
        </div>
      </div>

      <div className="card">
        <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', lineHeight: '1.7' }}>
          <p style={{ fontWeight: '600', color: 'var(--text-secondary)', marginBottom: '8px' }}>
            🔒 Account Security
          </p>
          <p>Your password is securely stored and never visible through this application.</p>
          <p style={{ marginTop: '8px' }}>Contact your administrator to reset your password.</p>
        </div>
      </div>
    </div>
  );
}
