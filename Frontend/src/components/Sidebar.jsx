import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  Shield,
  LayoutDashboard,
  Search,
  PlusCircle,
  ShieldCheck,
  FileBarChart,
  History,
  User,
  LogIn,
  LogOut,
  ShieldAlert,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import Badge from './Badge';

export default function Sidebar() {
  const { user, isAuthenticated, isAdmin, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/auth');
  };

  return (
    <aside className="app-sidebar">
      {/* Brand Header */}
      <div className="sidebar-brand">
        <div className="brand-icon">
          <Shield size={28} />
        </div>
        <div className="brand-text">
          <span className="brand-title">ThreatIntel</span>
          <span className="brand-subtitle">Sharing Portal</span>
        </div>
      </div>

      {/* Navigation List: Exactly 8 Screens Accessible */}
      <nav className="sidebar-nav">
        <div className="nav-section-label">Operations</div>
        <ul className="nav-menu">
          {/* 1. Dashboard */}
          <li>
            <NavLink to="/" end className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}>
              <LayoutDashboard size={18} />
              <span>Dashboard</span>
            </NavLink>
          </li>

          {/* 2. Threat Explorer */}
          <li>
            <NavLink to="/explorer" className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}>
              <Search size={18} />
              <span>Threat Explorer</span>
            </NavLink>
          </li>

          {/* 3. Threat Submission */}
          <li>
            <NavLink to="/submit" className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}>
              <PlusCircle size={18} />
              <span>Submit Threat</span>
            </NavLink>
          </li>

          {/* 4. Review & Moderation (Role-based: Hidden from ordinary analysts) */}
          {isAdmin && (
            <li>
              <NavLink to="/moderation" className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}>
                <ShieldCheck size={18} />
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                  <span>Review & Moderation</span>
                  <span className="sidebar-role-tag">Admin</span>
                </span>
              </NavLink>
            </li>
          )}
        </ul>

        <div className="nav-section-label">Intelligence & Analytics</div>
        <ul className="nav-menu">
          {/* 5. Reports */}
          <li>
            <NavLink to="/reports" className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}>
              <FileBarChart size={18} />
              <span>Reports & Analytics</span>
            </NavLink>
          </li>

          {/* 6. Analyst Activity & History */}
          <li>
            <NavLink to="/activity" className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}>
              <History size={18} />
              <span>Activity & History</span>
            </NavLink>
          </li>

          {/* 7. Profile & Settings */}
          <li>
            <NavLink to="/profile" className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}>
              <User size={18} />
              <span>Profile & Settings</span>
            </NavLink>
          </li>

          {/* 8. Login & Registration */}
          <li>
            <NavLink to="/auth" className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}>
              <LogIn size={18} />
              <span>Login / Register</span>
            </NavLink>
          </li>
        </ul>
      </nav>

      {/* User Session Footer */}
      <div className="sidebar-footer">
        {isAuthenticated ? (
          <div className="user-profile-box">
            <div className="user-info">
              <span className="user-name">{user?.name}</span>
              <span className="user-role">
                <Badge type="role" value={user?.role} />
              </span>
            </div>
            <button className="logout-btn" onClick={handleLogout} title="Logout of session">
              <LogOut size={16} />
            </button>
          </div>
        ) : (
          <div className="guest-box">
            <span className="guest-text">Guest Mode (Read-Only)</span>
            <NavLink to="/auth" className="btn btn-primary btn-sm" style={{ width: '100%', marginTop: '6px' }}>
              Sign In
            </NavLink>
          </div>
        )}
      </div>
    </aside>
  );
}
