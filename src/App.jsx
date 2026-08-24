import { Routes, Route, Navigate } from 'react-router-dom';
import { RedirectIfAuthenticated, RequireEmployee, RequireAdmin } from './components/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import EmployeeDashboard from './pages/employee/EmployeeDashboard';
import EmployeeHistory from './pages/employee/EmployeeHistory';
import EmployeeProfile from './pages/employee/EmployeeProfile';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminEmployees from './pages/admin/AdminEmployees';
import AdminSessions from './pages/admin/AdminSessions';
import AdminReports from './pages/admin/AdminReports';
import EmployeeLayout from './layouts/EmployeeLayout';
import AdminLayout from './layouts/AdminLayout';
import ConfigBanner from './components/ConfigBanner';

export default function App() {
  return (
    <>
      <ConfigBanner />
      <OfflineBanner />

      <Routes>
        {/* Public Routes */}
        <Route
          path="/login"
          element={
            <RedirectIfAuthenticated>
              <LoginPage />
            </RedirectIfAuthenticated>
          }
        />

        {/* Employee Routes */}
        <Route
          path="/employee"
          element={
            <RequireEmployee>
              <EmployeeLayout />
            </RequireEmployee>
          }
        >
          <Route index element={<EmployeeDashboard />} />
          <Route path="history" element={<EmployeeHistory />} />
          <Route path="profile" element={<EmployeeProfile />} />
        </Route>

        {/* Admin Routes */}
        <Route
          path="/admin"
          element={
            <RequireAdmin>
              <AdminLayout />
            </RequireAdmin>
          }
        >
          <Route index element={<AdminDashboard />} />
          <Route path="employees" element={<AdminEmployees />} />
          <Route path="sessions" element={<AdminSessions />} />
          <Route path="reports" element={<AdminReports />} />
        </Route>

        {/* Default Redirect */}
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </>
  );
}
