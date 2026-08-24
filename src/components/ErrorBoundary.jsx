import React from 'react';
import { MdError, MdRefresh } from 'react-icons/md';

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Unhandled UI Exception:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          background: 'var(--bg-app, #0b0f19)',
          color: '#ffffff'
        }}>
          <div style={{
            maxWidth: '480px',
            width: '100%',
            background: 'var(--bg-card, #111827)',
            border: '1px solid rgba(239, 68, 68, 0.4)',
            borderRadius: '20px',
            padding: '28px',
            textAlign: 'center',
            boxShadow: '0 20px 40px rgba(0,0,0,0.8)'
          }}>
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '16px',
              background: 'rgba(239, 68, 68, 0.15)',
              color: '#ef4444',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
              fontSize: '1.8rem'
            }}>
              <MdError />
            </div>
            <h2 style={{ margin: '0 0 8px', fontSize: '1.25rem', fontWeight: '700' }}>
              Something went wrong
            </h2>
            <p style={{ margin: '0 0 20px', fontSize: '0.88rem', color: '#9ca3af', lineHeight: '1.5' }}>
              {this.state.error?.message || 'An unexpected rendering error occurred. Please click below to reload.'}
            </p>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
              style={{ width: '100%', justifyContent: 'center', minHeight: '44px' }}
            >
              <MdRefresh size={20} /> Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
