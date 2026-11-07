import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import {
  Shield,
  AlertTriangle,
  Clock,
  CheckCircle,
  XCircle,
  Database,
  ArrowRight,
  TrendingUp,
  Activity,
  Layers,
  Search,
} from 'lucide-react';
import api from '../services/api';
import Badge from '../components/Badge';

export default function DashboardPage() {
  const [stats, setStats] = useState(null);
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    setError('');
    try {
      const [statsRes, actRes] = await Promise.all([
        api.get('/dashboard/stats').catch(() => ({ data: { data: null } })),
        api.get('/activities?limit=5').catch(() => ({ data: { data: [] } })),
      ]);

      if (statsRes.data?.data) {
        setStats(statsRes.data.data);
      }
      if (actRes.data?.data) {
        setActivities(actRes.data.data);
      }
    } catch (err) {
      setError('Failed to connect with backend analytics feed.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="page-loading-state">
        <div className="spinner"></div>
        <p>Loading real-time threat intelligence metrics...</p>
      </div>
    );
  }

  const summary = stats?.summary || { totalSubmissions: 0, totalApproved: 0, totalPending: 0, totalRejected: 0 };
  const severity = stats?.severityBreakdown || { criticalThreats: 0, highThreats: 0, mediumThreats: 0, lowThreats: 0 };
  const dist = stats?.indicatorTypeDistribution || { IP: 0, Domain: 0, URL: 0, Hash: 0 };
  const totalIndicators = (dist.IP || 0) + (dist.Domain || 0) + (dist.URL || 0) + (dist.Hash || 0) || 1;

  return (
    <div className="dashboard-content-layout">
      {error && (
        <div className="alert alert-danger" style={{ marginBottom: 'var(--spacing-lg)' }}>
          <AlertTriangle size={18} />
          <span>{error} (Ensure backend server is running on port 5000)</span>
        </div>
      )}

      {/* Row 1: Primary Intelligence Metrics */}
      <section className="metrics-grid">
        <div className="stat-card primary">
          <div className="stat-card-header">
            <span className="stat-label">Total Submissions</span>
            <div className="stat-icon-pill blue">
              <Database size={20} />
            </div>
          </div>
          <div className="stat-value">{summary.totalSubmissions}</div>
          <div className="stat-footer text-muted">All tracked Indicators of Compromise</div>
        </div>

        <div className="stat-card success">
          <div className="stat-card-header">
            <span className="stat-label">Approved Threats</span>
            <div className="stat-icon-pill green">
              <CheckCircle size={20} />
            </div>
          </div>
          <div className="stat-value text-success">{summary.totalApproved}</div>
          <div className="stat-footer text-muted">Published to global threat feed</div>
        </div>

        <div className="stat-card warning">
          <div className="stat-card-header">
            <span className="stat-label">Pending Triage</span>
            <div className="stat-icon-pill amber">
              <Clock size={20} />
            </div>
          </div>
          <div className="stat-value text-warning">{summary.totalPending}</div>
          <div className="stat-footer text-muted">Awaiting security analyst review</div>
        </div>

        <div className="stat-card danger">
          <div className="stat-card-header">
            <span className="stat-label">Rejected / False Positives</span>
            <div className="stat-icon-pill red">
              <XCircle size={20} />
            </div>
          </div>
          <div className="stat-value text-danger">{summary.totalRejected}</div>
          <div className="stat-footer text-muted">Filtered out during verification</div>
        </div>
      </section>

      {/* Row 2: Severity Distribution Cards */}
      <section className="section-block">
        <h2 className="section-title">
          <AlertTriangle size={20} color="var(--color-blue-primary)" />
          <span>Severity Stratification</span>
        </h2>
        <div className="severity-grid">
          <div className="severity-card critical">
            <div className="severity-top">
              <span className="severity-badge-indicator critical"></span>
              <span className="severity-title">Critical Severity</span>
            </div>
            <div className="severity-count">{severity.criticalThreats}</div>
            <div className="severity-desc">Immediate incident response required</div>
          </div>

          <div className="severity-card high">
            <div className="severity-top">
              <span className="severity-badge-indicator high"></span>
              <span className="severity-title">High Severity</span>
            </div>
            <div className="severity-count">{severity.highThreats}</div>
            <div className="severity-desc">Active exploit or malicious payload</div>
          </div>

          <div className="severity-card medium">
            <div className="severity-top">
              <span className="severity-badge-indicator medium"></span>
              <span className="severity-title">Medium Severity</span>
            </div>
            <div className="severity-count">{severity.mediumThreats}</div>
            <div className="severity-desc">Suspicious network activity or spam</div>
          </div>

          <div className="severity-card low">
            <div className="severity-top">
              <span className="severity-badge-indicator low"></span>
              <span className="severity-title">Low Severity</span>
            </div>
            <div className="severity-count">{severity.lowThreats}</div>
            <div className="severity-desc">Informational observation or recon</div>
          </div>
        </div>
      </section>

      {/* Row 3: Threat Distribution Chart & Recent Activity */}
      <div className="dashboard-two-col">
        {/* Threat Distribution Chart (CSS/SVG bar visualization) */}
        <div className="card">
          <div className="card-header-clean">
            <h3 className="card-title">
              <Layers size={18} />
              <span>Distribution by Indicator Type</span>
            </h3>
            <NavLink to="/explorer" className="card-action-link">
              Explorer <ArrowRight size={14} />
            </NavLink>
          </div>

          <div className="distribution-bars-container">
            {/* IP Address */}
            <div className="dist-bar-item">
              <div className="dist-label-row">
                <span className="dist-name">IP Addresses</span>
                <span className="dist-val">
                  {dist.IP} ({Math.round(((dist.IP || 0) / totalIndicators) * 100)}%)
                </span>
              </div>
              <div className="progress-track">
                <div
                  className="progress-fill fill-blue"
                  style={{ width: `${((dist.IP || 0) / totalIndicators) * 100}%` }}
                ></div>
              </div>
            </div>

            {/* Domains */}
            <div className="dist-bar-item">
              <div className="dist-label-row">
                <span className="dist-name">Domain Names</span>
                <span className="dist-val">
                  {dist.Domain} ({Math.round(((dist.Domain || 0) / totalIndicators) * 100)}%)
                </span>
              </div>
              <div className="progress-track">
                <div
                  className="progress-fill fill-cyan"
                  style={{ width: `${((dist.Domain || 0) / totalIndicators) * 100}%` }}
                ></div>
              </div>
            </div>

            {/* URLs */}
            <div className="dist-bar-item">
              <div className="dist-label-row">
                <span className="dist-name">Malicious URLs</span>
                <span className="dist-val">
                  {dist.URL} ({Math.round(((dist.URL || 0) / totalIndicators) * 100)}%)
                </span>
              </div>
              <div className="progress-track">
                <div
                  className="progress-fill fill-amber"
                  style={{ width: `${((dist.URL || 0) / totalIndicators) * 100}%` }}
                ></div>
              </div>
            </div>

            {/* File Hashes */}
            <div className="dist-bar-item">
              <div className="dist-label-row">
                <span className="dist-name">Cryptographic Hashes</span>
                <span className="dist-val">
                  {dist.Hash} ({Math.round(((dist.Hash || 0) / totalIndicators) * 100)}%)
                </span>
              </div>
              <div className="progress-track">
                <div
                  className="progress-fill fill-purple"
                  style={{ width: `${((dist.Hash || 0) / totalIndicators) * 100}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Audit Activities */}
        <div className="card">
          <div className="card-header-clean">
            <h3 className="card-title">
              <Activity size={18} />
              <span>Recent Operational Activity</span>
            </h3>
            <NavLink to="/activity" className="card-action-link">
              View All <ArrowRight size={14} />
            </NavLink>
          </div>

          <div className="activity-timeline-feed">
            {activities.length === 0 ? (
              <p className="empty-state-text">No logged activity records yet.</p>
            ) : (
              activities.map((act) => (
                <div key={act._id} className="timeline-entry">
                  <div className="timeline-marker"></div>
                  <div className="timeline-content">
                    <div className="timeline-title-row">
                      <span className="timeline-action-badge">{act.action}</span>
                      <span className="timeline-time">
                        {new Date(act.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="timeline-desc">{act.description}</p>
                    <span className="timeline-user">By: {act.user?.name || 'Analyst'}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
