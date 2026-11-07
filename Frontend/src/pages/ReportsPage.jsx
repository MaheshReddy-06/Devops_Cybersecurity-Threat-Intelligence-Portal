import React, { useState, useEffect } from 'react';
import {
  FileBarChart,
  Download,
  Calendar,
  Filter,
  RefreshCw,
  Layers,
  Shield,
  Activity,
  Award,
  AlertCircle,
} from 'lucide-react';
import api from '../services/api';
import Badge from '../components/Badge';

export default function ReportsPage() {
  const [activeReport, setActiveReport] = useState('submissions'); // 'submissions' | 'indicators' | 'sources' | 'analysts'
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reportData, setReportData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    fetchReport();
  }, [activeReport]);

  const fetchReport = async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const res = await api.get(`/reports/${activeReport}?${params.toString()}`);
      if (res.data) {
        setReportData(res.data);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to generate report.');
    } finally {
      setLoading(false);
    }
  };

  const handleApplyFilter = (e) => {
    e.preventDefault();
    fetchReport();
  };

  const handleResetFilter = () => {
    setStartDate('');
    setEndDate('');
    setTimeout(fetchReport, 0);
  };

  const handleCsvExport = async () => {
    setIsExporting(true);
    try {
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      params.append('format', 'csv');

      const res = await api.get(`/reports/${activeReport}?${params.toString()}`, {
        responseType: 'blob',
      });

      // Create browser blob download link
      const blob = new Blob([res.data], { type: 'text/csv' });
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.setAttribute('download', `${activeReport}_report_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      alert('Failed to download CSV export. Please check connection.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="reports-layout">
      {/* Report Selection Tabs */}
      <div className="report-nav-tabs">
        <button
          className={`report-tab-btn ${activeReport === 'submissions' ? 'active' : ''}`}
          onClick={() => setActiveReport('submissions')}
        >
          <Layers size={16} />
          <span>1. Threat Submission Report</span>
        </button>

        <button
          className={`report-tab-btn ${activeReport === 'indicators' ? 'active' : ''}`}
          onClick={() => setActiveReport('indicators')}
        >
          <Shield size={16} />
          <span>2. Indicator Summary Report</span>
        </button>

        <button
          className={`report-tab-btn ${activeReport === 'sources' ? 'active' : ''}`}
          onClick={() => setActiveReport('sources')}
        >
          <Award size={16} />
          <span>3. Source Reliability Report</span>
        </button>

        <button
          className={`report-tab-btn ${activeReport === 'analysts' ? 'active' : ''}`}
          onClick={() => setActiveReport('analysts')}
        >
          <Activity size={16} />
          <span>4. Analyst Activity Report</span>
        </button>
      </div>

      {/* Date Filter & Export Bar */}
      <div className="card" style={{ marginBottom: 'var(--spacing-lg)' }}>
        <form onSubmit={handleApplyFilter} className="report-filter-bar">
          <div className="date-input-group">
            <label className="filter-label">From Date:</label>
            <input
              type="date"
              className="filter-select"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>

          <div className="date-input-group">
            <label className="filter-label">To Date:</label>
            <input
              type="date"
              className="filter-select"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>

          <div className="report-btn-group">
            <button type="submit" className="btn btn-primary btn-sm">
              <Filter size={14} /> Filter
            </button>
            <button type="button" className="btn btn-outline btn-sm" onClick={handleResetFilter}>
              Reset
            </button>
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={handleCsvExport}
              disabled={isExporting}
            >
              <Download size={14} /> {isExporting ? 'Exporting...' : 'Export to CSV'}
            </button>
          </div>
        </form>
      </div>

      {error && (
        <div className="alert alert-danger" style={{ marginBottom: 'var(--spacing-lg)' }}>
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="page-loading-state">
          <div className="spinner"></div>
          <p>Compiling dynamic report aggregations from database...</p>
        </div>
      ) : (
        <>
          {/* REPORT 1: THREAT SUBMISSION REPORT */}
          {activeReport === 'submissions' && reportData && (
            <div className="report-content-body">
              <div className="metrics-grid" style={{ marginBottom: 'var(--spacing-lg)' }}>
                <div className="stat-card primary">
                  <div className="stat-label">Total Submissions</div>
                  <div className="stat-value">{reportData.summary?.totalSubmissions || 0}</div>
                </div>
                <div className="stat-card success">
                  <div className="stat-label">Approved</div>
                  <div className="stat-value text-success">{reportData.summary?.statusBreakdown?.approved || 0}</div>
                </div>
                <div className="stat-card warning">
                  <div className="stat-label">Pending Triage</div>
                  <div className="stat-value text-warning">{reportData.summary?.statusBreakdown?.pending || 0}</div>
                </div>
                <div className="stat-card danger">
                  <div className="stat-label">Rejected</div>
                  <div className="stat-value text-danger">{reportData.summary?.statusBreakdown?.rejected || 0}</div>
                </div>
              </div>

              <div className="card">
                <div className="card-header-clean">
                  <h3 className="card-title">Submission Timeline & Items ({reportData.count || 0})</h3>
                </div>
                <div className="table-responsive">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Indicator Value</th>
                        <th>Type</th>
                        <th>Classification</th>
                        <th>Category</th>
                        <th>Severity</th>
                        <th>Source</th>
                        <th>Submitted By</th>
                        <th>Status</th>
                        <th>Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(reportData.data || []).map((row) => (
                        <tr key={row._id}>
                          <td>
                            <code className="mono-indicator-val">{row.indicatorValue}</code>
                          </td>
                          <td>
                            <span className="type-pill">{row.indicatorType}</span>
                          </td>
                          <td>{row.submissionType}</td>
                          <td>{row.category}</td>
                          <td>
                            <Badge type="severity" value={row.severity} />
                          </td>
                          <td>{row.source?.name || 'Unknown'}</td>
                          <td>{row.submittedBy?.name || 'Analyst'}</td>
                          <td>
                            <Badge type="status" value={row.status} />
                          </td>
                          <td className="text-muted">{new Date(row.createdAt).toLocaleDateString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* REPORT 2: INDICATOR SUMMARY REPORT */}
          {activeReport === 'indicators' && reportData && (
            <div className="report-content-body">
              <div className="metrics-grid" style={{ marginBottom: 'var(--spacing-lg)' }}>
                <div className="stat-card primary">
                  <div className="stat-label">Grand Total Indicators</div>
                  <div className="stat-value">{reportData.summary?.grandTotalIndicators || 0}</div>
                </div>
                <div className="stat-card success">
                  <div className="stat-label">Total Approved</div>
                  <div className="stat-value text-success">{reportData.summary?.totalApprovedIndicators || 0}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Unique Indicator Types</div>
                  <div className="stat-value">{reportData.summary?.totalUniqueIndicatorTypes || 0}</div>
                </div>
              </div>

              <div className="card">
                <div className="card-header-clean">
                  <h3 className="card-title">Indicator Categorization & Approval Ratios</h3>
                </div>
                <div className="table-responsive">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Indicator Type</th>
                        <th>Total Tracked</th>
                        <th>Approved</th>
                        <th>Pending</th>
                        <th>Rejected</th>
                        <th>Critical</th>
                        <th>High</th>
                        <th>Medium</th>
                        <th>Approval Ratio (%)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(reportData.data || []).map((row) => (
                        <tr key={row.indicatorType}>
                          <td>
                            <span className="type-pill" style={{ fontWeight: 600 }}>
                              {row.indicatorType}
                            </span>
                          </td>
                          <td style={{ fontWeight: 600 }}>{row.total}</td>
                          <td className="text-success">{row.approved}</td>
                          <td className="text-warning">{row.pending}</td>
                          <td className="text-danger">{row.rejected}</td>
                          <td>{row.critical}</td>
                          <td>{row.high}</td>
                          <td>{row.medium}</td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <div
                                style={{
                                  width: '60px',
                                  height: '8px',
                                  backgroundColor: 'var(--color-bg-subtle)',
                                  borderRadius: '4px',
                                  overflow: 'hidden',
                                }}
                              >
                                <div
                                  style={{
                                    width: `${row.approvalRatePercent}%`,
                                    height: '100%',
                                    backgroundColor: 'var(--color-blue-primary)',
                                  }}
                                ></div>
                              </div>
                              <span>{row.approvalRatePercent}%</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* REPORT 3: SOURCE RELIABILITY REPORT */}
          {activeReport === 'sources' && reportData && (
            <div className="report-content-body">
              <div className="metrics-grid" style={{ marginBottom: 'var(--spacing-lg)' }}>
                <div className="stat-card primary">
                  <div className="stat-label">Evaluated Sources</div>
                  <div className="stat-value">{reportData.summary?.totalSourcesEvaluated || 0}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Submissions Evaluated</div>
                  <div className="stat-value">{reportData.summary?.totalSubmissionsEvaluated || 0}</div>
                </div>
                <div className="stat-card success">
                  <div className="stat-label">Overall Approved</div>
                  <div className="stat-value text-success">{reportData.summary?.overallApproved || 0}</div>
                </div>
                <div className="stat-card danger">
                  <div className="stat-label">Overall Rejected</div>
                  <div className="stat-value text-danger">{reportData.summary?.overallRejected || 0}</div>
                </div>
              </div>

              <div className="card">
                <div className="card-header-clean">
                  <h3 className="card-title">Intelligence Source Precision & Reliability Index</h3>
                </div>
                <div className="table-responsive">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Source Entity</th>
                        <th>Total Submissions</th>
                        <th>Approved</th>
                        <th>Rejected</th>
                        <th>Pending</th>
                        <th>Approval Rate</th>
                        <th>Rejection Rate</th>
                        <th>Reliability Rating</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(reportData.data || []).map((row) => (
                        <tr key={row.sourceId}>
                          <td style={{ fontWeight: 600 }}>{row.sourceName}</td>
                          <td>{row.totalSubmissions}</td>
                          <td className="text-success">{row.approvedCount}</td>
                          <td className="text-danger">{row.rejectedCount}</td>
                          <td className="text-warning">{row.pendingCount}</td>
                          <td style={{ fontWeight: 600 }}>{row.approvalRatePercent}%</td>
                          <td className="text-muted">{row.rejectionRatePercent}%</td>
                          <td>
                            <span
                              className={`badge ${
                                row.reliabilityRating.includes('High')
                                  ? 'badge-success'
                                  : row.reliabilityRating.includes('Moderate')
                                  ? 'badge-info'
                                  : row.reliabilityRating.includes('Low')
                                  ? 'badge-danger'
                                  : 'badge-warning'
                              }`}
                            >
                              {row.reliabilityRating}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* REPORT 4: ANALYST ACTIVITY REPORT */}
          {activeReport === 'analysts' && reportData && (
            <div className="report-content-body">
              <div className="metrics-grid" style={{ marginBottom: 'var(--spacing-lg)' }}>
                <div className="stat-card primary">
                  <div className="stat-label">Active Analysts</div>
                  <div className="stat-value">{reportData.summary?.totalAnalystsTracked || 0}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Total System Actions</div>
                  <div className="stat-value">{reportData.summary?.totalSystemActions || 0}</div>
                </div>
                <div className="stat-card success">
                  <div className="stat-label">Submissions Logged</div>
                  <div className="stat-value text-success">{reportData.summary?.totalSubmissionsLogged || 0}</div>
                </div>
              </div>

              <div className="card">
                <div className="card-header-clean">
                  <h3 className="card-title">Security Personnel Contributions & Audit Actions</h3>
                </div>
                <div className="table-responsive">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Analyst Name</th>
                        <th>Email</th>
                        <th>Role</th>
                        <th>Total Actions</th>
                        <th>Submissions Logged</th>
                        <th>Approvals Given</th>
                        <th>Rejections Given</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(reportData.data || []).map((row) => (
                        <tr key={row.userId}>
                          <td style={{ fontWeight: 600 }}>{row.name}</td>
                          <td className="text-muted">{row.email}</td>
                          <td>
                            <Badge type="role" value={row.role} />
                          </td>
                          <td style={{ fontWeight: 600 }}>{row.totalActions}</td>
                          <td className="text-success">{row.submissionsLogged}</td>
                          <td className="text-info">{row.approvalsLogged}</td>
                          <td className="text-danger">{row.rejectionsLogged}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
