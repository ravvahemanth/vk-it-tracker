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

        <div className="sidebar-footer">
          <div style={{ marginBottom: '14px' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
              Appearance Theme
            </div>
            <ThemeToggle variant="segmented" />
          </div>
          <div style={{ marginBottom: '12px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Logged in as <strong style={{ color: 'var(--text-primary)' }}>{profile?.full_name || 'Administrator'}</strong>
          </div>
          <button
            className="btn btn-outline btn-sm btn-full"
            onClick={handleLogout}
            id="admin-logout-btn"
          >
            <MdLogout size={16} />
            Logout
          </button>
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

          <div className="mobile-header-right">
            <ThemeToggle />
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={handleLogout}
              title="Logout"
              aria-label="Logout"
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
          <div className="drawer-footer">
            <div style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
              Appearance Theme
            </div>
            <ThemeToggle variant="segmented" />

            <button
              type="button"
              className="btn btn-outline btn-danger btn-full mt-3"
              onClick={handleLogout}
            >
              <MdLogout size={18} />
              Logout Account
            </button>
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
