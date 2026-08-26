import { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { logout } from '../services/api';
import ThemeToggle from '../components/ThemeToggle';
import {
  MdDashboard, MdPeople, MdTableChart, MdBarChart, MdLogout,
  MdMenu, MdClose, MdAdminPanelSettings, MdChevronRight
} from 'react-icons/md';

const navItems = [
  { to: '/admin', label: 'Dashboard', icon: MdDashboard, end: true, id: 'admin-nav-dashboard' },
  { to: '/admin/employees', label: 'Employees', icon: MdPeople, end: false, id: 'admin-nav-employees' },
  { to: '/admin/sessions', label: 'Sessions', icon: MdTableChart, end: false, id: 'admin-nav-sessions' },
  { to: '/admin/reports', label: 'Reports & Export', icon: MdBarChart, end: false, id: 'admin-nav-reports' },
];

export default function AdminLayout() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Close mobile drawer whenever location changes
  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  async function handleLogout() {
    try {
      await logout();
      navigate('/login', { replace: true });
    } catch (err) {
      console.error('Logout error:', err);
    }
  }

  const initials = profile?.full_name
    ? profile.full_name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
    : 'AD';

  return (
    <div className="admin-layout">
      {/* Sidebar (Desktop > 768px) */}
      <aside className="admin-sidebar">
        <div className="sidebar-brand">
          <div className="brand-icon" style={{ marginBottom: '8px' }}>VK</div>
          <div className="sidebar-brand-name">VK IT Solutions</div>
          <div className="sidebar-brand-sub">Admin Portal</div>
        </div>

        <nav className="sidebar-nav">
          {navItems.map(item => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              id={item.id}
              className={({ isActive }) =>
                `sidebar-nav-item ${isActive ? 'active' : ''}`
              }
            >
              <item.icon className="sidebar-nav-icon" size={20} />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="sidebar-footer" style={{ padding: '16px' }}>
          <div className="sidebar-user-card" style={{
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border-color)',
            borderRadius: '12px',
            padding: '12px 14px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div className="employee-avatar" style={{ width: '34px', height: '34px', fontSize: '0.85rem', flexShrink: 0 }}>
                {initials}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: '700', fontSize: '0.88rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {profile?.full_name || 'Administrator'}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  Administrator
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingTop: '8px', borderTop: '1px solid var(--border-color)' }}>
              <div style={{ flex: 1 }}>
                <ThemeToggle variant="segmented" />
              </div>
              <button
                className="btn btn-outline btn-sm"
                onClick={handleLogout}
                id="admin-logout-btn"
                title="Logout Account"
                style={{
                  height: '34px',
                  width: '34px',
                  padding: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: '8px',
                  flexShrink: 0,
                  color: 'var(--color-error)',
                  borderColor: 'rgba(239, 68, 68, 0.25)',
                  background: 'rgba(239, 68, 68, 0.05)'
                }}
              >
                <MdLogout size={17} />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="admin-content">
        {/* Mobile Top Header (Sticky Top Bar on Mobile) */}
        <header className="admin-mobile-header">
          <div className="mobile-header-left">
            <button
              type="button"
              className="mobile-hamburger-btn"
              onClick={() => setDrawerOpen(true)}
              aria-label="Open Navigation Drawer"
              id="admin-hamburger-btn"
            >
              <MdMenu size={24} />
            </button>
            <div className="brand-logo">
              <div className="brand-icon">VK</div>
              <div className="brand-text">
                <span className="brand-name">VK IT Solutions</span>
                <span className="brand-sub">Admin</span>
              </div>
            </div>
          </div>

          <div className="mobile-header-right" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ThemeToggle />
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={handleLogout}
              title="Logout"
              aria-label="Logout"
              style={{ color: 'var(--color-error)' }}
            >
              <MdLogout size={20} />
            </button>
          </div>
        </header>

        {/* Mobile Navigation Drawer Backdrop Overlay */}
        <div
          className={`mobile-drawer-backdrop ${drawerOpen ? 'is-open' : ''}`}
          onClick={() => setDrawerOpen(false)}
        />

        {/* Mobile Slide-out Drawer */}
        <aside className={`mobile-drawer ${drawerOpen ? 'is-open' : ''}`}>
          <div className="drawer-header">
            <div className="brand-logo">
              <div className="brand-icon">VK</div>
              <div className="brand-text">
                <span className="brand-name">VK IT Solutions</span>
                <span className="brand-sub">Admin Portal</span>
              </div>
            </div>
            <button
              type="button"
              className="btn-icon-close"
              onClick={() => setDrawerOpen(false)}
              aria-label="Close Navigation Menu"
            >
              <MdClose size={22} />
            </button>
          </div>

          {/* Profile Card in Drawer */}
          <div className="drawer-profile">
            <div className="drawer-avatar">{initials}</div>
            <div className="drawer-profile-info">
              <div className="drawer-profile-name">{profile?.full_name || 'Administrator'}</div>
              <div className="drawer-profile-role">
                <MdAdminPanelSettings size={14} className="inline mr-1" />
                System Administrator
              </div>
            </div>
          </div>

          {/* Navigation Items in Drawer */}
          <nav className="drawer-nav">
            {navItems.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `drawer-nav-item ${isActive ? 'active' : ''}`
                }
                onClick={() => setDrawerOpen(false)}
              >
                <div className="drawer-item-left">
                  <item.icon size={20} className="drawer-item-icon" />
                  <span>{item.label}</span>
                </div>
                <MdChevronRight size={18} className="drawer-item-arrow" />
              </NavLink>
            ))}
          </nav>

          {/* Drawer Footer */}
          <div className="drawer-footer" style={{ padding: '16px', borderTop: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ flex: 1 }}>
                <ThemeToggle variant="segmented" />
              </div>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={handleLogout}
                style={{
                  height: '38px',
                  padding: '0 14px',
                  gap: '6px',
                  color: 'var(--color-error)',
                  borderColor: 'rgba(239, 68, 68, 0.3)',
                  background: 'rgba(239, 68, 68, 0.05)',
                  flexShrink: 0
                }}
              >
                <MdLogout size={17} />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </aside>


        {/* Page Content */}
        <main className="admin-main-body">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
