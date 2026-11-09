
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
  LogOut,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import Badge from './Badge';

export default function Sidebar() {
  const {
    user,
    isAuthenticated,
    isAdmin,
    isModerator,
    isAnalyst,
    isOrganizationMember,
    logout,
  } = useAuth();

  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/auth');
  };

  const canModerate = isAdmin || isModerator;
  const canSubmit = isAdmin || isAnalyst;
  const canViewReports = isAdmin || isModerator || isOrganizationMember;

  const linkClass = ({ isActive }) =>
    isActive ? 'nav-item active' : 'nav-item';

  return (
    <aside className="app-sidebar">
      <div className="sidebar-brand">
        <div className="brand-icon">
          <Shield size={28} />
        </div>
        <div className="brand-text">
          <span className="brand-title">ThreatIntel</span>
          <span className="brand-subtitle">Sharing Portal</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        <div className="nav-section-label">Operations</div>

        <ul className="nav-menu">
          <li>
            <NavLink to="/" end className={linkClass}>
              <LayoutDashboard size={18} />
              <span>Dashboard</span>
            </NavLink>
          </li>

          <li>
            <NavLink to="/explorer" className={linkClass}>
              <Search size={18} />
              <span>Threat Explorer</span>
            </NavLink>
          </li>

          {canSubmit && (
            <li>
              <NavLink to="/submit" className={linkClass}>
                <PlusCircle size={18} />
                <span>Submit Threat</span>
              </NavLink>
            </li>
          )}

          {canModerate && (
            <li>
              <NavLink to="/moderation" className={linkClass}>
                <ShieldCheck size={18} />
                <span>Review & Moderation</span>
              </NavLink>
            </li>
          )}
        </ul>

        <div className="nav-section-label">Intelligence & Analytics</div>

        <ul className="nav-menu">
          {canViewReports && (
            <li>
              <NavLink to="/reports" className={linkClass}>
                <FileBarChart size={18} />
                <span>Reports & Analytics</span>
              </NavLink>
            </li>
          )}

          <li>
            <NavLink to="/activity" className={linkClass}>
              <History size={18} />
              <span>Activity & History</span>
            </NavLink>
          </li>

          <li>
            <NavLink to="/profile" className={linkClass}>
              <User size={18} />
              <span>Profile & Settings</span>
            </NavLink>
          </li>
        </ul>
      </nav>

      <div className="sidebar-footer">
        {isAuthenticated && (
          <div className="user-profile-box">
            <div className="user-info">
              <span className="user-name">{user?.name}</span>
              <span className="user-role">
                <Badge type="role" value={user?.role} />
              </span>
            </div>

            <button
              className="logout-btn"
              onClick={handleLogout}
              title="Logout of session"
            >
              <LogOut size={16} />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
