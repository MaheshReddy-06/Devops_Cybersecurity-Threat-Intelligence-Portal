/**
 * Comprehensive Automated Test Suite for Phase 7:
 * - Part A: Dashboard Analytics API
 * - Part B: Analyst Activity API
 * - Part C: Four Mandatory Reports (with Dynamic Aggregation & CSV Export)
 */

const express = require('express');
const http = require('http');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

process.env.JWT_SECRET = 'test_phase7_jwt_secret_key_12345';
process.env.JWT_EXPIRES_IN = '1h';

const User = require('../models/User');
const Threat = require('../models/Threat');
const Source = require('../models/Source');
const Activity = require('../models/Activity');

const dashboardRoutes = require('../routes/dashboardRoutes');
const activityRoutes = require('../routes/activityRoutes');
const reportRoutes = require('../routes/reportRoutes');

const app = express();
app.use(express.json());
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/activities', activityRoutes);
app.use('/api/reports', reportRoutes);

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
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: parsed,
          raw: data,
        });
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

// Mock Activity methods
Activity.countDocuments = async function (query = {}) {
  let list = store.activities;
  if (query.user) {
    list = list.filter((a) => String(a.user) === String(query.user));
  }
  return list.length;
};

Activity.find = function (query = {}) {
  let list = [...store.activities];
  if (query.user) {
    list = list.filter((a) => String(a.user) === String(query.user));
  }

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
      return list.slice(0, num).map((act) => {
        return {
          ...act,
          user: store.users.get(String(act.user)) || { _id: act.user, name: 'User' },
          threat: store.threats.get(String(act.threat)) || null,
        };
      });
    },
  };
  return chain;
};

Activity.aggregate = async function (pipeline) {
  // Aggregate activities grouped by user
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

  const results = [];
  for (const entry of userMap.values()) {
    const userInfo = store.users.get(entry._id) || { name: 'Unknown', email: '', role: '' };
    results.push({
      ...entry,
      userInfo,
    });
  }

  return results.sort((a, b) => b.totalActions - a.totalActions);
};

// Mock Threat methods
Threat.countDocuments = async function (query = {}) {
  let list = Array.from(store.threats.values());
  if (query.status) {
    list = list.filter((t) => t.status === query.status);
  }
  if (query.severity) {
    list = list.filter((t) => t.severity === query.severity);
  }
  return list.length;
};

Threat.find = function (query = {}) {
  let list = Array.from(store.threats.values());
  if (query.createdAt) {
    if (query.createdAt.$gte) {
      list = list.filter((t) => t.createdAt >= query.createdAt.$gte);
    }
    if (query.createdAt.$lte) {
      list = list.filter((t) => t.createdAt <= query.createdAt.$lte);
    }
  }

  const chain = {
    populate: function () {
      return chain;
    },
    sort: function () {
      list.sort((a, b) => b.createdAt - a.createdAt);
      return chain;
    },
    limit: async function (num) {
      return list.slice(0, num).map((t) => ({
        ...t,
        source: store.sources.get(String(t.source)) || { name: 'Source' },
        submittedBy: store.users.get(String(t.submittedBy)) || { name: 'Analyst' },
        reviewedBy: t.reviewedBy ? store.users.get(String(t.reviewedBy)) : null,
      }));
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

Threat.aggregate = async function (pipeline) {
  // Check if grouping by indicatorType or by source
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
      const sId = String(t.source);
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

async function runTests() {
  console.log('--- STARTING PHASE 7: DASHBOARD, ACTIVITY & REPORT TESTS ---');
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

  // 1. Seed Users
  const analystId = new mongoose.Types.ObjectId().toString();
  const analyst = { _id: analystId, name: 'Alice Analyst', email: 'alice@threat.org', role: 'analyst' };
  store.users.set(analystId, analyst);
  const analystToken = jwt.sign({ id: analystId, role: 'analyst' }, process.env.JWT_SECRET);

  const analyst2Id = new mongoose.Types.ObjectId().toString();
  const analyst2 = { _id: analyst2Id, name: 'Bob Analyst', email: 'bob@threat.org', role: 'analyst' };
  store.users.set(analyst2Id, analyst2);
  const analyst2Token = jwt.sign({ id: analyst2Id, role: 'analyst' }, process.env.JWT_SECRET);

  const adminId = new mongoose.Types.ObjectId().toString();
  const admin = { _id: adminId, name: 'Dave Admin', email: 'admin@threat.org', role: 'admin' };
  store.users.set(adminId, admin);
  const adminToken = jwt.sign({ id: adminId, role: 'admin' }, process.env.JWT_SECRET);

  // 2. Seed Sources
  const source1Id = new mongoose.Types.ObjectId().toString();
  store.sources.set(source1Id, { _id: source1Id, name: 'AlienVault OTX' });

  const source2Id = new mongoose.Types.ObjectId().toString();
  store.sources.set(source2Id, { _id: source2Id, name: 'CISA US-CERT' });

  // 3. Seed Realistic Threats
  function addThreat(val, type, severity, status, sourceId, submitterId) {
    const id = new mongoose.Types.ObjectId().toString();
    const doc = {
      _id: id,
      indicatorValue: val,
      indicatorType: type,
      category: 'Malware',
      severity,
      submissionType: 'Indicator',
      status,
      source: sourceId,
      submittedBy: submitterId,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    store.threats.set(id, doc);
    return doc;
  }

  const t1 = addThreat('198.51.100.10', 'IP', 'Critical', 'Approved', source1Id, analystId);
  const t2 = addThreat('198.51.100.20', 'IP', 'High', 'Approved', source1Id, analystId);
  const t3 = addThreat('bad-domain.com', 'Domain', 'Medium', 'Pending', source1Id, analystId);
  const t4 = addThreat('phish.org', 'Domain', 'Low', 'Rejected', source1Id, analyst2Id);
  const t5 = addThreat('https://evil.net/shell', 'URL', 'Critical', 'Approved', source2Id, analyst2Id);
  const t6 = addThreat('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', 'Hash', 'High', 'Rejected', source2Id, analyst2Id);

  // 4. Seed Activities
  function addActivity(userId, threatId, action, desc) {
    store.activities.push({
      _id: new mongoose.Types.ObjectId().toString(),
      user: userId,
      threat: threatId,
      action,
      description: desc,
      createdAt: new Date(),
    });
  }

  addActivity(analystId, t1._id, 'SUBMIT_THREAT', 'Submitted IP');
  addActivity(analystId, t2._id, 'SUBMIT_THREAT', 'Submitted IP');
  addActivity(analystId, t3._id, 'SUBMIT_THREAT', 'Submitted Domain');
  addActivity(analyst2Id, t4._id, 'SUBMIT_THREAT', 'Submitted Domain');
  addActivity(analyst2Id, t5._id, 'SUBMIT_THREAT', 'Submitted URL');
  addActivity(analyst2Id, t6._id, 'SUBMIT_THREAT', 'Submitted Hash');
  addActivity(adminId, t1._id, 'APPROVE_THREAT', 'Approved IP');
  addActivity(adminId, t4._id, 'REJECT_THREAT', 'Rejected Domain');

  const server = app.listen(0);

  try {
    // PART A: DASHBOARD STATS TESTS
    const dashRes = await makeRequest(server, 'GET', '/api/dashboard/stats', null, {
      Authorization: `Bearer ${analystToken}`,
    });

    assert(dashRes.status === 200, 'GET /api/dashboard/stats returns 200 OK');
    assert(dashRes.body.data.summary.totalSubmissions === 6, 'Total submissions count is 6');
    assert(dashRes.body.data.summary.totalApproved === 3, 'Total approved count is 3');
    assert(dashRes.body.data.summary.totalPending === 1, 'Total pending count is 1');
    assert(dashRes.body.data.summary.totalRejected === 2, 'Total rejected count is 2');
    assert(dashRes.body.data.severityBreakdown.criticalThreats === 2, 'Critical threats count is 2');
    assert(dashRes.body.data.severityBreakdown.highThreats === 2, 'High threats count is 2');
    assert(dashRes.body.data.indicatorTypeDistribution.IP === 2, 'IP indicators count is 2');
    assert(dashRes.body.data.indicatorTypeDistribution.Domain === 2, 'Domain indicators count is 2');
    assert(dashRes.body.data.recentSubmissions.length <= 5, 'Recent submissions list returned');

    // PART B: ACTIVITIES API TESTS
    // 1. Analyst retrieves activities (only Alice's activities)
    const analystActRes = await makeRequest(server, 'GET', '/api/activities', null, {
      Authorization: `Bearer ${analystToken}`,
    });
    assert(analystActRes.status === 200, 'GET /api/activities returns 200 for analyst');
    assert(analystActRes.body.totalCount === 3, 'Analyst Alice sees only her own 3 activities');

    // 2. Admin retrieves activities (sees all 8 system activities)
    const adminActRes = await makeRequest(server, 'GET', '/api/activities', null, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert(adminActRes.status === 200, 'GET /api/activities returns 200 for admin');
    assert(adminActRes.body.totalCount === 8, 'Admin sees all 8 system activities');

    // PART C: FOUR MANDATORY REPORTS
    // Report 1: Threat Submission Report (JSON)
    const repSubJson = await makeRequest(server, 'GET', '/api/reports/submissions', null, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert(repSubJson.status === 200, 'GET /api/reports/submissions returns 200 OK');
    assert(repSubJson.body.summary.totalSubmissions === 6, 'Report 1 calculates total submissions');
    assert(repSubJson.body.summary.statusBreakdown.approved === 3, 'Report 1 status breakdown approved = 3');

    // Report 1: Threat Submission Report (CSV Export)
    const repSubCsv = await makeRequest(server, 'GET', '/api/reports/submissions?format=csv', null, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert(repSubCsv.status === 200, 'Report 1 CSV export returns 200 OK');
    assert(repSubCsv.headers['content-type'].includes('text/csv'), 'Report 1 returns text/csv content-type');
    assert(repSubCsv.raw.includes('Indicator Value'), 'Report 1 CSV contains column headers');

    // Report 2: Indicator Summary Report (JSON)
    const repIndJson = await makeRequest(server, 'GET', '/api/reports/indicators', null, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert(repIndJson.status === 200, 'GET /api/reports/indicators returns 200 OK');
    assert(repIndJson.body.data.length >= 4, 'Report 2 groups by all indicator types (IP, Domain, URL, Hash)');
    assert(repIndJson.body.summary.grandTotalIndicators === 6, 'Report 2 grand total matches actual records');

    // Report 2: Indicator Summary Report (CSV Export)
    const repIndCsv = await makeRequest(server, 'GET', '/api/reports/indicators?format=csv', null, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert(repIndCsv.status === 200, 'Report 2 CSV export returns 200 OK');
    assert(repIndCsv.headers['content-type'].includes('text/csv'), 'Report 2 returns text/csv content-type');
    assert(repIndCsv.raw.includes('Approval Rate (%)'), 'Report 2 CSV contains Approval Rate column');

    // Report 3: Source Reliability Report (JSON)
    const repSrcJson = await makeRequest(server, 'GET', '/api/reports/sources', null, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert(repSrcJson.status === 200, 'GET /api/reports/sources returns 200 OK');
    assert(repSrcJson.body.data.length === 2, 'Report 3 evaluates both sources');

    // AlienVault has 2 Approved, 1 Pending, 1 Rejected -> decided = 3, approvalRate = (2/3)*100 = 66.7%
    const alienVault = repSrcJson.body.data.find((s) => s.sourceName === 'AlienVault OTX');
    assert(alienVault.totalSubmissions === 4, 'AlienVault total submissions = 4');
    assert(alienVault.approvedCount === 2, 'AlienVault approved count = 2');
    assert(alienVault.rejectedCount === 1, 'AlienVault rejected count = 1');
    assert(alienVault.approvalRatePercent === 66.7, 'AlienVault calculated approval rate is 66.7%');
    assert(alienVault.reliabilityRating === 'Moderate Reliability', 'AlienVault reliability rating calculated as Moderate Reliability');

    // Report 3: Source Reliability Report (CSV Export)
    const repSrcCsv = await makeRequest(server, 'GET', '/api/reports/sources?format=csv', null, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert(repSrcCsv.status === 200, 'Report 3 CSV export returns 200 OK');
    assert(repSrcCsv.headers['content-type'].includes('text/csv'), 'Report 3 returns text/csv content-type');
    assert(repSrcCsv.raw.includes('Reliability Rating'), 'Report 3 CSV contains Reliability Rating header');

    // Report 4: Analyst Activity Report (JSON)
    const repAnaJson = await makeRequest(server, 'GET', '/api/reports/analysts', null, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert(repAnaJson.status === 200, 'GET /api/reports/analysts returns 200 OK');
    assert(repAnaJson.body.data.length >= 2, 'Report 4 groups activities across analysts');
    const aliceData = repAnaJson.body.data.find((a) => a.name === 'Alice Analyst');
    assert(aliceData.totalActions === 3, 'Alice logged 3 actions in the audit report');
    assert(aliceData.submissionsLogged === 3, 'Alice logged 3 submissions');

    // Report 4: Analyst Activity Report (CSV Export)
    const repAnaCsv = await makeRequest(server, 'GET', '/api/reports/analysts?format=csv', null, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert(repAnaCsv.status === 200, 'Report 4 CSV export returns 200 OK');
    assert(repAnaCsv.headers['content-type'].includes('text/csv'), 'Report 4 returns text/csv content-type');
    assert(repAnaCsv.raw.includes('Submissions Logged'), 'Report 4 CSV contains Submissions Logged header');

  } finally {
    server.close();
  }

  console.log('--- TEST SUMMARY ---');
  console.log(`Passed: ${passed}, Failed: ${failed}`);
  if (failed > 0) {
    process.exit(1);
  } else {
    console.log('ALL PHASE 7 TESTS PASSED SUCCESSFULLY!');
  }
}

runTests();
