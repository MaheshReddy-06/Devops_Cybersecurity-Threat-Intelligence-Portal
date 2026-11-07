const net = require('net');

/**
 * Validates indicator value based on its indicator type:
 * - IP: Valid IPv4 or IPv6 address.
 * - Domain: Valid domain name (e.g., evil-c2.com, sub.threat.org).
 * - URL: Valid HTTP/HTTPS/FTP URL.
 * - Hash: Valid cryptographic hash (MD5, SHA-1, SHA-256, SHA-512).
 *
 * @param {string} type - 'IP' | 'Domain' | 'URL' | 'Hash'
 * @param {string} value - The indicator value to validate
 * @returns {{ valid: boolean, message?: string }}
 */
const validateIndicator = (type, value) => {
  if (!value || typeof value !== 'string') {
    return { valid: false, message: 'Indicator value must be a non-empty string' };
  }

  const trimmed = value.trim();

  switch (type) {
    case 'IP': {
      // Use Node's built-in net.isIP (returns 4 for IPv4, 6 for IPv6, 0 for invalid)
      const ipVersion = net.isIP(trimmed);
      if (ipVersion === 0) {
        return {
          valid: false,
          message: `Invalid IP address: '${trimmed}'. Must be a valid IPv4 or IPv6 address.`,
        };
      }
      return { valid: true };
    }

    case 'Domain': {
      // Regex for RFC-compliant domain names
      const domainRegex = /^(?!:\/\/)([a-zA-Z0-9-_]+\.)+[a-zA-Z]{2,}$/;
      if (!domainRegex.test(trimmed)) {
        return {
          valid: false,
          message: `Invalid Domain name: '${trimmed}'. Example: malicious-site.com`,
        };
      }
      return { valid: true };
    }

    case 'URL': {
      try {
        const parsedUrl = new URL(trimmed);
        if (!['http:', 'https:', 'ftp:'].includes(parsedUrl.protocol)) {
          return {
            valid: false,
            message: `Invalid URL protocol: '${parsedUrl.protocol}'. Protocol must be http:, https:, or ftp:`,
          };
        }
        return { valid: true };
      } catch (_) {
        return {
          valid: false,
          message: `Invalid URL: '${trimmed}'. Must be a valid well-formed URL (e.g., https://malicious.org/payload.exe).`,
        };
      }
    }

    case 'Hash': {
      // Supported hashes: MD5 (32), SHA-1 (40), SHA-256 (64), SHA-512 (128)
      const hashRegex = /^([a-fA-F0-9]{32}|[a-fA-F0-9]{40}|[a-fA-F0-9]{64}|[a-fA-F0-9]{128})$/;
      if (!hashRegex.test(trimmed)) {
        return {
          valid: false,
          message: `Invalid Hash: '${trimmed}'. Must be a valid MD5 (32-char), SHA-1 (40-char), SHA-256 (64-char), or SHA-512 (128-char) hex string.`,
        };
      }
      return { valid: true };
    }

    default:
      return {
        valid: false,
        message: `Unsupported indicator type '${type}'. Allowed types: IP, Domain, URL, Hash`,
      };
  }
};

module.exports = {
  validateIndicator,
};
