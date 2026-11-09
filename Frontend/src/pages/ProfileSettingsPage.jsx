
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  User,
  Key,
  Shield,
  CheckCircle,
  AlertTriangle,
  LogOut,
  Lock,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import Badge from '../components/Badge';
import api from '../services/api';

export default function ProfileSettingsPage() {
  const { user, changePassword, logout, isAuthenticated, isAdmin } = useAuth();
  const navigate = useNavigate();

  // Admin user management state
  const [managedUsers, setManagedUsers] = useState([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersError, setUsersError] = useState('');
  const [usersMessage, setUsersMessage] = useState('');
  const [updatingUserId, setUpdatingUserId] = useState('');

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

  // Fetch all registered users
  const fetchManagedUsers = async () => {
    setUsersLoading(true);
    setUsersError('');

    try {
      const response = await api.get('/admin/users');
      setManagedUsers(response.data.users || []);
    } catch (error) {
      setUsersError(
        error.response?.data?.message || 'Failed to load users.'
      );
    } finally {
      setUsersLoading(false);
    }
  };

  // Load users when Admin opens this page
  useEffect(() => {
    if (isAdmin) {
      fetchManagedUsers();
    }
  }, [isAdmin]);

  // Handle password input
  const handlePassChange = (e) => {
    const { name, value } = e.target;

    setPassData((prev) => ({
      ...prev,
      [name]: value,
    }));

    if (passErrors[name]) {
      setPassErrors((prev) => ({
        ...prev,
        [name]: '',
      }));
    }

    setPassError('');
    setPassSuccess('');
  };

  // Validate password form
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

    if (!passData.confirmPassword) {
      errors.confirmPassword = 'Confirm your new password';
    } else if (passData.newPassword !== passData.confirmPassword) {
      errors.confirmPassword = 'New passwords do not match';
    }

    setPassErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Submit password change
  const handlePasswordSubmit = async (e) => {
    e.preventDefault();

    setPassError('');
    setPassSuccess('');

    if (!validatePasswordForm()) return;

    setIsChangingPass(true);

    try {
      const result = await changePassword(
        passData.currentPassword,
        passData.newPassword
      );

      if (result.success) {
        setPassSuccess('Your password has been changed successfully.');

        setPassData({
          currentPassword: '',
          newPassword: '',
          confirmPassword: '',
        });
      } else {
        setPassError(result.message);
      }
    } catch (error) {
      setPassError('Failed to change password. Please try again.');
    } finally {
      setIsChangingPass(false);
    }
  };

  // Change another user's role
  const handleRoleUpdate = async (targetUser, newRole) => {
    if (targetUser.role === newRole) return;

    const confirmed = window.confirm(
      `Change ${targetUser.name}'s role to ${newRole.replace(/_/g, ' ')}?`
    );

    if (!confirmed) return;

    setUpdatingUserId(targetUser._id);
    setUsersError('');
    setUsersMessage('');

    try {
      const response = await api.put(
        `/admin/users/${targetUser._id}/role`,
        { role: newRole }
      );

      setManagedUsers((previousUsers) =>
        previousUsers.map((item) =>
          item._id === targetUser._id
            ? response.data.user
            : item
        )
      );

      setUsersMessage(response.data.message);
    } catch (error) {
      setUsersError(
        error.response?.data?.message || 'Failed to update user role.'
      );
    } finally {
      setUpdatingUserId('');
    }
  };

  // Logout
  const handleLogout = () => {
    logout();
    navigate('/auth');
  };

  // Authentication check
  if (!isAuthenticated) {
    return (
      <div
        className="card"
        style={{
          textAlign: 'center',
          padding: 'var(--spacing-2xl)',
        }}
      >
        <User
          size={48}
          color="var(--color-text-muted)"
          style={{ margin: '0 auto 16px' }}
        />

        <h2>Not Signed In</h2>

        <p style={{ color: 'var(--color-text-secondary)', marginBottom: '16px' }}>
          Please log in to manage your account and security settings.
        </p>

        <button
          className="btn btn-primary"
          onClick={() => navigate('/auth')}
        >
          Go to Sign In
        </button>
      </div>
    );
  }

  // Role display names
  const roleNames = {
    admin: 'Administrator',
    analyst: 'Threat Analyst',
    moderator: 'Moderator',
    organization_member: 'Organization Member',
  };

  // Current user role
  const currentRole = user?.role || 'analyst';

  const canSubmit = ['admin', 'analyst'].includes(currentRole);
  const canModerate = ['admin', 'moderator'].includes(currentRole);
  const canViewReports = ['admin', 'moderator', 'organization_member'].includes(currentRole);

  return (
    <div className="profile-layout">

      {/* User Information Card */}
      <div
        className="card"
        style={{ marginBottom: 'var(--spacing-lg)' }}
      >
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
            <span className="profile-label">Account Role</span>
            <span className="profile-val">
              {roleNames[currentRole]}
            </span>
          </div>

          <div className="profile-field">
            <span className="profile-label">User Identifier</span>
            <code
              className="profile-val"
              style={{ fontSize: 'var(--font-size-xs)' }}
            >
              {user?._id || user?.id}
            </code>
          </div>

          <div className="profile-field">
            <span className="profile-label">Member Since</span>
            <span className="profile-val">
              {user?.createdAt
                ? new Date(user.createdAt).toLocaleDateString()
                : 'N/A'}
            </span>
          </div>
        </div>
      </div>

      {/* Admin User Management */}
      {isAdmin && (
        <div
          className="card"
          style={{ marginBottom: 'var(--spacing-lg)' }}
        >
          <div className="card-header-clean">
            <h3 className="card-title">
              <Shield size={20} color="var(--color-blue-primary)" />
              <span>User Management</span>
            </h3>

            <Badge type="role" value="admin" />
          </div>

          <p
            style={{
              color: 'var(--color-text-secondary)',
              marginBottom: 'var(--spacing-md)',
            }}
          >
            View registered users and assign their platform roles.
          </p>

          {usersError && (
            <div
              className="alert alert-danger"
              style={{ marginBottom: 'var(--spacing-md)' }}
            >
              <AlertTriangle size={16} />
              <span>{usersError}</span>
            </div>
          )}

          {usersMessage && (
            <div
              className="alert alert-success"
              style={{ marginBottom: 'var(--spacing-md)' }}
            >
              <CheckCircle size={16} />
              <span>{usersMessage}</span>
            </div>
          )}

          {usersLoading ? (
            <p>Loading registered users...</p>
          ) : managedUsers.length === 0 ? (
            <p>No registered users found.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                }}
              >
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left', padding: '12px' }}>
                      Name
                    </th>

                    <th style={{ textAlign: 'left', padding: '12px' }}>
                      Email
                    </th>

                    <th style={{ textAlign: 'left', padding: '12px' }}>
                      Current Role
                    </th>

                    <th style={{ textAlign: 'left', padding: '12px' }}>
                      Change Role
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {managedUsers.map((managedUser) => {
                    const isCurrentUser =
                      String(managedUser._id) ===
                      String(user?._id || user?.id);

                    return (
                      <tr key={managedUser._id}>
                        <td style={{ padding: '12px' }}>
                          {managedUser.name}
                          {isCurrentUser && ' (You)'}
                        </td>

                        <td style={{ padding: '12px' }}>
                          {managedUser.email}
                        </td>

                        <td
                          style={{
                            padding: '12px',
                            textTransform: 'capitalize',
                          }}
                        >
                          {roleNames[managedUser.role] || managedUser.role}
                        </td>

                        <td style={{ padding: '12px' }}>
                          <select
                            className="form-input"
                            value={managedUser.role}
                            disabled={
                              isCurrentUser ||
                              updatingUserId === managedUser._id
                            }
                            onChange={(e) =>
                              handleRoleUpdate(
                                managedUser,
                                e.target.value
                              )
                            }
                          >
                            <option value="admin">Administrator</option>
                            <option value="analyst">Threat Analyst</option>
                            <option value="moderator">Moderator</option>
                            <option value="organization_member">
                              Organization Member
                            </option>
                          </select>

                          {updatingUserId === managedUser._id && (
                            <small>Updating...</small>
                          )}

                          {isCurrentUser && (
                            <small
                              style={{
                                display: 'block',
                                marginTop: '4px',
                              }}
                            >
                              Your own role cannot be changed here.
                            </small>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Password and Permissions Section */}
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
            <div
              className="alert alert-success"
              style={{ marginBottom: 'var(--spacing-md)' }}
            >
              <CheckCircle size={16} />
              <span>{passSuccess}</span>
            </div>
          )}

          {passError && (
            <div
              className="alert alert-danger"
              style={{ marginBottom: 'var(--spacing-md)' }}
            >
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
                className={`form-input ${
                  passErrors.currentPassword ? 'input-error' : ''
                }`}
                value={passData.currentPassword}
                onChange={handlePassChange}
              />

              {passErrors.currentPassword && (
                <span className="field-error-text">
                  {passErrors.currentPassword}
                </span>
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
                className={`form-input ${
                  passErrors.newPassword ? 'input-error' : ''
                }`}
                placeholder="Minimum 6 characters"
                value={passData.newPassword}
                onChange={handlePassChange}
              />

              {passErrors.newPassword && (
                <span className="field-error-text">
                  {passErrors.newPassword}
                </span>
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
                className={`form-input ${
                  passErrors.confirmPassword ? 'input-error' : ''
                }`}
                value={passData.confirmPassword}
                onChange={handlePassChange}
              />

              {passErrors.confirmPassword && (
                <span className="field-error-text">
                  {passErrors.confirmPassword}
                </span>
              )}
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={isChangingPass}
            >
              {isChangingPass ? 'Updating...' : 'Change Password'}
            </button>
          </form>
        </div>

        {/* Role Permissions and Logout */}
        <div className="card">
          <div className="card-header-clean">
            <h3 className="card-title">
              <Shield size={18} color="var(--color-blue-primary)" />
              <span>Role Permissions & Privileges</span>
            </h3>
          </div>

          <div className="role-permissions-list">

            <div className="perm-item">
              {canSubmit ? (
                <CheckCircle size={16} color="var(--color-threat-low)" />
              ) : (
                <Lock size={16} color="var(--color-text-muted)" />
              )}

              <div>
                <strong>Submit Threat Indicators</strong>
                <p>
                  {canSubmit
                    ? 'You can submit IPs, domains, URLs, and hashes.'
                    : 'Threat submission is not permitted for your role.'}
                </p>
              </div>
            </div>

            <div className="perm-item">
              <CheckCircle size={16} color="var(--color-threat-low)" />

              <div>
                <strong>Search Global Explorer</strong>
                <p>
                  Search and inspect approved threat intelligence.
                </p>
              </div>
            </div>

            <div className="perm-item">
              {canViewReports ? (
                <CheckCircle size={16} color="var(--color-threat-low)" />
              ) : (
                <Lock size={16} color="var(--color-text-muted)" />
              )}

              <div>
                <strong>View Intelligence Reports</strong>
                <p>
                  {canViewReports
                    ? 'You can access the reports available to your role.'
                    : 'Report access is restricted for your role.'}
                </p>
              </div>
            </div>

            <div className="perm-item">
              {canModerate ? (
                <CheckCircle size={16} color="var(--color-threat-low)" />
              ) : (
                <Lock size={16} color="var(--color-text-muted)" />
              )}

              <div>
                <strong>Review & Moderation Console</strong>
                <p>
                  {canModerate
                    ? 'You can review, approve, and reject submissions.'
                    : 'Moderator or Administrator access required.'}
                </p>
              </div>
            </div>

            <div className="perm-item">
              {isAdmin ? (
                <CheckCircle size={16} color="var(--color-threat-low)" />
              ) : (
                <Lock size={16} color="var(--color-text-muted)" />
              )}

              <div>
                <strong>User Management</strong>
                <p>
                  {isAdmin
                    ? 'You can view users and assign platform roles.'
                    : 'Administrator access required.'}
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
            <button
              className="btn btn-danger"
              onClick={handleLogout}
              style={{ width: '100%' }}
            >
              <LogOut size={16} />
              Sign Out of Portal
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
