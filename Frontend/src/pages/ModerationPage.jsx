import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Eye,
  MessageSquare,
  ShieldAlert,
} from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import Badge from '../components/Badge';
import Modal from '../components/Modal';

export default function ModerationPage() {
  const { user, isAdmin, isModerator } = useAuth();
  const canModerate = isAdmin || isModerator;

  const [activeTab, setActiveTab] = useState('pending'); // 'pending' | 'reviewed'
  const [threats, setThreats] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Inspection modal
  const [inspectThreat, setInspectThreat] = useState(null);

  // Decision action modal
  const [decisionModal, setDecisionModal] = useState({
    isOpen: false,
    threat: null,
    action: 'approve', // 'approve' | 'reject'
    comment: '',
    isSubmitting: false,
    error: '',
  });

  const [feedback, setFeedback] = useState({ type: '', message: '' });

  useEffect(() => {
    if (canModerate) {
      fetchThreats();
    } else {
      setLoading(false);
    }
  }, [activeTab, page, canModerate]);

  const fetchThreats = async () => {
    setLoading(true);
    setFeedback({ type: '', message: '' });
    try {
      const endpoint = activeTab === 'pending' ? '/admin/pending' : '/admin/reviewed';
      const res = await api.get(`${endpoint}?page=${page}&limit=10`);
      if (res.data) {
        setThreats(res.data.data || []);
        setTotalCount(res.data.totalCount || 0);
        setTotalPages(res.data.totalPages || 1);
      }
    } catch (err) {
      console.error('Failed to load moderation queue', err);
      setFeedback({
        type: 'danger',
        message: err.response?.data?.message || 'Failed to connect to moderation API.',
      });
    } finally {
      setLoading(false);
    }
  };

  const openDecisionDialog = (threat, action) => {
    setDecisionModal({
      isOpen: true,
      threat,
      action,
      comment: action === 'approve' ? 'Verified against threat intelligence feeds. Approved.' : '',
      isSubmitting: false,
      error: '',
    });
  };

  const handleDecisionSubmit = async () => {
    const { threat, action, comment } = decisionModal;
    if (!threat) return;

    if (action === 'reject' && !comment.trim()) {
      setDecisionModal((prev) => ({
        ...prev,
        error: 'Please provide a justification comment explaining the rejection reason.',
      }));
      return;
    }

    setDecisionModal((prev) => ({ ...prev, isSubmitting: true, error: '' }));

    try {
      const url = `/admin/threats/${threat._id}/${action}`;
      await api.put(url, { reviewComment: comment.trim() });

      setFeedback({
        type: 'success',
        message: `Threat indicator '${threat.indicatorValue}' successfully ${action === 'approve' ? 'approved and published' : 'rejected'
          }.`,
      });

      setDecisionModal({
        isOpen: false,
        threat: null,
        action: 'approve',
        comment: '',
        isSubmitting: false,
        error: '',
      });

      fetchThreats();
    } catch (err) {
      setDecisionModal((prev) => ({
        ...prev,
        isSubmitting: false,
        error: err.response?.data?.message || `Failed to ${action} threat.`,
      }));
    }
  };

  // Role Gate: Explain Admin requirement
  if (!canModerate) {
    return (
      <div className="moderation-guard-card">
        <div className="guard-icon">
          <ShieldAlert size={48} color="var(--color-threat-high)" />
        </div>
        <h2>Moderator or Administrator Role Required</h2>
        <p>
          The Review and Moderation console is reserved for authorized
          security moderators and administrators. Threat analysts can
          submit indicators and explore published intelligence, but
          cannot review or moderate submissions.
        </p>
        <div className="guard-account-box">
          <p>
            Logged in as: <strong>{user?.name || 'Guest'}</strong> (Role:{' '}
            <span style={{ textTransform: 'capitalize' }}>{user?.role || 'None'}</span>)
          </p>
          <p style={{ marginTop: '8px', fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)' }}>
            To test administrator capabilities, sign in using the default pre-seeded admin account:{' '}
            <code>admin@portal.local</code>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="moderation-layout">
      {/* Header Banner */}
      <div className="moderation-header-banner">
        <div>
          <h2>Security Triage & Moderation Queue</h2>
          <p>Review incoming peer-submitted indicators of compromise, false-positive reports, and advisories.</p>
        </div>
        <button className="btn btn-outline btn-xs" onClick={fetchThreats}>
          <RefreshCw size={14} /> Refresh Queue
        </button>
      </div>

      {/* Feedback Alert */}
      {feedback.message && (
        <div className={`alert alert-${feedback.type}`} style={{ marginBottom: 'var(--spacing-md)' }}>
          {feedback.type === 'success' ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
          <span>{feedback.message}</span>
        </div>
      )}

      {/* Moderation Navigation Tabs */}
      <div className="moderation-nav-tabs">
        <button
          className={`tab-btn ${activeTab === 'pending' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('pending');
            setPage(1);
          }}
        >
          <Clock size={16} />
          <span>Pending Submissions Queue</span>
          {activeTab === 'pending' && <span className="tab-count-pill">{totalCount}</span>}
        </button>

        <button
          className={`tab-btn ${activeTab === 'reviewed' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('reviewed');
            setPage(1);
          }}
        >
          <CheckCircle size={16} />
          <span>Previously Reviewed History</span>
          {activeTab === 'reviewed' && <span className="tab-count-pill">{totalCount}</span>}
        </button>
      </div>

      {/* Main Content Table Card */}
      <div className="card">
        {loading ? (
          <div className="page-loading-state">
            <div className="spinner"></div>
            <p>Loading moderation submissions...</p>
          </div>
        ) : threats.length === 0 ? (
          <div className="empty-state-box">
            <CheckCircle size={40} color="var(--color-threat-low)" />
            <h4>
              {activeTab === 'pending'
                ? 'All Caught Up! No Submissions Awaiting Review'
                : 'No Moderated Threats on Record'}
            </h4>
            <p>
              {activeTab === 'pending'
                ? 'Any newly submitted indicators or advisories from analysts will appear here.'
                : 'Processed submissions will be tracked in this audit archive.'}
            </p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Indicator Value</th>
                  <th>Type</th>
                  <th>Category</th>
                  <th>Severity</th>
                  <th>Submitted By</th>
                  <th>Source</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {threats.map((t) => (
                  <tr key={t._id}>
                    <td>
                      <span className="mono-indicator-val" title={t.indicatorValue}>
                        {t.indicatorValue}
                      </span>
                    </td>
                    <td>
                      <span className="type-pill">{t.indicatorType}</span>
                    </td>
                    <td>{t.category}</td>
                    <td>
                      <Badge type="severity" value={t.severity} />
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontWeight: 500 }}>{t.submittedBy?.name || 'Analyst'}</span>
                        <span style={{ fontSize: '11px', color: 'var(--color-text-muted)' }}>
                          {t.submittedBy?.email}
                        </span>
                      </div>
                    </td>
                    <td>{t.source?.name || 'Unattributed'}</td>
                    <td>
                      <Badge type="status" value={t.status} />
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div className="table-action-btns">
                        <button
                          className="btn btn-outline btn-xs"
                          onClick={() => setInspectThreat(t)}
                          title="Inspect full submission dossier"
                        >
                          <Eye size={13} /> View
                        </button>

                        {activeTab === 'pending' && (
                          <>
                            <button
                              className="btn btn-success btn-xs"
                              onClick={() => openDecisionDialog(t, 'approve')}
                              title="Approve and publish"
                            >
                              <CheckCircle size={13} /> Approve
                            </button>
                            <button
                              className="btn btn-danger btn-xs"
                              onClick={() => openDecisionDialog(t, 'reject')}
                              title="Reject submission"
                            >
                              <XCircle size={13} /> Reject
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="pagination-bar">
            <button
              className="btn btn-outline btn-xs"
              disabled={page <= 1}
              onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            >
              Previous
            </button>
            <span className="page-indicator">
              Page {page} of {totalPages}
            </span>
            <button
              className="btn btn-outline btn-xs"
              disabled={page >= totalPages}
              onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
            >
              Next
            </button>
          </div>
        )}
      </div>

      {/* Inspection Modal */}
      {inspectThreat && (
        <Modal
          isOpen={!!inspectThreat}
          onClose={() => setInspectThreat(null)}
          title={`Submission Inspection — ${inspectThreat.indicatorValue}`}
          footer={
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', width: '100%' }}>
              <button className="btn btn-outline" onClick={() => setInspectThreat(null)}>
                Close
              </button>
              {inspectThreat.status === 'Pending' && (
                <>
                  <button
                    className="btn btn-danger"
                    onClick={() => {
                      const t = inspectThreat;
                      setInspectThreat(null);
                      openDecisionDialog(t, 'reject');
                    }}
                  >
                    Reject
                  </button>
                  <button
                    className="btn btn-success"
                    onClick={() => {
                      const t = inspectThreat;
                      setInspectThreat(null);
                      openDecisionDialog(t, 'approve');
                    }}
                  >
                    Approve & Publish
                  </button>
                </>
              )}
            </div>
          }
        >
          <div className="threat-dossier-grid">
            <div className="dossier-row">
              <span className="dossier-label">Indicator Value:</span>
              <code className="dossier-value-code">{inspectThreat.indicatorValue}</code>
            </div>

            <div className="dossier-two-col">
              <div className="dossier-item">
                <span className="dossier-label">Indicator Type:</span>
                <span className="dossier-value">{inspectThreat.indicatorType}</span>
              </div>
              <div className="dossier-item">
                <span className="dossier-label">Submission Classification:</span>
                <span className="dossier-value">{inspectThreat.submissionType}</span>
              </div>
            </div>

            <div className="dossier-two-col">
              <div className="dossier-item">
                <span className="dossier-label">Category:</span>
                <span className="dossier-value">{inspectThreat.category}</span>
              </div>
              <div className="dossier-item">
                <span className="dossier-label">Severity Level:</span>
                <Badge type="severity" value={inspectThreat.severity} />
              </div>
            </div>

            <div className="dossier-row">
              <span className="dossier-label">Technical Description:</span>
              <p className="dossier-description-box">{inspectThreat.description}</p>
            </div>

            {inspectThreat.reviewComment && (
              <div className="dossier-row">
                <span className="dossier-label">Moderation Review Comment:</span>
                <blockquote className="dossier-comment-box">{inspectThreat.reviewComment}</blockquote>
              </div>
            )}

            <div className="dossier-meta-footer">
              <span>Submitted by: {inspectThreat.submittedBy?.name || 'Analyst'}</span>
              <span>Logged: {new Date(inspectThreat.createdAt).toLocaleString()}</span>
            </div>
          </div>
        </Modal>
      )}

      {/* Decision Comment Modal */}
      {decisionModal.isOpen && (
        <Modal
          isOpen={decisionModal.isOpen}
          onClose={() => setDecisionModal((prev) => ({ ...prev, isOpen: false }))}
          title={
            decisionModal.action === 'approve'
              ? 'Approve Threat Submission'
              : 'Reject Threat Submission'
          }
          footer={
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', width: '100%' }}>
              <button
                className="btn btn-outline"
                onClick={() => setDecisionModal((prev) => ({ ...prev, isOpen: false }))}
                disabled={decisionModal.isSubmitting}
              >
                Cancel
              </button>
              <button
                className={`btn ${decisionModal.action === 'approve' ? 'btn-success' : 'btn-danger'}`}
                onClick={handleDecisionSubmit}
                disabled={decisionModal.isSubmitting}
              >
                {decisionModal.isSubmitting
                  ? 'Processing...'
                  : decisionModal.action === 'approve'
                    ? 'Confirm Approval'
                    : 'Confirm Rejection'}
              </button>
            </div>
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
            <p>
              Target Indicator: <code>{decisionModal.threat?.indicatorValue}</code> (
              {decisionModal.threat?.indicatorType})
            </p>

            {decisionModal.error && (
              <div className="alert alert-danger">
                <AlertTriangle size={16} />
                <span>{decisionModal.error}</span>
              </div>
            )}

            <div className="form-group">
              <label htmlFor="moderationComment" className="form-label">
                {decisionModal.action === 'approve'
                  ? 'Reviewer Verification Notes'
                  : 'Reason for Rejection (Required)'}
              </label>
              <textarea
                id="moderationComment"
                rows={3}
                className="form-textarea"
                placeholder={
                  decisionModal.action === 'approve'
                    ? 'e.g. Verified with VirusTotal telemetry and confirmed active C2.'
                    : 'e.g. False positive: IP address belongs to verified CDN provider.'
                }
                value={decisionModal.comment}
                onChange={(e) =>
                  setDecisionModal((prev) => ({ ...prev, comment: e.target.value, error: '' }))
                }
              ></textarea>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
