/**
 * Utility to convert structured JavaScript objects into RFC 4180 compliant CSV format.
 *
 * @param {Array<{ label: string, key: string }>} columns - Column definitions with headers and object keys
 * @param {Array<Object>} data - Array of data records
 * @returns {string} Formatted CSV string
 */
const convertToCsv = (columns, data) => {
  if (!Array.isArray(columns) || columns.length === 0) {
    return '';
  }

  // Helper to extract nested values by dot notation (e.g. 'source.name')
  const getNestedValue = (obj, path) => {
    return path.split('.').reduce((acc, part) => {
      if (acc === null || acc === undefined) return '';
      return acc[part];
    }, obj);
  };

  // Helper to escape CSV field values
  const escapeField = (value) => {
    if (value === null || value === undefined) {
      return '""';
    }
    const stringValue = String(value);
    // If value contains comma, quotes, or newlines, wrap in quotes and escape internal quotes
    if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n') || stringValue.includes('\r')) {
      return `"${stringValue.replace(/"/g, '""')}"`;
    }
    return `"${stringValue}"`;
  };

  // 1. Generate Header Row
  const headerRow = columns.map((col) => escapeField(col.label)).join(',');

  // 2. Generate Data Rows
  const dataRows = (data || []).map((row) => {
    return columns
      .map((col) => {
        const rawValue = getNestedValue(row, col.key);
        return escapeField(rawValue);
      })
      .join(',');
  });

  return [headerRow, ...dataRows].join('\r\n');
};

module.exports = {
  convertToCsv,
};
