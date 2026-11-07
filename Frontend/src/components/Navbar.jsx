import React from 'react';
import { NavLink } from 'react-router-dom';
import { Shield, Activity, User, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import Badge from './Badge';

export default function Navbar({ title }) {
  const { user, isAuthenticated, logout } = useAuth();

  return (
    <header className="top-navbar">
      <div className="navbar-left">
        <h1 className="page-heading">{title}</h1>
      </div>

      <div className="navbar-right">
        {/* System Health Indicator */}
        <div className="status-pill">
          <span className="status-dot"></span>
          <span className="status-text">Live Intelligence Feed</span>
        </div>

        {isAuthenticated ? (
          <div className="navbar-user-meta">
            <span className="navbar-user-name">{user?.name}</span>
            <Badge type="role" value={user?.role} />
            <button
              onClick={logout}
              className="btn btn-outline btn-sm"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}
            >
              <LogOut size={14} />
              <span>Logout</span>
            </button>
          </div>
        ) : (
          <NavLink to="/auth" className="btn btn-primary btn-sm">
            Sign In / Register
          </NavLink>
        )}
      </div>
    </header>
  );
}
