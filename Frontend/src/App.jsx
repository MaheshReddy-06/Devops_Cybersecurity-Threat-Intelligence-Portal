
import React from 'react';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  useLocation,
  Navigate,
} from 'react-router-dom';

import { AuthProvider, useAuth } from './context/AuthContext';
import Sidebar from './components/Sidebar';
import Navbar from './components/Navbar';

import DashboardPage from './pages/DashboardPage';
import ThreatExplorerPage from './pages/ThreatExplorerPage';
import ThreatSubmissionPage from './pages/ThreatSubmissionPage';
import ModerationPage from './pages/ModerationPage';
import ReportsPage from './pages/ReportsPage';
import ActivityHistoryPage from './pages/ActivityHistoryPage';
import ProfileSettingsPage from './pages/ProfileSettingsPage';
import AuthPage from './pages/AuthPage';

// Check login and role permissions
function RoleRoute({ children, allowedRoles }) {
  const { user, isAuthenticated, loading } = useAuth();

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth" replace />;
  }

  if (!allowedRoles.includes(user?.role)) {
    return <Navigate to="/" replace />;
  }

  return children;
}

// Login page is only available to logged-out users
function PublicRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <div>Loading...</div>;
  }

  return isAuthenticated ? <Navigate to="/" replace /> : children;
}

function MainAppLayout() {
  const location = useLocation();
  const { isAuthenticated, loading } = useAuth();

  const getPageTitle = (path) => {
    switch (path) {
      case '/':
        return 'Executive Threat Intelligence Dashboard';
      case '/explorer':
        return 'Global Threat Intelligence Explorer';
      case '/submit':
        return 'Submit Threat Indicator';
      case '/moderation':
        return 'Review & Moderation Console';
      case '/reports':
        return 'Threat Intelligence Reports & Metrics';
      case '/activity':
        return 'Analyst Activity & Audit History';
      case '/profile':
        return 'Personnel Profile & Security Settings';
      default:
        return 'Cybersecurity Threat Intelligence Portal';
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  if (!isAuthenticated) {
    return (
      <Routes>
        <Route path="/auth" element={<PublicRoute><AuthPage /></PublicRoute>} />
        <Route path="*" element={<Navigate to="/auth" replace />} />
      </Routes>
    );
  }

  return (
    <div className="portal-root-layout">
      <Sidebar />

      <div className="portal-main-area">
        <Navbar title={getPageTitle(location.pathname)} />

        <main className="portal-content-body">
          <Routes>
            <Route path="/" element={
              <RoleRoute allowedRoles={['admin', 'moderator', 'analyst', 'organization_member']}>
                <DashboardPage />
              </RoleRoute>
            } />

            <Route path="/explorer" element={
              <RoleRoute allowedRoles={['admin', 'moderator', 'analyst', 'organization_member']}>
                <ThreatExplorerPage />
              </RoleRoute>
            } />

            <Route path="/submit" element={
              <RoleRoute allowedRoles={['admin', 'analyst']}>
                <ThreatSubmissionPage />
              </RoleRoute>
            } />

            <Route path="/moderation" element={
              <RoleRoute allowedRoles={['admin', 'moderator']}>
                <ModerationPage />
              </RoleRoute>
            } />

            <Route path="/reports" element={
              <RoleRoute allowedRoles={['admin', 'moderator', 'organization_member']}>
                <ReportsPage />
              </RoleRoute>
            } />

            <Route path="/activity" element={
              <RoleRoute allowedRoles={['admin', 'moderator', 'analyst', 'organization_member']}>
                <ActivityHistoryPage />
              </RoleRoute>
            } />

            <Route path="/profile" element={
              <RoleRoute allowedRoles={['admin', 'moderator', 'analyst', 'organization_member']}>
                <ProfileSettingsPage />
              </RoleRoute>
            } />

            <Route path="/auth" element={<Navigate to="/" replace />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <MainAppLayout />
      </Router>
    </AuthProvider>
  );
}
