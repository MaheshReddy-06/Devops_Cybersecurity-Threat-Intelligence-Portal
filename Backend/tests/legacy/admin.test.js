/**
 * Comprehensive Automated Test Suite for Phase 6: Threat Review and Moderation APIs
 */

const express = require('express');
const http = require('http');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');

process.env.JWT_SECRET = 'test_admin_jwt_secret_key_12345';
process.env.JWT_EXPIRES_IN = '1h';

const User = require('../models/User');
const Threat = require('../models/Threat');
const Source = require('../models/Source');
const Activity = require('../models/Activity');

const adminRoutes = require('../routes/adminRoutes');
const threatRoutes = require('../routes/threatRoutes');

const app = express();
app.use(express.json());
app.use('/api/threats', threatRoutes);
app.use('/api/admin', adminRoutes);

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
Threat.countDocuments = async function (query) {
  let list = Array.from(store.threats.values());
  if (query.status) {
    if (typeof query.status === 'object' && query.status.$in) {
      list = list.filter((t) => query.status.$in.includes(t.status));
    } else {
      list = list.filter((t) => t.status === query.status);
    }
  }
  return list.length;
};

Threat.find = function (query) {
  let list = Array.from(store.threats.values());
  if (query.status) {
    if (typeof query.status === 'object' && query.status.$in) {
      list = list.filter((t) => query.status.$in.includes(t.status));
    } else {
      list = list.filter((t) => t.status === query.status);
    }
  }

  const chain = {
    populate: function () {
      return chain;
    },
    sort: function () {
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
      return resolve(threat);
    },
  };
  return chain;
};

async function runTests() {
  console.log('--- STARTING PHASE 6: THREAT MODERATION & REVIEW TESTS ---');
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

  // 1. Seed Analyst and Admin users
  const analystId = new mongoose.Types.ObjectId().toString();
  const analyst = { _id: analystId, name: 'Alice Analyst', email: 'alice@threat.org', role: 'analyst' };
  store.users.set(analystId, analyst);
  const analystToken = jwt.sign({ id: analystId, role: 'analyst' }, process.env.JWT_SECRET);

  const adminId = new mongoose.Types.ObjectId().toString();
  const admin = { _id: adminId, name: 'Dave Admin', email: 'dave.admin@threat.org', role: 'admin' };
  store.users.set(adminId, admin);
  const adminToken = jwt.sign({ id: adminId, role: 'admin' }, process.env.JWT_SECRET);

  // 2. Seed Source
  const sourceId = new mongoose.Types.ObjectId().toString();
  store.sources.set(sourceId, { _id: sourceId, name: 'CISA Feed' });

  // 3. Seed Threat submissions
  function createThreatDoc(indicatorValue, type, status = 'Pending') {
    const id = new mongoose.Types.ObjectId().toString();
    const doc = {
      _id: id,
      indicatorValue,
      indicatorType: type,
      category: 'Ransomware',
      severity: 'Critical',
      description: `Test submission for ${indicatorValue}`,
      submissionType: 'Indicator',
      source: sourceId,
      submittedBy: analystId,
      status,
      reviewedBy: null,
      reviewComment: '',
      createdAt: new Date(),
      updatedAt: new Date(),
      save: async function () {
        this.updatedAt = new Date();
        store.threats.set(this._id, this);
        return this;
      },
      populate: async function () {
        return this;
      },
    };
    store.threats.set(id, doc);
    return doc;
  }

  const threatPending1 = createThreatDoc('198.51.100.1', 'IP', 'Pending');
  const threatPending2 = createThreatDoc('malicious-c2.org', 'Domain', 'Pending');
  const threatAlreadyApproved = createThreatDoc('https://drop.net/payload.exe', 'URL', 'Approved');

  const server = app.listen(0);

  try {
    // Test 1: Analyst access to admin moderation queue denied (403)
    const analystPending = await makeRequest(server, 'GET', '/api/admin/pending', null, {
      Authorization: `Bearer ${analystToken}`,
    });
    assert(analystPending.status === 403, 'Analyst denied access to GET /api/admin/pending (403 Forbidden)');

    // Test 2: Analyst access to approve endpoint denied (403)
    const analystApprove = await makeRequest(server, 'PUT', `/api/admin/threats/${threatPending1._id}/approve`, {}, {
      Authorization: `Bearer ${analystToken}`,
    });
    assert(analystApprove.status === 403, 'Analyst denied access to PUT approve endpoint (403 Forbidden)');

    // Test 3: Analyst access to reject endpoint denied (403)
    const analystReject = await makeRequest(server, 'PUT', `/api/admin/threats/${threatPending1._id}/reject`, {}, {
      Authorization: `Bearer ${analystToken}`,
    });
    assert(analystReject.status === 403, 'Analyst denied access to PUT reject endpoint (403 Forbidden)');

    // Test 4: Unauthenticated access denied (401)
    const unauthPending = await makeRequest(server, 'GET', '/api/admin/pending');
    assert(unauthPending.status === 401, 'Unauthenticated request to admin route returns 401 Unauthorized');

    // Test 5: Admin retrieves all pending submissions (200)
    const adminPending = await makeRequest(server, 'GET', '/api/admin/pending', null, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert(adminPending.status === 200, 'Admin retrieves pending submissions (200 OK)');
    assert(adminPending.body.totalCount === 2, 'Pending queue correctly contains 2 items');

    // Test 6: Admin views single submission details (200)
    const adminView = await makeRequest(server, 'GET', `/api/admin/threats/${threatPending1._id}`, null, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert(adminView.status === 200, 'Admin views individual submission details (200 OK)');
    assert(adminView.body.data.indicatorValue === '198.51.100.1', 'Correct threat data returned');

    // Test 7: Admin views non-existent threat (404)
    const fakeId = new mongoose.Types.ObjectId().toString();
    const admin404 = await makeRequest(server, 'GET', `/api/admin/threats/${fakeId}`, null, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert(admin404.status === 404, 'Admin viewing non-existent threat returns 404 Not Found');

    // Test 8: Admin views invalid ID format (400)
    const admin400 = await makeRequest(server, 'GET', '/api/admin/threats/invalid-id-format', null, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert(admin400.status === 400, 'Invalid ID format returns 400 Bad Request');

    // Test 9: Admin approves a pending submission
    const initialActivityCount = store.activities.length;
    const approveRes = await makeRequest(server, 'PUT', `/api/admin/threats/${threatPending1._id}/approve`, {
      reviewComment: 'Verified with VirusTotal and AlienVault telemetry. Approved.',
    }, {
      Authorization: `Bearer ${adminToken}`,
    });

    assert(approveRes.status === 200, 'Admin approves submission returns 200 OK');
    assert(approveRes.body.data.status === 'Approved', 'Threat status updated to Approved');
    assert(approveRes.body.data.reviewedBy === adminId, 'Reviewer recorded as admin user ID');
    assert(approveRes.body.data.reviewComment.includes('Verified with VirusTotal'), 'Moderation comment saved');

    // Verify Activity record created for Approval
    assert(store.activities.length === initialActivityCount + 1, 'Activity audit record created for approval');
    const latestActivity = store.activities[store.activities.length - 1];
    assert(latestActivity.action === 'APPROVE_THREAT', 'Activity action is APPROVE_THREAT');
    assert(latestActivity.user === adminId, 'Activity records reviewer user');

    // Test 10: Prevent approving an already reviewed submission without reReview flag (400)
    const reApproveAttempt = await makeRequest(server, 'PUT', `/api/admin/threats/${threatPending1._id}/approve`, {
      reviewComment: 'Attempting duplicate approval',
    }, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert(reApproveAttempt.status === 400, 'Re-approving already processed threat returns 400 Bad Request');
    assert(reApproveAttempt.body.message.includes('already processed submission'), 'Error explains re-review guard');

    // Test 11: Admin rejects a pending submission
    const rejectRes = await makeRequest(server, 'PUT', `/api/admin/threats/${threatPending2._id}/reject`, {
      reviewComment: 'False positive: Domain belongs to verified CDN infrastructure.',
    }, {
      Authorization: `Bearer ${adminToken}`,
    });

    assert(rejectRes.status === 200, 'Admin rejects submission returns 200 OK');
    assert(rejectRes.body.data.status === 'Rejected', 'Threat status updated to Rejected');
    assert(rejectRes.body.data.reviewedBy === adminId, 'Reviewer recorded as admin user ID');
    assert(rejectRes.body.data.reviewComment.includes('False positive'), 'Rejection comment saved');

    // Verify Activity record created for Rejection
    const rejectActivity = store.activities[store.activities.length - 1];
    assert(rejectActivity.action === 'REJECT_THREAT', 'Activity action is REJECT_THREAT');

    // Test 12: Prevent rejecting an already reviewed submission without reReview flag (400)
    const reRejectAttempt = await makeRequest(server, 'PUT', `/api/admin/threats/${threatPending2._id}/reject`, {
      reviewComment: 'Duplicate reject attempt',
    }, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert(reRejectAttempt.status === 400, 'Re-rejecting already processed threat returns 400 Bad Request');

    // Test 13: Explicit re-review with reReview: true allowed
    const overrideRes = await makeRequest(server, 'PUT', `/api/admin/threats/${threatPending2._id}/approve`, {
      reReview: true,
      reviewComment: 'Re-reviewed after secondary analysis. Upgrading to Approved.',
    }, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert(overrideRes.status === 200, 'Re-review with explicit reReview: true succeeds');
    assert(overrideRes.body.data.status === 'Approved', 'Status successfully updated during re-review');

    // Test 14: Admin views previously reviewed submissions (GET /api/admin/reviewed)
    const reviewedList = await makeRequest(server, 'GET', '/api/admin/reviewed', null, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert(reviewedList.status === 200, 'Admin retrieves reviewed history returns 200 OK');
    assert(reviewedList.body.totalCount >= 2, 'Reviewed list includes processed threats');

  } finally {
    server.close();
  }

  console.log('--- TEST SUMMARY ---');
  console.log(`Passed: ${passed}, Failed: ${failed}`);
  if (failed > 0) {
    process.exit(1);
  } else {
    console.log('ALL PHASE 6 TESTS PASSED SUCCESSFULLY!');
  }
}

runTests();
