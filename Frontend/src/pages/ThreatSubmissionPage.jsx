import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import {
  PlusCircle,
  Shield,
  CheckCircle,
  AlertTriangle,
  Info,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function ThreatSubmissionPage() {
  const { isAuthenticated } = useAuth();

  const [formData, setFormData] = useState({
    indicatorType: 'IP',
    indicatorValue: '',
    category: 'Malware',
    severity: 'Medium',
    submissionType: 'Indicator',
    source: '',
    description: '',
  });

  const [existingSources, setExistingSources] = useState([]);
  const [useCustomSource, setUseCustomSource] = useState(false);
  const [customSourceName, setCustomSourceName] = useState('');
  const [formErrors, setFormErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(null);
  const [serverError, setServerError] = useState('');

  useEffect(() => {
    fetchSources();
  }, []);

  const fetchSources = async () => {
    try {
      const res = await api.get('/sources');
      if (res.data?.data) {
        setExistingSources(res.data.data);
        if (res.data.data.length > 0) {
          setFormData((prev) => ({ ...prev, source: res.data.data[0]._id }));
        }
      }
    } catch (_) {
      // Fallback
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (formErrors[name]) {
      setFormErrors((prev) => ({ ...prev, [name]: '' }));
    }
    setServerError('');
  };

  // Helper placeholder according to indicator type
  const getPlaceholder = () => {
    switch (formData.indicatorType) {
      case 'IP':
        return 'e.g. 198.51.100.42 or 2001:0db8::1';
      case 'Domain':
        return 'e.g. malicious-c2.darknet-command.com';
      case 'URL':
        return 'e.g. https://payload-delivery.org/beacon.exe';
      case 'Hash':
        return 'e.g. 64-char SHA-256 or 32-char MD5 hash';
      default:
        return 'Enter indicator string...';
    }
  };

  const validate = () => {
    const errors = {};

    if (!formData.indicatorValue.trim()) {
      errors.indicatorValue = 'Indicator value is required';
    }

    if (!formData.category.trim()) {
      errors.category = 'Threat category is required';
    }

    if (!formData.description.trim()) {
      errors.description = 'A detailed description is required';
    } else if (formData.description.trim().length < 10) {
      errors.description = 'Description must be at least 10 characters long';
    }

    if (useCustomSource) {
      if (!customSourceName.trim()) {
        errors.source = 'Please specify a source name';
      }
    } else {
      if (!formData.source) {
        errors.source = 'Please select or add a source';
      }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerError('');
    setSubmitSuccess(null);

    if (!isAuthenticated) {
      setServerError('You must be logged in as an analyst or administrator to submit threat indicators.');
      return;
    }

    if (!validate()) return;

    setIsSubmitting(true);

    try {
      const payload = {
        indicatorType: formData.indicatorType,
        indicatorValue: formData.indicatorValue.trim(),
        category: formData.category.trim(),
        severity: formData.severity,
        submissionType: formData.submissionType,
        source: useCustomSource ? customSourceName.trim() : formData.source,
        description: formData.description.trim(),
      };

      const res = await api.post('/threats', payload);

      setSubmitSuccess(res.data?.data);
      // Reset form fields
      setFormData((prev) => ({
        ...prev,
        indicatorValue: '',
        description: '',
      }));
      setCustomSourceName('');
    } catch (err) {
      setServerError(err.response?.data?.message || 'Failed to submit threat indicator.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="threat-submission-layout">
      {/* Informational Guidance Box */}
      <div className="guidance-banner">
        <div className="guidance-icon">
          <Info size={24} color="var(--color-blue-primary)" />
        </div>
        <div className="guidance-text">
          <h4>Peer-Vetted Threat Ingestion</h4>
          <p>
            All submitted indicators of compromise (IoCs), security advisories, and observations are queued
            with an initial status of <strong>Pending</strong>. An administrator must triage and verify your
            submission before it is published to the global intelligence explorer.
          </p>
        </div>
      </div>

      {/* Success Notification */}
      {submitSuccess && (
        <div className="alert alert-success" style={{ marginBottom: 'var(--spacing-lg)' }}>
          <CheckCircle size={22} />
          <div style={{ flex: 1 }}>
            <strong>Submission Queued Successfully!</strong>
            <p style={{ margin: '4px 0 0', fontSize: 'var(--font-size-sm)' }}>
              Indicator: <code>{submitSuccess.indicatorValue}</code> ({submitSuccess.indicatorType}) has been logged
              under Tracking ID: <code>{submitSuccess._id}</code>.
            </p>
          </div>
          <NavLink to="/activity" className="btn btn-outline btn-xs">
            View My Submissions <ArrowRight size={14} />
          </NavLink>
        </div>
      )}

      {/* Server Error Notification */}
      {serverError && (
        <div className="alert alert-danger" style={{ marginBottom: 'var(--spacing-lg)' }}>
          <AlertTriangle size={20} />
          <span>{serverError}</span>
        </div>
      )}

      {/* Submission Form Card */}
      <div className="card">
        <div className="card-header-clean">
          <h3 className="card-title">
            <PlusCircle size={20} color="var(--color-blue-primary)" />
            <span>Submit Intelligence Item</span>
          </h3>
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div className="form-grid-two">
            {/* 1. Indicator Type */}
            <div className="form-group">
              <label htmlFor="indicatorType" className="form-label">
                Indicator Type <span className="required-mark">*</span>
              </label>
              <select
                id="indicatorType"
                name="indicatorType"
                className="form-select"
                value={formData.indicatorType}
                onChange={handleInputChange}
              >
                <option value="IP">IP Address (IPv4 / IPv6)</option>
                <option value="Domain">Domain Name (FQDN)</option>
                <option value="URL">Full Web URL</option>
                <option value="Hash">Cryptographic Hash (SHA-256, MD5, SHA-1)</option>
              </select>
            </div>

            {/* 2. Submission Type */}
            <div className="form-group">
              <label htmlFor="submissionType" className="form-label">
                Submission Type <span className="required-mark">*</span>
              </label>
              <select
                id="submissionType"
                name="submissionType"
                className="form-select"
                value={formData.submissionType}
                onChange={handleInputChange}
              >
                <option value="Indicator">Indicator (Direct Technical IoC)</option>
                <option value="Advisory">Security Advisory (Contextual Campaign)</option>
                <option value="Observation">Field Observation (Unconfirmed Telemetry)</option>
              </select>
            </div>
          </div>

          {/* 3. Indicator Value */}
          <div className="form-group">
            <label htmlFor="indicatorValue" className="form-label">
              Indicator Value <span className="required-mark">*</span>
            </label>
            <input
              id="indicatorValue"
              type="text"
              name="indicatorValue"
              className={`form-input ${formErrors.indicatorValue ? 'input-error' : ''}`}
              placeholder={getPlaceholder()}
              value={formData.indicatorValue}
              onChange={handleInputChange}
            />
            {formErrors.indicatorValue && (
              <span className="field-error-text">{formErrors.indicatorValue}</span>
            )}
          </div>

          <div className="form-grid-two">
            {/* 4. Threat Category */}
            <div className="form-group">
              <label htmlFor="category" className="form-label">
                Category <span className="required-mark">*</span>
              </label>
              <select
                id="category"
                name="category"
                className={`form-select ${formErrors.category ? 'input-error' : ''}`}
                value={formData.category}
                onChange={handleInputChange}
              >
                <option value="Malware">Malware / Dropper</option>
                <option value="Ransomware">Ransomware C2</option>
                <option value="Phishing">Phishing & Credential Harvest</option>
                <option value="Botnet">Botnet Node</option>
                <option value="Exploit">Vulnerability Exploit</option>
                <option value="APT">Advanced Persistent Threat (APT)</option>
                <option value="Cryptominer">Unauthorized Cryptominer</option>
                <option value="Reconnaissance">Network Scanning / Recon</option>
              </select>
            </div>

            {/* 5. Severity */}
            <div className="form-group">
              <label htmlFor="severity" className="form-label">
                Severity Level <span className="required-mark">*</span>
              </label>
              <select
                id="severity"
                name="severity"
                className="form-select"
                value={formData.severity}
                onChange={handleInputChange}
              >
                <option value="Critical">Critical (Immediate danger, confirmed breach)</option>
                <option value="High">High (High risk of compromise)</option>
                <option value="Medium">Medium (Suspicious, medium risk)</option>
                <option value="Low">Low (Informational observation)</option>
              </select>
            </div>
          </div>

          {/* 6. Source Selection / Entry */}
          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label htmlFor="source" className="form-label">
                Intelligence Source <span className="required-mark">*</span>
              </label>
              <button
                type="button"
                className="text-btn"
                onClick={() => setUseCustomSource(!useCustomSource)}
              >
                {useCustomSource ? 'Select from registered sources' : '+ Enter custom source name'}
              </button>
            </div>

            {useCustomSource ? (
              <input
                type="text"
                className={`form-input ${formErrors.source ? 'input-error' : ''}`}
                placeholder="e.g. AlienVault OTX, Mandiant, US-CERT, Internal Telemetry"
                value={customSourceName}
                onChange={(e) => setCustomSourceName(e.target.value)}
              />
            ) : (
              <select
                id="source"
                name="source"
                className={`form-select ${formErrors.source ? 'input-error' : ''}`}
                value={formData.source}
                onChange={handleInputChange}
              >
                {existingSources.map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.name} {s.description ? `— ${s.description}` : ''}
                  </option>
                ))}
              </select>
            )}
            {formErrors.source && <span className="field-error-text">{formErrors.source}</span>}
          </div>

          {/* 7. Detailed Description */}
          <div className="form-group">
            <label htmlFor="description" className="form-label">
              Technical Description & Context <span className="required-mark">*</span>
            </label>
            <textarea
              id="description"
              name="description"
              rows={4}
              className={`form-textarea ${formErrors.description ? 'input-error' : ''}`}
              placeholder="Provide contextual details such as observed attack vectors, payload behavior, targeted industries, or sandbox execution logs..."
              value={formData.description}
              onChange={handleInputChange}
            ></textarea>
            {formErrors.description && (
              <span className="field-error-text">{formErrors.description}</span>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 'var(--spacing-lg)' }}>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSubmitting}
              style={{ minWidth: '180px' }}
            >
              {isSubmitting ? 'Validating & Submitting...' : 'Submit to Triage Queue'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
