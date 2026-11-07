import React from 'react';

/**
 * Reusable Badge component for Threat Severity, Status, and Indicator Type.
 */
export default function Badge({ type, value }) {
  if (!value) return null;

  let className = 'badge ';

  if (type === 'severity') {
    switch (value.toLowerCase()) {
      case 'critical':
        className += 'badge-critical';
        break;
      case 'high':
        className += 'badge-high';
        break;
      case 'medium':
        className += 'badge-medium';
        break;
      case 'low':
        className += 'badge-low';
        break;
      default:
        className += 'badge-info';
    }
  } else if (type === 'status') {
    switch (value.toLowerCase()) {
      case 'approved':
        className += 'badge-success';
        break;
      case 'rejected':
        className += 'badge-danger';
        break;
      case 'pending':
        className += 'badge-warning';
        break;
      default:
        className += 'badge-info';
    }
  } else if (type === 'role') {
    className += value === 'admin' ? 'badge-admin' : 'badge-analyst';
  } else {
    className += 'badge-info';
  }

  return <span className={className}>{value}</span>;
}
