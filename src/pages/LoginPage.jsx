import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { loginWithUsername } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { isSupabaseConfigured } from '../services/supabase';
import { MdPerson, MdLock, MdVisibility, MdVisibilityOff, MdSettings } from 'react-icons/md';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { refreshProfile } = useAuth();
  const navigate = useNavigate();

  async function handleLogin(e) {
    e.preventDefault();
    if (!username.trim()) {
      setError('Please enter your username.');
      return;
    }
    if (!password) {
      setError('Please enter your password.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const authData = await loginWithUsername(username.trim(), password.trim());
      // Auth context will detect the sign-in and fetch profile
      // Small delay to allow auth state to propagate
      await new Promise(r => setTimeout(r, 200));
      await refreshProfile();
      // ProtectedRoute + RedirectIfAuthenticated will handle navigation based on role
    } catch (err) {
      console.error('Login error:', err);
      const errMsg = (err.message || '').toLowerCase();
      if (errMsg.includes('inactive') || errMsg.includes('disabled')) {
        setError('Your account is inactive. Please contact your administrator.');
      } else if (errMsg.includes('network') || errMsg.includes('fetch')) {
        setError('Network error. Please check your internet connection and try again.');
      } else {
        setError('Invalid username or password. Please try again.');
      }
      setLoading(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        {/* Brand Header */}
        <div className="login-brand">
          <div className="login-brand-icon">VK</div>
          <h1 className="login-brand-name">VK IT Solutions</h1>
          <p className="login-brand-sub">Employee Work Session Tracker</p>
        </div>

        {/* Setup Notice (shown when Supabase is not yet configured) */}
        {!isSupabaseConfigured && (
          <div className="alert alert-warning mb-md" role="alert" id="setup-notice">
            <MdSettings size={18} />
            <div>
              <strong>Setup Required</strong>
              <br />
              <small>
                Configure <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> in your <code>.env</code> file, then restart the server.
                See <strong>README.md</strong> for instructions.
              </small>
            </div>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="alert alert-error mb-md" role="alert" id="login-error">
            {error}
          </div>
        )}


        {/* Login Form */}
        <form className="login-form" onSubmit={handleLogin} noValidate>
          {/* Username */}
          <div className="form-group">
            <label className="form-label" htmlFor="username">Username</label>
            <div style={{ position: 'relative' }}>
              <MdPerson
                size={20}
                style={{
                  position: 'absolute',
                  left: '16px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)',
                  pointerEvents: 'none',
                }}
              />
              <input
                id="username"
                type="text"
                className="form-input"
                value={username}
                onChange={e => setUsername(e.target.value)}
                placeholder="Enter your username"
                autoCapitalize="none"
                autoCorrect="off"
                autoComplete="username"
                inputMode="text"
                disabled={loading}
                style={{ paddingLeft: '46px' }}
                aria-label="Username"
                aria-required="true"
              />
            </div>
          </div>

          {/* Password */}
          <div className="form-group">
            <label className="form-label" htmlFor="password">Password</label>
            <div style={{ position: 'relative' }}>
              <MdLock
                size={20}
                style={{
                  position: 'absolute',
                  left: '16px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)',
                  pointerEvents: 'none',
                }}
              />
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                className="form-input"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter your password"
                autoComplete="current-password"
                disabled={loading}
                style={{ paddingLeft: '46px', paddingRight: '50px' }}
                aria-label="Password"
                aria-required="true"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                style={{
                  position: 'absolute',
                  right: '14px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  padding: '4px',
                }}
              >
                {showPassword ? <MdVisibilityOff size={20} /> : <MdVisibility size={20} />}
              </button>
            </div>
          </div>

          {/* Submit Button */}
          <button
            id="login-submit-btn"
            type="submit"
            className="btn btn-primary btn-full btn-lg"
            disabled={loading}
            style={{ marginTop: '8px' }}
          >
            {loading ? (
              <>
                <div className="loading-spinner sm" />
                Signing in...
              </>
            ) : (
              'LOGIN'
            )}
          </button>
        </form>

        {/* Footer */}
        <p style={{
          textAlign: 'center',
          marginTop: '24px',
          fontSize: '0.78rem',
          color: 'var(--text-muted)',
        }}>
          VK IT Solutions © {new Date().getFullYear()}
        </p>
      </div>
    </div>
  );
}
