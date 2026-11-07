import React, { useState, useEffect } from 'react';
import {
  Search,
  Filter,
  Eye,
  RefreshCw,
  Database,
  Calendar,
  Layers,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';
import api from '../services/api';
import Badge from '../components/Badge';
import Modal from '../components/Modal';

export default function ThreatExplorerPage() {
  const [threats, setThreats] = useState([]);
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedThreat, setSelectedThreat] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Filters state
  const [searchTerm, setSearchTerm] = useState('');
  const [indicatorType, setIndicatorType] = useState('');
  const [severity, setSeverity] = useState('');
  const [source, setSource] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    fetchSources();
  }, []);

  useEffect(() => {
    fetchThreats();
  }, [indicatorType, severity, source, startDate, endDate, page]);

  const fetchSources = async () => {
    try {
      const res = await api.get('/sources');
      if (res.data?.data) {
        setSources(res.data.data);
      }
    } catch (_) {}
  };

  const fetchThreats = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchTerm.trim()) params.append('search', searchTerm.trim());
      if (indicatorType) params.append('indicatorType', indicatorType);
      if (severity) params.append('severity', severity);
      if (source) params.append('source', source);
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      params.append('page', page);
      params.append('limit', 10);

      const res = await api.get(`/threats?${params.toString()}`);
      if (res.data) {
        setThreats(res.data.data || []);
        setTotalPages(res.data.totalPages || 1);
        setTotalCount(res.data.totalCount || 0);
      }
    } catch (err) {
      console.error('Failed to fetch threats', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    fetchThreats();
  };

  const resetFilters = () => {
    setSearchTerm('');
    setIndicatorType('');
    setSeverity('');
    setSource('');
    setStartDate('');
    setEndDate('');
    setPage(1);
  };

  const openDetailsModal = (threat) => {
    setSelectedThreat(threat);
    setIsModalOpen(true);
  };

  return (
    <div className="explorer-layout">
      {/* Search & Filter Toolbar */}
      <div className="card" style={{ marginBottom: 'var(--spacing-lg)' }}>
        <form onSubmit={handleSearchSubmit} className="search-bar-row">
          <div className="search-input-wrapper">
            <Search size={18} className="search-icon" />
            <input
              type="text"
              className="search-input"
              placeholder="Search by IP, Domain, Hash, CVE, or Category keyword..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button type="submit" className="btn btn-primary">
            Search
          </button>
          <button type="button" className="btn btn-outline" onClick={resetFilters}>
            Reset
          </button>
        </form>

        {/* Multi-parameter Filters */}
        <div className="filter-controls-row">
          {/* Type Filter */}
          <div className="filter-item">
            <label className="filter-label">Indicator Type</label>
            <select
              className="filter-select"
              value={indicatorType}
              onChange={(e) => {
                setIndicatorType(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All Types</option>
              <option value="IP">IP Address</option>
              <option value="Domain">Domain Name</option>
              <option value="URL">Web URL</option>
              <option value="Hash">File Hash</option>
            </select>
          </div>

          {/* Severity Filter */}
          <div className="filter-item">
            <label className="filter-label">Severity Level</label>
            <select
              className="filter-select"
              value={severity}
              onChange={(e) => {
                setSeverity(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All Severities</option>
              <option value="Critical">Critical</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
          </div>

          {/* Source Filter */}
          <div className="filter-item">
            <label className="filter-label">Intelligence Source</label>
            <select
              className="filter-select"
              value={source}
              onChange={(e) => {
                setSource(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All Sources</option>
              {sources.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Date Filter: From */}
          <div className="filter-item">
            <label className="filter-label">From Date</label>
            <input
              type="date"
              className="filter-select"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                setPage(1);
              }}
            />
          </div>

          {/* Date Filter: To */}
          <div className="filter-item">
            <label className="filter-label">To Date</label>
            <input
              type="date"
              className="filter-select"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                setPage(1);
              }}
            />
          </div>
        </div>
      </div>

      {/* Threats Table Card */}
      <div className="card">
        <div className="card-header-clean">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Database size={20} color="var(--color-blue-primary)" />
            <h3 className="card-title">Approved Intelligence Feed</h3>
            <span className="badge badge-info" style={{ marginLeft: '8px' }}>
              {totalCount} Total
            </span>
          </div>
          <button className="btn btn-outline btn-xs" onClick={fetchThreats}>
            <RefreshCw size={14} /> Refresh
          </button>
        </div>

        {loading ? (
          <div className="page-loading-state">
            <div className="spinner"></div>
            <p>Querying threat intelligence database...</p>
          </div>
        ) : threats.length === 0 ? (
          <div className="empty-state-box">
            <AlertCircle size={36} color="var(--color-text-muted)" />
            <h4>No Threat Indicators Found</h4>
            <p>Try adjusting your search keywords, severity filters, or date range.</p>
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
                  <th>Submitted</th>
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
                    <td>{t.source?.name || 'Unknown'}</td>
                    <td>
                      <Badge type="status" value={t.status} />
                    </td>
                    <td className="text-muted" style={{ fontSize: 'var(--font-size-xs)' }}>
                      {new Date(t.createdAt).toLocaleDateString()}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button
                        className="btn btn-outline btn-xs"
                        onClick={() => openDetailsModal(t)}
                        title="Inspect full technical details"
                      >
                        <Eye size={14} /> Inspect
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
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

      {/* Threat Detail Modal */}
      {selectedThreat && (
        <Modal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          title={`Threat Intelligence Dossier — ${selectedThreat.indicatorType}`}
          footer={
            <button className="btn btn-primary" onClick={() => setIsModalOpen(false)}>
              Done
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
                <span className="dossier-label">Type:</span>
                <span className="dossier-value">{selectedThreat.indicatorType}</span>
              </div>
              <div className="dossier-item">
                <span className="dossier-label">Submission Classification:</span>
                <span className="dossier-value">{selectedThreat.submissionType}</span>
              </div>
            </div>

            <div className="dossier-two-col">
              <div className="dossier-item">
                <span className="dossier-label">Category:</span>
                <span className="dossier-value">{selectedThreat.category}</span>
              </div>
              <div className="dossier-item">
                <span className="dossier-label">Severity Level:</span>
                <Badge type="severity" value={selectedThreat.severity} />
              </div>
            </div>

            <div className="dossier-two-col">
              <div className="dossier-item">
                <span className="dossier-label">Triage Status:</span>
                <Badge type="status" value={selectedThreat.status} />
              </div>
              <div className="dossier-item">
                <span className="dossier-label">Intelligence Source:</span>
                <span className="dossier-value">{selectedThreat.source?.name || 'Unattributed'}</span>
              </div>
            </div>

            <div className="dossier-row">
              <span className="dossier-label">Technical Description:</span>
              <p className="dossier-description-box">{selectedThreat.description}</p>
            </div>

            {selectedThreat.reviewComment && (
              <div className="dossier-row">
                <span className="dossier-label">Moderation Review Comment:</span>
                <blockquote className="dossier-comment-box">{selectedThreat.reviewComment}</blockquote>
              </div>
            )}

            <div className="dossier-meta-footer">
              <span>Submitted by: {selectedThreat.submittedBy?.name || 'Analyst'}</span>
              <span>Logged: {new Date(selectedThreat.createdAt).toLocaleString()}</span>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
