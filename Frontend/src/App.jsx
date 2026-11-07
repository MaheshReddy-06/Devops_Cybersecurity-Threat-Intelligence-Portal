import React from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Sidebar from './components/Sidebar';
import Navbar from './components/Navbar';

// Eight Main Application Pages
import DashboardPage from './pages/DashboardPage';
import ThreatExplorerPage from './pages/ThreatExplorerPage';
import ThreatSubmissionPage from './pages/ThreatSubmissionPage';
import ModerationPage from './pages/ModerationPage';
import ReportsPage from './pages/ReportsPage';
import ActivityHistoryPage from './pages/ActivityHistoryPage';
import ProfileSettingsPage from './pages/ProfileSettingsPage';
import AuthPage from './pages/AuthPage';

// Inner component to map page title dynamically based on location
function MainAppLayout() {
  const location = useLocation();

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
      case '/auth':
        return 'Portal Authentication & Registration';
      default:
        return 'Cybersecurity Threat Intelligence Portal';
    }
  };

  return (
    <div className="portal-root-layout">
      {/* Sidebar Navigation: All 8 screens accessible */}
      <Sidebar />

      {/* Main Workspace Area */}
      <div className="portal-main-area">
        <Navbar title={getPageTitle(location.pathname)} />
        <main className="portal-content-body">
          <Routes>
            {/* Exactly Eight Main Application Screens */}
            <Route path="/" element={<DashboardPage />} />
            <Route path="/explorer" element={<ThreatExplorerPage />} />
            <Route path="/submit" element={<ThreatSubmissionPage />} />
            <Route path="/moderation" element={<ModerationPage />} />
            <Route path="/reports" element={<ReportsPage />} />
            <Route path="/activity" element={<ActivityHistoryPage />} />
            <Route path="/profile" element={<ProfileSettingsPage />} />
            <Route path="/auth" element={<AuthPage />} />
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
