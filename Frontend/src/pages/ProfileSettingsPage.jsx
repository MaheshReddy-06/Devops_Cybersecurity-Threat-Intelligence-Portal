import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User,
  Key,
  Shield,
  CheckCircle,
  AlertTriangle,
  LogOut,
  Mail,
  Calendar,
  Lock,
  ArrowRight,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import Badge from '../components/Badge';

export default function ProfileSettingsPage() {
  const { user, changePassword, logout, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  // Password change state
  const [passData, setPassData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [passErrors, setPassErrors] = useState({});
  const [isChangingPass, setIsChangingPass] = useState(false);
  const [passSuccess, setPassSuccess] = useState('');
  const [passError, setPassError] = useState('');

  const handlePassChange = (e) => {
    const { name, value } = e.target;
    setPassData((prev) => ({ ...prev, [name]: value }));
    if (passErrors[name]) {
      setPassErrors((prev) => ({ ...prev, [name]: '' }));
    }
    setPassError('');
    setPassSuccess('');
  };

  const validatePasswordForm = () => {
    const errors = {};
    if (!passData.currentPassword) {
      errors.currentPassword = 'Enter your current password';
    }
    if (!passData.newPassword) {
      errors.newPassword = 'Enter a new password';
    } else if (passData.newPassword.length < 6) {
      errors.newPassword = 'New password must be at least 6 characters long';
    }
    if (passData.newPassword !== passData.confirmPassword) {
      errors.confirmPassword = 'New passwords do not match';
    }
    setPassErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setPassError('');
    setPassSuccess('');

    if (!validatePasswordForm()) return;

    setIsChangingPass(true);
    const result = await changePassword(passData.currentPassword, passData.newPassword);
    setIsChangingPass(false);

    if (result.success) {
      setPassSuccess('Your password has been changed successfully.');
      setPassData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } else {
      setPassError(result.message);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/auth');
  };

  if (!isAuthenticated) {
    return (
      <div className="card" style={{ textAlign: 'center', padding: 'var(--spacing-2xl)' }}>
        <User size={48} color="var(--color-text-muted)" style={{ margin: '0 auto 16px' }} />
        <h2>Not Signed In</h2>
        <p style={{ color: 'var(--color-text-secondary)', marginBottom: '16px' }}>
          Please log in to manage your analyst credentials and security settings.
        </p>
        <button className="btn btn-primary" onClick={() => navigate('/auth')}>
          Go to Sign In
        </button>
      </div>
    );
  }

  return (
    <div className="profile-layout">
      {/* User Information Card */}
      <div className="card" style={{ marginBottom: 'var(--spacing-lg)' }}>
        <div className="card-header-clean">
          <h3 className="card-title">
            <User size={20} color="var(--color-blue-primary)" />
            <span>Personnel Profile Information</span>
          </h3>
          <Badge type="role" value={user?.role} />
        </div>

        <div className="profile-grid">
          <div className="profile-field">
            <span className="profile-label">Full Name</span>
            <span className="profile-val">{user?.name}</span>
          </div>

          <div className="profile-field">
            <span className="profile-label">Email Address</span>
            <span className="profile-val">{user?.email}</span>
          </div>

          <div className="profile-field">
            <span className="profile-label">Account Security Level</span>
            <span className="profile-val" style={{ textTransform: 'capitalize' }}>
              {user?.role === 'admin' ? 'Security Administrator (Full Access)' : 'Threat Intelligence Analyst'}
            </span>
          </div>

          <div className="profile-field">
            <span className="profile-label">User Identifier</span>
            <code className="profile-val" style={{ fontSize: 'var(--font-size-xs)' }}>
              {user?.id || user?._id}
            </code>
          </div>

          <div className="profile-field">
            <span className="profile-label">Member Since</span>
            <span className="profile-val">
              {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}
            </span>
          </div>
        </div>
      </div>

      <div className="dashboard-two-col">
        {/* Change Password Card */}
        <div className="card">
          <div className="card-header-clean">
            <h3 className="card-title">
              <Key size={18} color="var(--color-blue-primary)" />
              <span>Update Password</span>
            </h3>
          </div>

          {passSuccess && (
            <div className="alert alert-success" style={{ marginBottom: 'var(--spacing-md)' }}>
              <CheckCircle size={16} />
              <span>{passSuccess}</span>
            </div>
          )}

          {passError && (
            <div className="alert alert-danger" style={{ marginBottom: 'var(--spacing-md)' }}>
              <AlertTriangle size={16} />
              <span>{passError}</span>
            </div>
          )}

          <form onSubmit={handlePasswordSubmit} noValidate>
            <div className="form-group">
              <label htmlFor="currentPassword" className="form-label">
                Current Password
              </label>
              <input
                id="currentPassword"
                type="password"
                name="currentPassword"
                className={`form-input ${passErrors.currentPassword ? 'input-error' : ''}`}
                value={passData.currentPassword}
                onChange={handlePassChange}
              />
              {passErrors.currentPassword && (
                <span className="field-error-text">{passErrors.currentPassword}</span>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="newPassword" className="form-label">
                New Password
              </label>
              <input
                id="newPassword"
                type="password"
                name="newPassword"
                className={`form-input ${passErrors.newPassword ? 'input-error' : ''}`}
                placeholder="Minimum 6 characters"
                value={passData.newPassword}
                onChange={handlePassChange}
              />
              {passErrors.newPassword && (
                <span className="field-error-text">{passErrors.newPassword}</span>
              )}
            </div>

            <div className="form-group">
              <label htmlFor="confirmPassword" className="form-label">
                Confirm New Password
              </label>
              <input
                id="confirmPassword"
                type="password"
                name="confirmPassword"
                className={`form-input ${passErrors.confirmPassword ? 'input-error' : ''}`}
                value={passData.confirmPassword}
                onChange={handlePassChange}
              />
              {passErrors.confirmPassword && (
                <span className="field-error-text">{passErrors.confirmPassword}</span>
              )}
            </div>

            <button type="submit" className="btn btn-primary" disabled={isChangingPass}>
              {isChangingPass ? 'Updating...' : 'Change Password'}
            </button>
          </form>
        </div>

        {/* Role Permissions & Logout Box */}
        <div className="card">
          <div className="card-header-clean">
            <h3 className="card-title">
              <Shield size={18} color="var(--color-blue-primary)" />
              <span>Role Permissions & Privileges</span>
            </h3>
          </div>

          <div className="role-permissions-list">
            <div className="perm-item">
              <CheckCircle size={16} color="var(--color-threat-low)" />
              <div>
                <strong>Ingest & Submit Threat Indicators</strong>
                <p>Submit IPs, Domains, URLs, and Hashes to the triage queue.</p>
              </div>
            </div>

            <div className="perm-item">
              <CheckCircle size={16} color="var(--color-threat-low)" />
              <div>
                <strong>Search & Filter Global Explorer</strong>
                <p>Inspect peer-verified intelligence and IoC attributes.</p>
              </div>
            </div>

            <div className="perm-item">
              <CheckCircle size={16} color="var(--color-threat-low)" />
              <div>
                <strong>Export Intelligence Reports</strong>
                <p>Generate, filter, and download CSV reports.</p>
              </div>
            </div>

            <div className="perm-item">
              {user?.role === 'admin' ? (
                <CheckCircle size={16} color="var(--color-threat-low)" />
              ) : (
                <Lock size={16} color="var(--color-text-muted)" />
              )}
              <div>
                <strong>Review & Moderation Console</strong>
                <p>
                  {user?.role === 'admin'
                    ? 'Granted: You can approve, reject, and add triage comments.'
                    : 'Restricted: Administrator access required to approve or reject items.'}
                </p>
              </div>
            </div>
          </div>

          <div
            style={{
              marginTop: 'var(--spacing-xl)',
              paddingTop: 'var(--spacing-md)',
              borderTop: '1px solid var(--color-border)',
            }}
          >
            <button className="btn btn-danger" onClick={handleLogout} style={{ width: '100%' }}>
              <LogOut size={16} /> Sign Out of Portal
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
