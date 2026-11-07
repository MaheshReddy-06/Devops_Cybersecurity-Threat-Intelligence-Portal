import React, { useState, useEffect } from 'react';
import {
  History,
  FileText,
  Activity,
  CheckCircle,
  Clock,
  XCircle,
  RefreshCw,
  Eye,
  AlertCircle,
  Send,
} from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import Badge from '../components/Badge';
import Modal from '../components/Modal';

export default function ActivityHistoryPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('my-submissions'); // 'my-submissions' | 'audit-log'

  // Submissions state
  const [mySubmissions, setMySubmissions] = useState([]);
  const [subsLoading, setSubsLoading] = useState(true);
  const [selectedThreat, setSelectedThreat] = useState(null);

  // Activities state
  const [activities, setActivities] = useState([]);
  const [actsLoading, setActsLoading] = useState(true);

  useEffect(() => {
    if (activeTab === 'my-submissions') {
      fetchMySubmissions();
    } else {
      fetchActivities();
    }
  }, [activeTab]);

  const fetchMySubmissions = async () => {
    setSubsLoading(true);
    try {
      const res = await api.get('/threats/my-submissions');
      if (res.data?.data) {
        setMySubmissions(res.data.data);
      }
    } catch (err) {
      console.error('Failed to load my submissions', err);
    } finally {
      setSubsLoading(false);
    }
  };

  const fetchActivities = async () => {
    setActsLoading(true);
    try {
      const res = await api.get('/activities?limit=50');
      if (res.data?.data) {
        setActivities(res.data.data);
      }
    } catch (err) {
      console.error('Failed to load activity trail', err);
    } finally {
      setActsLoading(false);
    }
  };

  return (
    <div className="activity-page-layout">
      {/* Tab Switcher */}
      <div className="activity-nav-tabs">
        <button
          className={`tab-btn ${activeTab === 'my-submissions' ? 'active' : ''}`}
          onClick={() => setActiveTab('my-submissions')}
        >
          <FileText size={16} />
          <span>My Personal Submissions History</span>
        </button>

        <button
          className={`tab-btn ${activeTab === 'audit-log' ? 'active' : ''}`}
          onClick={() => setActiveTab('audit-log')}
        >
          <History size={16} />
          <span>Activity & Audit Trail</span>
        </button>
      </div>

      {/* TAB 1: PERSONAL SUBMISSION HISTORY */}
      {activeTab === 'my-submissions' && (
        <div className="card">
          <div className="card-header-clean">
            <div>
              <h3 className="card-title">My Ingested Threat Indicators</h3>
              <p className="card-subtitle">
                Track the live review status of your personal threat submissions.
              </p>
            </div>
            <button className="btn btn-outline btn-xs" onClick={fetchMySubmissions}>
              <RefreshCw size={14} /> Refresh
            </button>
          </div>

          {subsLoading ? (
            <div className="page-loading-state">
              <div className="spinner"></div>
              <p>Fetching your personal submission history...</p>
            </div>
          ) : mySubmissions.length === 0 ? (
            <div className="empty-state-box">
              <Send size={36} color="var(--color-text-muted)" />
              <h4>No Submissions Yet</h4>
              <p>You haven't submitted any indicators or advisories. Head over to the Submit Threat page.</p>
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
                    <th>Source</th>
                    <th>Status</th>
                    <th>Date Submitted</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {mySubmissions.map((t) => (
                    <tr key={t._id}>
                      <td>
                        <span className="mono-indicator-val">{t.indicatorValue}</span>
                      </td>
                      <td>
                        <span className="type-pill">{t.indicatorType}</span>
                      </td>
                      <td>{t.category}</td>
                      <td>
                        <Badge type="severity" value={t.severity} />
                      </td>
                      <td>{t.source?.name || 'Unattributed'}</td>
                      <td>
                        <Badge type="status" value={t.status} />
                      </td>
                      <td className="text-muted" style={{ fontSize: 'var(--font-size-xs)' }}>
                        {new Date(t.createdAt).toLocaleDateString()}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          className="btn btn-outline btn-xs"
                          onClick={() => setSelectedThreat(t)}
                          title="View submission details"
                        >
                          <Eye size={13} /> Details
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: AUDIT ACTIVITY LOG */}
      {activeTab === 'audit-log' && (
        <div className="card">
          <div className="card-header-clean">
            <div>
              <h3 className="card-title">Operational Audit Log</h3>
              <p className="card-subtitle">
                Immutable chronological ledger of submissions, triage decisions, and system updates.
              </p>
            </div>
            <button className="btn btn-outline btn-xs" onClick={fetchActivities}>
              <RefreshCw size={14} /> Refresh
            </button>
          </div>

          {actsLoading ? (
            <div className="page-loading-state">
              <div className="spinner"></div>
              <p>Loading audit ledger...</p>
            </div>
          ) : activities.length === 0 ? (
            <div className="empty-state-box">
              <Activity size={36} color="var(--color-text-muted)" />
              <h4>No Activity Recorded</h4>
              <p>System activities and analyst contributions will appear here.</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Action</th>
                    <th>Performed By</th>
                    <th>Description</th>
                    <th>Related Threat</th>
                  </tr>
                </thead>
                <tbody>
                  {activities.map((act) => (
                    <tr key={act._id}>
                      <td className="text-muted" style={{ fontSize: 'var(--font-size-xs)', whiteSpace: 'nowrap' }}>
                        {new Date(act.createdAt).toLocaleString()}
                      </td>
                      <td>
                        <span
                          className={`badge ${
                            act.action === 'APPROVE_THREAT'
                              ? 'badge-success'
                              : act.action === 'REJECT_THREAT'
                              ? 'badge-danger'
                              : 'badge-info'
                          }`}
                        >
                          {act.action}
                        </span>
                      </td>
                      <td style={{ fontWeight: 500 }}>
                        {act.user?.name || 'System'}
                        <span style={{ fontSize: '11px', color: 'var(--color-text-muted)', display: 'block' }}>
                          {act.user?.role}
                        </span>
                      </td>
                      <td style={{ fontSize: 'var(--font-size-sm)' }}>{act.description}</td>
                      <td>
                        {act.threat ? (
                          <span className="mono-indicator-val" style={{ maxWidth: '180px' }}>
                            {act.threat.indicatorValue}
                          </span>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Selected Threat Dossier Modal */}
      {selectedThreat && (
        <Modal
          isOpen={!!selectedThreat}
          onClose={() => setSelectedThreat(null)}
          title={`Submission Details — ${selectedThreat.indicatorValue}`}
          footer={
            <button className="btn btn-primary" onClick={() => setSelectedThreat(null)}>
              Close
            </button>
          }
        >
          <div className="threat-dossier-grid">
            <div className="dossier-row">
              <span className="dossier-label">Indicator Value:</span>
              <code className="dossier-value-code">{selectedThreat.indicatorValue}</code>
            </div>

            <div className="dossier-two-col">
              <div className="dossier-item">
                <span className="dossier-label">Indicator Type:</span>
                <span className="dossier-value">{selectedThreat.indicatorType}</span>
              </div>
              <div className="dossier-item">
                <span className="dossier-label">Classification:</span>
                <span className="dossier-value">{selectedThreat.submissionType}</span>
              </div>
            </div>

            <div className="dossier-two-col">
              <div className="dossier-item">
                <span className="dossier-label">Severity:</span>
                <Badge type="severity" value={selectedThreat.severity} />
              </div>
              <div className="dossier-item">
                <span className="dossier-label">Current Triage Status:</span>
                <Badge type="status" value={selectedThreat.status} />
              </div>
            </div>

            <div className="dossier-row">
              <span className="dossier-label">Description:</span>
              <p className="dossier-description-box">{selectedThreat.description}</p>
            </div>

            {selectedThreat.reviewComment && (
              <div className="dossier-row">
                <span className="dossier-label">Moderator Feedback:</span>
                <blockquote className="dossier-comment-box">{selectedThreat.reviewComment}</blockquote>
              </div>
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
