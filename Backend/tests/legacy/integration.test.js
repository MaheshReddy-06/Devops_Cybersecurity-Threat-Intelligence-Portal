/**
 * End-to-End Analyst-to-Admin Lifecycle Integration Test
 * Verifies complete integration of Phase 1 through Phase 9.
 */

const express = require('express');
const http = require('http');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');

process.env.JWT_SECRET = 'e2e_integration_test_secret_key_2026';
process.env.JWT_EXPIRES_IN = '2h';

const User = require('../models/User');
const Threat = require('../models/Threat');
const Source = require('../models/Source');
const Activity = require('../models/Activity');

const authRoutes = require('../routes/authRoutes');
const threatRoutes = require('../routes/threatRoutes');
const sourceRoutes = require('../routes/sourceRoutes');
const adminRoutes = require('../routes/adminRoutes');
const dashboardRoutes = require('../routes/dashboardRoutes');
const activityRoutes = require('../routes/activityRoutes');
const reportRoutes = require('../routes/reportRoutes');

const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);
app.use('/api/threats', threatRoutes);
app.use('/api/sources', sourceRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/activities', activityRoutes);
app.use('/api/reports', reportRoutes);

function makeRequest(server, method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const address = server.address();
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: address.port,
        path,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          let parsed = null;
          try {
            parsed = JSON.parse(data);
          } catch (_) {
            parsed = data;
          }
          resolve({ status: res.statusCode, headers: res.headers, body: parsed, raw: data });
        });
      }
    );
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
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
User.findOne = async function (filter) {
  if (filter.email) {
    for (const u of store.users.values()) {
      if (u.email === filter.email.toLowerCase()) return u;
    }
  }
  return null;
};

User.findById = function (id) {
  const user = store.users.get(String(id));
  const chain = {
    select: function (fields) {
      if (!user) return Promise.resolve(null);
      const copy = { ...user };
      if (fields && fields.includes('-password')) delete copy.password;
      return Promise.resolve(copy);
    },
    then: function (resolve) {
      resolve(user || null);
    },
  };
  return chain;
};

User.create = async function (data) {
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(data.password, salt);
  const id = new mongoose.Types.ObjectId().toString();
  const created = {
    _id: id,
    name: data.name,
    email: data.email.toLowerCase(),
    password: hashedPassword,
    role: data.role || 'analyst',
    createdAt: new Date(),
    updatedAt: new Date(),
    matchPassword: async function (entered) {
      return await bcrypt.compare(entered, this.password);
    },
    save: async function () {
      this.updatedAt = new Date();
      if (this.password && !this.password.startsWith('$2')) {
        const salt = await bcrypt.genSalt(10);
        this.password = await bcrypt.hash(this.password, salt);
      }
      store.users.set(this._id, this);
      return this;
    },
  };
  store.users.set(id, created);
  return created;
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

Activity.countDocuments = async function (query = {}) {
  let list = store.activities;
  if (query.user) list = list.filter((a) => String(a.user) === String(query.user));
  return list.length;
};

Activity.find = function (query = {}) {
  let list = [...store.activities];
  if (query.user) list = list.filter((a) => String(a.user) === String(query.user));
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
      return list.slice(0, num).map((act) => ({
        ...act,
        user: store.users.get(String(act.user)) || { name: 'User' },
        threat: store.threats.get(String(act.threat)) || null,
      }));
    },
  };
  return chain;
};

Activity.aggregate = async function (pipeline) {
  const userMap = new Map();
  for (const act of store.activities) {
    const uId = String(act.user);
    if (!userMap.has(uId)) {
      userMap.set(uId, {
        _id: uId,
        totalActions: 0,
        submissionsLogged: 0,
        approvalsLogged: 0,
        rejectionsLogged: 0,
      });
    }
    const entry = userMap.get(uId);
    entry.totalActions++;
    if (act.action === 'SUBMIT_THREAT') entry.submissionsLogged++;
    if (act.action === 'APPROVE_THREAT') entry.approvalsLogged++;
    if (act.action === 'REJECT_THREAT') entry.rejectionsLogged++;
  }
  return Array.from(userMap.values()).map((entry) => ({
    ...entry,
    userInfo: store.users.get(entry._id) || { name: 'Unknown', email: '', role: '' },
  }));
};

// Mock Threat methods
Threat.countDocuments = async function (query = {}) {
  let list = Array.from(store.threats.values());
  list = filterThreats(list, query);
  return list.length;
};

Threat.find = function (query = {}) {
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
    limit: function (num) {
      const sliced = list.slice(0, num);
      return Promise.resolve(
        sliced.map((t) => ({
          ...t,
          source: store.sources.get(String(t.source)) || { name: 'Source' },
          submittedBy: store.users.get(String(t.submittedBy)) || { name: 'Analyst' },
          reviewedBy: t.reviewedBy ? store.users.get(String(t.reviewedBy)) : null,
        }))
      );
    },
    then: function (resolve) {
      resolve(
        list.map((t) => ({
          ...t,
          source: store.sources.get(String(t.source)) || { name: 'Source' },
          submittedBy: store.users.get(String(t.submittedBy)) || { name: 'Analyst' },
          reviewedBy: t.reviewedBy ? store.users.get(String(t.reviewedBy)) : null,
        }))
      );
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
        reviewedBy: threat.reviewedBy ? store.users.get(String(threat.reviewedBy)) : null,
      });
    },
  };
  return chain;
};

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
    save: async function () {
      this.updatedAt = new Date();
      store.threats.set(this._id, this);
      return this;
    },
  };
  store.threats.set(id, doc);
  return doc;
};

Threat.aggregate = async function (pipeline) {
  const groupStage = pipeline.find((stage) => stage.$group);
  if (!groupStage) return [];
  const threats = Array.from(store.threats.values());

  if (groupStage.$group._id === '$indicatorType') {
    const typeMap = new Map();
    for (const t of threats) {
      if (!typeMap.has(t.indicatorType)) {
        typeMap.set(t.indicatorType, {
          _id: t.indicatorType,
          count: 0,
          total: 0,
          approved: 0,
          pending: 0,
          rejected: 0,
          critical: 0,
          high: 0,
          medium: 0,
          low: 0,
        });
      }
      const data = typeMap.get(t.indicatorType);
      data.count++;
      data.total++;
      if (t.status === 'Approved') data.approved++;
      if (t.status === 'Pending') data.pending++;
      if (t.status === 'Rejected') data.rejected++;
      if (t.severity === 'Critical') data.critical++;
      if (t.severity === 'High') data.high++;
      if (t.severity === 'Medium') data.medium++;
      if (t.severity === 'Low') data.low++;
    }
    return Array.from(typeMap.values());
  }

  if (groupStage.$group._id === '$source') {
    const sourceMap = new Map();
    for (const t of threats) {
      const sId = typeof t.source === 'object' && t.source?._id ? String(t.source._id) : String(t.source);
      if (!sourceMap.has(sId)) {
        sourceMap.set(sId, {
          _id: sId,
          totalSubmissions: 0,
          approvedCount: 0,
          rejectedCount: 0,
          pendingCount: 0,
        });
      }
      const data = sourceMap.get(sId);
      data.totalSubmissions++;
      if (t.status === 'Approved') data.approvedCount++;
      if (t.status === 'Rejected') data.rejectedCount++;
      if (t.status === 'Pending') data.pendingCount++;
    }

    return Array.from(sourceMap.values()).map((item) => ({
      ...item,
      sourceInfo: store.sources.get(item._id) || { name: 'Unknown' },
    }));
  }

  return [];
};

function filterThreats(list, query) {
  return list.filter((t) => {
    if (query.status) {
      if (typeof query.status === 'object' && query.status.$in) {
        if (!query.status.$in.includes(t.status)) return false;
      } else if (t.status !== query.status) {
        return false;
      }
    }
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

async function runIntegrationTest() {
  console.log('================================================================');
  console.log('   PHASE 9: COMPLETE FRONTEND-BACKEND INTEGRATION LIFECYCLE     ');
  console.log('================================================================');

  let passed = 0;
  let failed = 0;

  function assert(condition, message) {
    if (condition) {
      console.log(`  [PASS] ${message}`);
      passed++;
    } else {
      console.error(`  [FAIL] ${message}`);
      failed++;
    }
  }

  // Pre-seed an administrator account
  const adminUser = await User.create({
    name: 'Chief Security Officer',
    email: 'admin@portal.local',
    password: 'Admin@SecurePassword123',
    role: 'admin',
  });

  const server = app.listen(0);

  try {
    // -------------------------------------------------------------
    // STEP 1: Analyst Registration (POST /api/auth/register)
    // -------------------------------------------------------------
    console.log('\n--- Step 1: Security Analyst Account Provisioning ---');
    const regRes = await makeRequest(server, 'POST', '/api/auth/register', {
      name: 'Elena Rostova, Threat Analyst',
      email: 'elena.analyst@threatintel.org',
      password: 'AnalystPassword2026!',
    });
    assert(regRes.status === 201, 'Analyst registered successfully (201 Created)');
    assert(regRes.body.user.role === 'analyst', 'Assigned role is strictly "analyst"');
    assert(!!regRes.body.token, 'JWT bearer token returned upon registration');
    const analystToken = regRes.body.token;

    // -------------------------------------------------------------
    // STEP 2: Analyst Profile Verification (GET /api/auth/me)
    // -------------------------------------------------------------
    console.log('\n--- Step 2: JWT Session & Profile Verification ---');
    const meRes = await makeRequest(server, 'GET', '/api/auth/me', null, {
      Authorization: `Bearer ${analystToken}`,
    });
    assert(meRes.status === 200, 'Authenticated profile retrieved (200 OK)');
    assert(meRes.body.user.email === 'elena.analyst@threatintel.org', 'Verified profile identity');

    // -------------------------------------------------------------
    // STEP 3: Ingesting Threat Indicators (POST /api/threats)
    // -------------------------------------------------------------
    console.log('\n--- Step 3: Threat Ingestion by Analyst ---');
    // Submission A: IP Indicator
    const subA = await makeRequest(
      server,
      'POST',
      '/api/threats',
      {
        indicatorValue: '203.0.113.195',
        indicatorType: 'IP',
        category: 'Ransomware C2',
        severity: 'Critical',
        submissionType: 'Indicator',
        source: 'AlienVault OTX',
        description: 'Confirmed LockBit command and control listener active on port 443',
      },
      { Authorization: `Bearer ${analystToken}` }
    );
    assert(subA.status === 201, 'Critical IP Indicator submitted successfully (201 Created)');
    assert(subA.body.data.status === 'Pending', 'Default status strictly assigned as Pending');
    const ipThreatId = subA.body.data._id;

    // Submission B: Domain Advisory
    const subB = await makeRequest(
      server,
      'POST',
      '/api/threats',
      {
        indicatorValue: 'corporate-sso-login.xyz',
        indicatorType: 'Domain',
        category: 'Phishing',
        severity: 'High',
        submissionType: 'Advisory',
        source: 'AlienVault OTX',
        description: 'Targeted credential harvesting domain impersonating corporate SSO portal',
      },
      { Authorization: `Bearer ${analystToken}` }
    );
    assert(subB.status === 201, 'Domain Advisory submitted successfully (201 Created)');
    const domainThreatId = subB.body.data._id;

    // Verify activity logs created
    assert(store.activities.length === 2, 'Audit trail automatically logged 2 submissions');

    // -------------------------------------------------------------
    // STEP 4: Access Control & Privacy Isolation Checks
    // -------------------------------------------------------------
    console.log('\n--- Step 4: Privacy & Isolation Enforcement ---');
    // In the general explorer, ordinary analysts cannot see pending threats
    const explorerAnalyst = await makeRequest(server, 'GET', '/api/threats', null, {
      Authorization: `Bearer ${analystToken}`,
    });
    assert(
      explorerAnalyst.body.data.length === 0,
      'Pending submissions are completely isolated from the public explorer'
    );

    // In personal history, the analyst CAN see their own pending submissions
    const mySubs = await makeRequest(server, 'GET', '/api/threats/my-submissions', null, {
      Authorization: `Bearer ${analystToken}`,
    });
    assert(mySubs.body.data.length === 2, 'Analyst views both pending items in personal history');

    // Analyst attempts to access moderation queue -> 403 Forbidden
    const analystModAttempt = await makeRequest(server, 'GET', '/api/admin/pending', null, {
      Authorization: `Bearer ${analystToken}`,
    });
    assert(analystModAttempt.status === 403, 'Analyst blocked from admin moderation queue (403 Forbidden)');

    // -------------------------------------------------------------
    // STEP 5: Administrator Authentication (POST /api/auth/login)
    // -------------------------------------------------------------
    console.log('\n--- Step 5: Administrator Login & Triage Queue ---');
    const adminLoginRes = await makeRequest(server, 'POST', '/api/auth/login', {
      email: 'admin@portal.local',
      password: 'Admin@SecurePassword123',
    });
    assert(adminLoginRes.status === 200, 'Administrator logged in (200 OK)');
    assert(adminLoginRes.body.user.role === 'admin', 'Verified administrator role');
    const adminToken = adminLoginRes.body.token;

    // Admin views pending queue
    const adminPendingRes = await makeRequest(server, 'GET', '/api/admin/pending', null, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert(adminPendingRes.status === 200, 'Admin accessed pending queue (200 OK)');
    assert(adminPendingRes.body.totalCount === 2, 'Admin views both pending submissions awaiting decision');

    // -------------------------------------------------------------
    // STEP 6: Triage Decisions (Approve & Reject)
    // -------------------------------------------------------------
    console.log('\n--- Step 6: Triage Decisions & Moderation Ledger ---');
    // Admin approves IP indicator
    const approveRes = await makeRequest(
      server,
      'PUT',
      `/api/admin/threats/${ipThreatId}/approve`,
      {
        reviewComment: 'Verified with VirusTotal and AlienVault telemetry. Confirmed active C2 node.',
      },
      { Authorization: `Bearer ${adminToken}` }
    );
    assert(approveRes.status === 200, 'IP Threat approved by Administrator (200 OK)');
    assert(approveRes.body.data.status === 'Approved', 'Status updated to Approved');

    // Admin rejects Domain advisory (false positive)
    const rejectRes = await makeRequest(
      server,
      'PUT',
      `/api/admin/threats/${domainThreatId}/reject`,
      {
        reviewComment: 'False positive: Domain identified as legitimate staging infrastructure.',
      },
      { Authorization: `Bearer ${adminToken}` }
    );
    assert(rejectRes.status === 200, 'Domain Threat rejected by Administrator (200 OK)');
    assert(rejectRes.body.data.status === 'Rejected', 'Status updated to Rejected');

    // Guard: Re-reviewing already processed threat without override is blocked
    const duplicateApprove = await makeRequest(
      server,
      'PUT',
      `/api/admin/threats/${ipThreatId}/approve`,
      { reviewComment: 'Duplicate approval attempt' },
      { Authorization: `Bearer ${adminToken}` }
    );
    assert(duplicateApprove.status === 400, 'Accidental re-approval guard enforces 400 Bad Request');

    // -------------------------------------------------------------
    // STEP 7: Post-Moderation Verification in Threat Explorer
    // -------------------------------------------------------------
    console.log('\n--- Step 7: Global Explorer Verification ---');
    const postModExplorer = await makeRequest(server, 'GET', '/api/threats', null, {
      Authorization: `Bearer ${analystToken}`,
    });
    assert(postModExplorer.body.data.length === 1, 'Explorer now displays exactly 1 published threat');
    assert(
      postModExplorer.body.data[0].indicatorValue === '203.0.113.195',
      'Only the Approved IP is visible in the public feed'
    );

    // Search filter check
    const searchMatch = await makeRequest(server, 'GET', '/api/threats?search=LockBit', null, {
      Authorization: `Bearer ${analystToken}`,
    });
    assert(searchMatch.body.data.length === 1, 'Search by keyword "LockBit" returned the approved threat');

    // -------------------------------------------------------------
    // STEP 8: Dashboard Analytics Verification (GET /api/dashboard/stats)
    // -------------------------------------------------------------
    console.log('\n--- Step 8: Dashboard Analytics & Real Database Metrics ---');
    const dashboardRes = await makeRequest(server, 'GET', '/api/dashboard/stats', null, {
      Authorization: `Bearer ${analystToken}`,
    });
    assert(dashboardRes.status === 200, 'Dashboard statistics fetched (200 OK)');
    assert(dashboardRes.body.data.summary.totalSubmissions === 2, 'Total submissions = 2');
    assert(dashboardRes.body.data.summary.totalApproved === 1, 'Total approved = 1');
    assert(dashboardRes.body.data.summary.totalRejected === 1, 'Total rejected = 1');
    assert(dashboardRes.body.data.summary.totalPending === 0, 'Total pending = 0 (triage queue cleared)');
    assert(dashboardRes.body.data.severityBreakdown.criticalThreats === 1, 'Critical count = 1');
    assert(dashboardRes.body.data.indicatorTypeDistribution.IP === 1, 'IP distribution count = 1');
    assert(dashboardRes.body.data.indicatorTypeDistribution.Domain === 1, 'Domain distribution count = 1');

    // -------------------------------------------------------------
    // STEP 9: Four Mandatory Reports & CSV Downloads
    // -------------------------------------------------------------
    console.log('\n--- Step 9: Mandatory Reports & CSV Export Streams ---');
    // Report 1: Submissions
    const rep1 = await makeRequest(server, 'GET', '/api/reports/submissions', null, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert(rep1.status === 200, 'Report 1: Submissions Report generated (200 OK)');

    // Report 2: Indicators
    const rep2 = await makeRequest(server, 'GET', '/api/reports/indicators', null, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert(rep2.status === 200, 'Report 2: Indicators Summary Report generated (200 OK)');

    // Report 3: Source Reliability (AlienVault had 1 approved, 1 rejected -> 50% approval rate)
    const rep3 = await makeRequest(server, 'GET', '/api/reports/sources', null, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert(rep3.status === 200, 'Report 3: Source Reliability Report generated (200 OK)');
    const otx = rep3.body.data.find((s) => s.sourceName === 'AlienVault OTX');
    assert(otx.totalSubmissions === 2, 'AlienVault total submissions = 2');
    assert(otx.approvedCount === 1, 'AlienVault approved = 1');
    assert(otx.rejectedCount === 1, 'AlienVault rejected = 1');
    assert(otx.approvalRatePercent === 50, 'AlienVault approval rate calculated accurately as 50.0%');
    assert(otx.reliabilityRating === 'Moderate Reliability', 'Assigned Moderate Reliability tier');

    // Report 3 CSV Export Stream
    const rep3Csv = await makeRequest(server, 'GET', '/api/reports/sources?format=csv', null, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert(rep3Csv.headers['content-type'].includes('text/csv'), 'Report returns text/csv content type');
    assert(rep3Csv.raw.includes('AlienVault OTX'), 'CSV stream contains evaluated data');

    // Report 4: Analyst Activity
    const rep4 = await makeRequest(server, 'GET', '/api/reports/analysts', null, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert(rep4.status === 200, 'Report 4: Analyst Activity Report generated (200 OK)');

    // -------------------------------------------------------------
    // STEP 10: Profile & Password Management (PUT /api/auth/change-password)
    // -------------------------------------------------------------
    console.log('\n--- Step 10: Profile & Credential Management ---');
    const passChangeRes = await makeRequest(
      server,
      'PUT',
      '/api/auth/change-password',
      {
        currentPassword: 'AnalystPassword2026!',
        newPassword: 'BrandNewSecurePassword999!',
      },
      { Authorization: `Bearer ${analystToken}` }
    );
    assert(passChangeRes.status === 200, 'Password changed successfully (200 OK)');

    // Verify login with OLD password fails
    const oldLoginFail = await makeRequest(server, 'POST', '/api/auth/login', {
      email: 'elena.analyst@threatintel.org',
      password: 'AnalystPassword2026!',
    });
    assert(oldLoginFail.status === 401, 'Login with old password correctly rejected (401 Unauthorized)');

    // Verify login with NEW password succeeds
    const newLoginSuccess = await makeRequest(server, 'POST', '/api/auth/login', {
      email: 'elena.analyst@threatintel.org',
      password: 'BrandNewSecurePassword999!',
    });
    assert(newLoginSuccess.status === 200, 'Login with updated password succeeds (200 OK)');

  } finally {
    server.close();
  }

  console.log('\n================================================================');
  console.log(`   INTEGRATION SUITE COMPLETE: ${passed} Passed, ${failed} Failed`);
  console.log('================================================================\n');

  if (failed > 0) process.exit(1);
}

runIntegrationTest();
