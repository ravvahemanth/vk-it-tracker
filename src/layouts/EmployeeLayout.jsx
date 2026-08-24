import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { logout } from '../services/api';
import ThemeToggle from '../components/ThemeToggle';
import { MdDashboard, MdHistory, MdPerson, MdLogout } from 'react-icons/md';

export default function EmployeeLayout() {
  const { profile } = useAuth();
  const navigate = useNavigate();

  async function handleLogout() {
    try {
      await logout();
      navigate('/login', { replace: true });
    } catch (err) {
      console.error('Logout error:', err);
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Top Header */}
      <header className="page-header">
        <div className="page-header-inner">
          <div className="brand-logo">
            <div className="brand-icon">VK</div>
            <div className="brand-text">
              <span className="brand-name">VK IT Solutions</span>
              <span className="brand-sub">Work Tracker</span>
            </div>
          </div>
          <div className="header-actions flex gap-2 items-center">
            <ThemeToggle />
            <button
              className="btn btn-ghost btn-sm"
              onClick={handleLogout}
              id="logout-btn"
              aria-label="Logout"
              title="Logout"
            >
              <MdLogout size={18} />
            </button>
          </div>
        </div>
      </header>

      {/* Page Content */}
      <main style={{ flex: 1 }}>
        <Outlet />
      </main>

      {/* Bottom Navigation */}
      <nav className="employee-nav" role="navigation" aria-label="Main navigation">
        <NavLink
          to="/employee"
          end
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          id="nav-dashboard"
        >
          <MdDashboard className="nav-icon" />
          <span className="nav-label">Dashboard</span>
        </NavLink>
        <NavLink
          to="/employee/history"
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          id="nav-history"
        >
          <MdHistory className="nav-icon" />
          <span className="nav-label">History</span>
        </NavLink>
        <NavLink
          to="/employee/profile"
          className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          id="nav-profile"
        >
          <MdPerson className="nav-icon" />
          <span className="nav-label">Profile</span>
        </NavLink>
      </nav>
    </div>
  );
}
