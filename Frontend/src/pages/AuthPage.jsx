import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Lock, Mail, User, AlertCircle, CheckCircle, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [formErrors, setFormErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [serverError, setServerError] = useState('');

  const { login, register } = useAuth();
  const navigate = useNavigate();

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    // Clear field-specific error upon typing
    if (formErrors[name]) {
      setFormErrors((prev) => ({ ...prev, [name]: '' }));
    }
    setServerError('');
  };

  const validateForm = () => {
    const errors = {};
    const emailRegex = /^\S+@\S+\.\S+$/;

    if (!formData.email.trim()) {
      errors.email = 'Email address is required';
    } else if (!emailRegex.test(formData.email.trim())) {
      errors.email = 'Please enter a valid email address';
    }

    if (!formData.password) {
      errors.password = 'Password is required';
    } else if (formData.password.length < 6) {
      errors.password = 'Password must be at least 6 characters long';
    }

    if (!isLogin) {
      if (!formData.name.trim()) {
        errors.name = 'Full name is required';
      }
      if (formData.password !== formData.confirmPassword) {
        errors.confirmPassword = 'Passwords do not match';
      }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerError('');
    setSuccessMessage('');

    if (!validateForm()) return;

    setIsSubmitting(true);

    if (isLogin) {
      const result = await login(formData.email.trim(), formData.password);
      setIsSubmitting(false);
      if (result.success) {
        navigate('/');
      } else {
        setServerError(result.message);
      }
    } else {
      const result = await register(
        formData.name.trim(),
        formData.email.trim(),
        formData.password
      );
      setIsSubmitting(false);
      if (result.success) {
        setSuccessMessage('Analyst account created successfully! Redirecting to dashboard...');
        setTimeout(() => {
          navigate('/');
        }, 1000);
      } else {
        setServerError(result.message);
      }
    }
  };

  const fillDemoAdmin = () => {
    setFormData({
      name: '',
      email: 'admin@portal.local',
      password: 'Admin@SecurePassword123',
      confirmPassword: '',
    });
    setIsLogin(true);
    setFormErrors({});
    setServerError('');
  };

  return (
    <div className="auth-page-container">
      <div className="auth-card">
        {/* Brand Banner */}
        <div className="auth-header">
          <div className="auth-icon-wrapper">
            <Shield size={36} color="var(--color-blue-primary)" />
          </div>
          <h2>Cybersecurity Threat Intelligence</h2>
          <p>Academic Sharing Portal &middot; Authentication</p>
        </div>

        {/* Tab Switcher */}
        <div className="auth-tabs">
          <button
            type="button"
            className={`auth-tab-btn ${isLogin ? 'active' : ''}`}
            onClick={() => {
              setIsLogin(true);
              setServerError('');
              setFormErrors({});
            }}
          >
            Sign In
          </button>
          <button
            type="button"
            className={`auth-tab-btn ${!isLogin ? 'active' : ''}`}
            onClick={() => {
              setIsLogin(false);
              setServerError('');
              setFormErrors({});
            }}
          >
            Register as Analyst
          </button>
        </div>

        {/* Feedback Alerts */}
        {serverError && (
          <div className="alert alert-danger" style={{ marginBottom: 'var(--spacing-md)' }}>
            <AlertCircle size={18} />
            <span>{serverError}</span>
          </div>
        )}

        {successMessage && (
          <div className="alert alert-success" style={{ marginBottom: 'var(--spacing-md)' }}>
            <CheckCircle size={18} />
            <span>{successMessage}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} noValidate>
          {!isLogin && (
            <div className="form-group">
              <label htmlFor="name" className="form-label">
                Full Name
              </label>
              <div className="input-with-icon">
                <User size={18} className="input-icon" />
                <input
                  id="name"
                  type="text"
                  name="name"
                  className={`form-input ${formErrors.name ? 'input-error' : ''}`}
                  placeholder="e.g. John Doe, SOC Analyst"
                  value={formData.name}
                  onChange={handleInputChange}
                />
              </div>
              {formErrors.name && <span className="field-error-text">{formErrors.name}</span>}
            </div>
          )}

          <div className="form-group">
            <label htmlFor="email" className="form-label">
              Email Address
            </label>
            <div className="input-with-icon">
              <Mail size={18} className="input-icon" />
              <input
                id="email"
                type="email"
                name="email"
                className={`form-input ${formErrors.email ? 'input-error' : ''}`}
                placeholder="analyst@domain.com"
                value={formData.email}
                onChange={handleInputChange}
              />
            </div>
            {formErrors.email && <span className="field-error-text">{formErrors.email}</span>}
          </div>

          <div className="form-group">
            <label htmlFor="password" className="form-label">
              Password
            </label>
            <div className="input-with-icon">
              <Lock size={18} className="input-icon" />
              <input
                id="password"
                type="password"
                name="password"
                className={`form-input ${formErrors.password ? 'input-error' : ''}`}
                placeholder="Minimum 6 characters"
                value={formData.password}
                onChange={handleInputChange}
              />
            </div>
            {formErrors.password && <span className="field-error-text">{formErrors.password}</span>}
          </div>

          {!isLogin && (
            <div className="form-group">
              <label htmlFor="confirmPassword" className="form-label">
                Confirm Password
              </label>
              <div className="input-with-icon">
                <Lock size={18} className="input-icon" />
                <input
                  id="confirmPassword"
                  type="password"
                  name="confirmPassword"
                  className={`form-input ${formErrors.confirmPassword ? 'input-error' : ''}`}
                  placeholder="Repeat your password"
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
                />
              </div>
              {formErrors.confirmPassword && (
                <span className="field-error-text">{formErrors.confirmPassword}</span>
              )}
            </div>
          )}

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', marginTop: 'var(--spacing-md)' }}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <span>Processing...</span>
            ) : isLogin ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                Sign In to Portal <ArrowRight size={16} />
              </span>
            ) : (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                Complete Registration <ArrowRight size={16} />
              </span>
            )}
          </button>
        </form>

        {/* Quick Demo Helper */}
        <div className="auth-helper-box">
          <span>Need pre-seeded administrator credentials?</span>
          <button type="button" className="btn btn-outline btn-xs" onClick={fillDemoAdmin}>
            Autofill Default Admin
          </button>
        </div>
      </div>
    </div>
  );
}
