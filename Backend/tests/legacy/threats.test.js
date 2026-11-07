/**
 * Comprehensive Automated Test Suite for Phase 5: Threat Intelligence Management APIs
 */

const express = require('express');
const http = require('http');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

process.env.JWT_SECRET = 'test_threat_jwt_secret_key_12345';
process.env.JWT_EXPIRES_IN = '1h';

const User = require('../models/User');
const Threat = require('../models/Threat');
const Source = require('../models/Source');
const Activity = require('../models/Activity');

const authRoutes = require('../routes/authRoutes');
const threatRoutes = require('../routes/threatRoutes');
const sourceRoutes = require('../routes/sourceRoutes');
const { validateIndicator } = require('../utils/indicatorValidator');

const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api/threats', threatRoutes);
app.use('/api/sources', sourceRoutes);

// Helper for making HTTP requests in Node.js
function makeRequest(server, method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const address = server.address();
    const options = {
      hostname: '127.0.0.1',
      port: address.port,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        let parsed = null;
        try {
          parsed = JSON.parse(data);
        } catch (_) {
          parsed = data;
        }
        resolve({ status: res.statusCode, body: parsed });
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

// In-memory data store simulating MongoDB
const store = {
  users: new Map(),
  sources: new Map(),
  threats: new Map(),
  activities: [],
};

// Mock User methods
User.findById = function (id) {
  return {
    select: async function (fields) {
      const user = store.users.get(String(id));
      if (!user) return null;
      const copy = { ...user };
      if (fields && fields.includes('-password')) delete copy.password;
      return copy;
    },
  };
};

// Mock Source methods
Source.find = function () {
  return {
    sort: async function () {
      return Array.from(store.sources.values());
    },
  };
};

Source.findById = async function (id) {
  return store.sources.get(String(id)) || null;
};

Source.findOne = async function (filter) {
  if (filter.name) {
    for (const s of store.sources.values()) {
      if (s.name.toLowerCase() === filter.name.toLowerCase()) return s;
    }
  }
  return null;
};

Source.create = async function (data) {
  const id = new mongoose.Types.ObjectId().toString();
  const doc = {
    _id: id,
    name: data.name,
    description: data.description || '',
    contact: data.contact || '',
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  store.sources.set(id, doc);
  return doc;
};

// Mock Activity methods
Activity.create = async function (data) {
  const doc = {
    _id: new mongoose.Types.ObjectId().toString(),
    ...data,
    createdAt: new Date(),
  };
  store.activities.push(doc);
  return doc;
};

// Mock Threat methods
Threat.create = async function (data) {
  const id = new mongoose.Types.ObjectId().toString();
  const doc = {
    _id: id,
    indicatorValue: data.indicatorValue,
    indicatorType: data.indicatorType,
    category: data.category,
    severity: data.severity || 'Medium',
    description: data.description,
    submissionType: data.submissionType || 'Indicator',
    source: data.source,
    submittedBy: data.submittedBy,
    status: data.status || 'Pending',
    reviewedBy: null,
    reviewComment: '',
    createdAt: new Date(),
    updatedAt: new Date(),
    populate: async function () {
      return this;
    },
  };
  store.threats.set(id, doc);
  return doc;
};

Threat.countDocuments = async function (query) {
  let list = Array.from(store.threats.values());
  list = filterThreats(list, query);
  return list.length;
};

Threat.find = function (query) {
  let list = Array.from(store.threats.values());
  list = filterThreats(list, query);

  const chain = {
    populate: function () {
      return chain;
    },
    sort: function () {
      list.sort((a, b) => b.createdAt - a.createdAt);
      return chain;
    },
    skip: function (num) {
      list = list.slice(num);
      return chain;
    },
    limit: async function (num) {
      return list.slice(0, num);
    },
  };
  return chain;
};

Threat.findById = function (id) {
  const threat = store.threats.get(String(id));
  const chain = {
    populate: function () {
      return chain;
    },
    then: function (resolve) {
      if (!threat) return resolve(null);
      return resolve({
        ...threat,
        submittedBy: store.users.get(String(threat.submittedBy)) || { _id: threat.submittedBy },
        source: store.sources.get(String(threat.source)) || { _id: threat.source },
        reviewedBy: threat.reviewedBy ? (store.users.get(String(threat.reviewedBy)) || { _id: threat.reviewedBy }) : null,
      });
    },
  };
  return chain;
};

function filterThreats(list, query) {
  return list.filter((t) => {
    if (query.status && t.status !== query.status) return false;
    if (query.submittedBy && String(t.submittedBy) !== String(query.submittedBy)) return false;
    if (query.indicatorType && t.indicatorType !== query.indicatorType) return false;
    if (query.severity && t.severity !== query.severity) return false;
    if (query.submissionType && t.submissionType !== query.submissionType) return false;
    if (query.source && String(t.source) !== String(query.source)) return false;
    if (query.$or) {
      const match = query.$or.some((item) => {
        for (const [key, val] of Object.entries(item)) {
          if (val instanceof RegExp && val.test(t[key])) return true;
        }
        return false;
      });
      if (!match) return false;
    }
    return true;
  });
}

async function runTests() {
  console.log('--- STARTING PHASE 5: THREAT MANAGEMENT TESTS ---');
  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  PASS: ${message}`);
      passed++;
    } else {
      console.error(`  FAIL: ${message}`);
      failed++;
    }
  }

  // Unit tests for indicatorValidator
  assert(validateIndicator('IP', '192.168.1.1').valid === true, 'Valid IPv4 accepted');
  assert(validateIndicator('IP', '2001:0db8:85a3:0000:0000:8a2e:0370:7334').valid === true, 'Valid IPv6 accepted');
  assert(validateIndicator('IP', '999.999.999.999').valid === false, 'Invalid IP rejected');
  assert(validateIndicator('Domain', 'c2-server.evil.com').valid === true, 'Valid domain accepted');
  assert(validateIndicator('Domain', 'invalid_domain!').valid === false, 'Invalid domain rejected');
  assert(validateIndicator('URL', 'https://malware-drop.com/beacon.exe').valid === true, 'Valid URL accepted');
  assert(validateIndicator('URL', 'javascript:alert(1)').valid === false, 'Invalid URL scheme rejected');
  assert(validateIndicator('Hash', 'd41d8cd98f00b204e9800998ecf8427e').valid === true, 'Valid MD5 hash accepted');
  assert(validateIndicator('Hash', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855').valid === true, 'Valid SHA-256 hash accepted');
  assert(validateIndicator('Hash', 'not_a_hex_hash').valid === false, 'Non-hex hash rejected');

  // Seed Users
  const analyst1Id = new mongoose.Types.ObjectId().toString();
  const analyst1 = { _id: analyst1Id, name: 'Alice Analyst', email: 'alice@threat.org', role: 'analyst' };
  store.users.set(analyst1Id, analyst1);
  const analyst1Token = jwt.sign({ id: analyst1Id, role: 'analyst' }, process.env.JWT_SECRET);

  const analyst2Id = new mongoose.Types.ObjectId().toString();
  const analyst2 = { _id: analyst2Id, name: 'Bob Analyst', email: 'bob@threat.org', role: 'analyst' };
  store.users.set(analyst2Id, analyst2);
  const analyst2Token = jwt.sign({ id: analyst2Id, role: 'analyst' }, process.env.JWT_SECRET);

  const adminId = new mongoose.Types.ObjectId().toString();
  const admin = { _id: adminId, name: 'Dave Admin', email: 'admin@threat.org', role: 'admin' };
  store.users.set(adminId, admin);
  const adminToken = jwt.sign({ id: adminId, role: 'admin' }, process.env.JWT_SECRET);

  // Seed Source
  const source1 = await Source.create({ name: 'AlienVault OTX', description: 'Open Threat Exchange' });

  const server = app.listen(0);

  try {
    // 1. Submit a valid Threat Indicator (POST /api/threats)
    const subRes = await makeRequest(server, 'POST', '/api/threats', {
      indicatorValue: '198.51.100.42',
      indicatorType: 'IP',
      category: 'Botnet C2',
      severity: 'Critical',
      description: 'Active Mirai command-and-control botnet server',
      submissionType: 'Indicator',
      source: source1._id,
    }, { Authorization: `Bearer ${analyst1Token}` });

    assert(subRes.status === 201, 'Submit indicator returns 201 Created');
    assert(subRes.body.data.status === 'Pending', 'Default status is Pending');
    assert(subRes.body.data.submittedBy === analyst1Id, 'Associated with logged-in analyst Alice');
    const threat1Id = subRes.body.data._id;

    // Verify Activity log created
    assert(store.activities.length === 1, 'Activity record automatically generated on submission');
    assert(store.activities[0].action === 'SUBMIT_THREAT', 'Activity action is SUBMIT_THREAT');

    // 2. Submit an Advisory
    const advRes = await makeRequest(server, 'POST', '/api/threats', {
      indicatorValue: 'phishing-login-portal.net',
      indicatorType: 'Domain',
      category: 'Phishing',
      severity: 'High',
      description: 'Credential harvesting campaign targeting healthcare employees',
      submissionType: 'Advisory',
      source: 'CISA Alert',
    }, { Authorization: `Bearer ${analyst1Token}` });
    assert(advRes.status === 201, 'Submit advisory returns 201 Created');
    assert(advRes.body.data.submissionType === 'Advisory', 'Submission type recorded as Advisory');

    // 3. Submit an Observation
    const obsRes = await makeRequest(server, 'POST', '/api/threats', {
      indicatorValue: 'https://cdn-evil.org/drop/keylogger.exe',
      indicatorType: 'URL',
      category: 'Trojan',
      severity: 'Medium',
      description: 'Observed suspicious payload hosting link in spam emails',
      submissionType: 'Observation',
      source: source1._id,
    }, { Authorization: `Bearer ${analyst2Token}` });
    assert(obsRes.status === 201, 'Submit observation returns 201 Created');
    assert(obsRes.body.data.submissionType === 'Observation', 'Submission type recorded as Observation');
    const obsThreatId = obsRes.body.data._id;

    // 4. Invalid Indicator Value Rejection
    const invalidRes = await makeRequest(server, 'POST', '/api/threats', {
      indicatorValue: '999.999.999.999',
      indicatorType: 'IP',
      category: 'Malware',
      description: 'Test invalid IP',
      source: source1._id,
    }, { Authorization: `Bearer ${analyst1Token}` });
    assert(invalidRes.status === 400, 'Invalid IP rejected with 400 Bad Request');
    assert(invalidRes.body.message.includes('Invalid IP address'), 'Validation error message returned');

    // 5. Approved indicator explorer security (GET /api/threats)
    // All current threats in store are "Pending".
    const explorerRes = await makeRequest(server, 'GET', '/api/threats', null, {
      Authorization: `Bearer ${analyst1Token}`,
    });
    assert(explorerRes.status === 200, 'GET /api/threats returns 200 OK');
    assert(explorerRes.body.data.length === 0, 'Analyst cannot see any pending indicators in general explorer');

    // Mark threat1 as Approved
    store.threats.get(threat1Id).status = 'Approved';

    const explorerAfterApproval = await makeRequest(server, 'GET', '/api/threats', null, {
      Authorization: `Bearer ${analyst2Token}`,
    });
    assert(explorerAfterApproval.body.data.length === 1, 'Approved indicator is visible to analysts in explorer');
    assert(explorerAfterApproval.body.data[0].status === 'Approved', 'Only Approved indicator returned');

    // 6. Admin can view all statuses (GET /api/threats)
    const adminExplorer = await makeRequest(server, 'GET', '/api/threats', null, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert(adminExplorer.body.data.length === 3, 'Administrator can access all submissions regardless of status');

    // 7. Personal submission history (GET /api/threats/my-submissions)
    const aliceSubs = await makeRequest(server, 'GET', '/api/threats/my-submissions', null, {
      Authorization: `Bearer ${analyst1Token}`,
    });
    assert(aliceSubs.status === 200, 'GET /api/threats/my-submissions returns 200 OK');
    assert(aliceSubs.body.data.length === 2, 'Alice sees her own 2 submissions (1 Approved, 1 Pending)');

    const bobSubs = await makeRequest(server, 'GET', '/api/threats/my-submissions', null, {
      Authorization: `Bearer ${analyst2Token}`,
    });
    assert(bobSubs.body.data.length === 1, 'Bob sees only his own 1 submission');

    // 8. Retrieve threat by ID (GET /api/threats/:id)
    // Approved threat is accessible to anyone authenticated
    const getApproved = await makeRequest(server, 'GET', `/api/threats/${threat1Id}`, null, {
      Authorization: `Bearer ${analyst2Token}`,
    });
    assert(getApproved.status === 200, 'Analyst can view Approved threat by ID');

    // Pending threat: Bob owns obsThreatId. Alice tries to view Bob's pending submission -> 403
    const getPendingForbidden = await makeRequest(server, 'GET', `/api/threats/${obsThreatId}`, null, {
      Authorization: `Bearer ${analyst1Token}`,
    });
    assert(getPendingForbidden.status === 403, 'Analyst denied access to other analysts pending threat by ID (403)');

    // Pending threat: Bob views his own pending submission -> 200
    const getPendingOwner = await makeRequest(server, 'GET', `/api/threats/${obsThreatId}`, null, {
      Authorization: `Bearer ${analyst2Token}`,
    });
    assert(getPendingOwner.status === 200, 'Submitting analyst can view their own pending threat by ID');

    // Pending threat: Admin views pending submission -> 200
    const getPendingAdmin = await makeRequest(server, 'GET', `/api/threats/${obsThreatId}`, null, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert(getPendingAdmin.status === 200, 'Admin can view any pending threat by ID');

    // 9. Search and Filter tests
    const searchRes = await makeRequest(server, 'GET', '/api/threats?search=Mirai', null, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert(searchRes.body.data.length === 1, 'Keyword search matches "Mirai"');

    const filterTypeRes = await makeRequest(server, 'GET', '/api/threats?indicatorType=Domain', null, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert(filterTypeRes.body.data.length === 1, 'Filter by indicatorType=Domain returns 1');
    assert(filterTypeRes.body.data[0].indicatorType === 'Domain', 'Indicator type matches Domain');

    // 10. Intelligence Sources list (GET /api/sources)
    const sourcesRes = await makeRequest(server, 'GET', '/api/sources', null, {
      Authorization: `Bearer ${analyst1Token}`,
    });
    assert(sourcesRes.status === 200, 'GET /api/sources returns 200 OK');
    assert(sourcesRes.body.data.length >= 2, 'Sources endpoint lists all threat sources');

  } finally {
    server.close();
  }

  console.log('--- TEST SUMMARY ---');
  console.log(`Passed: ${passed}, Failed: ${failed}`);
  if (failed > 0) {
    process.exit(1);
  } else {
    console.log('ALL PHASE 5 TESTS PASSED SUCCESSFULLY!');
  }
}

runTests();
