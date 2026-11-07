/**
 * End-to-End Complete Lifecycle Integration Test Suite (Jest & Supertest)
 */

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_jwt_secret_key_12345';
process.env.JWT_EXPIRES_IN = '1h';

const request = require('supertest');
const { app } = require('../server');
const { initMockDb, resetMockDb } = require('./mockDb');
const User = require('../models/User');
const Source = require('../models/Source');

beforeAll(() => {
  initMockDb();
});

beforeEach(async () => {
  resetMockDb();
});

describe('E2E Complete Lifecycle Integration Test Suite', () => {
  it('should successfully execute the full analyst-to-admin workflow', async () => {
    // -----------------------------------------------------------------
    // Step 0: Seed Pre-requisite Intel Source & Admin User
    // -----------------------------------------------------------------
    const source = await Source.create({
      name: 'US-CERT Alerts',
      description: 'Official US Cybersecurity Feed',
      contact: 'cert@us-cert.gov',
    });

    await User.create({
      name: 'System Admin',
      email: 'admin@portal.local',
      password: 'AdminPassword123!',
      role: 'admin',
    });

    // -----------------------------------------------------------------
    // Step 1: Analyst Registration
    // -----------------------------------------------------------------
    const regRes = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Elena Rostova',
        email: 'elena@intel.local',
        password: 'AnalystPassword123!',
      });
    expect(regRes.status).toBe(201);
    expect(regRes.body.token).toBeDefined();
    expect(regRes.body.user.role).toBe('analyst');
    const analystToken = regRes.body.token;

    // -----------------------------------------------------------------
    // Step 2: Analyst Profile Verification
    // -----------------------------------------------------------------
    const meRes = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${analystToken}`);
    expect(meRes.status).toBe(200);
    expect(meRes.body.user.email).toBe('elena@intel.local');

    // -----------------------------------------------------------------
    // Step 3: Threat Ingestion by Analyst
    // -----------------------------------------------------------------
    const ipRes = await request(app)
      .post('/api/threats')
      .set('Authorization', `Bearer ${analystToken}`)
      .send({
        indicatorValue: '198.51.100.99',
        indicatorType: 'IP',
        category: 'Ransomware',
        severity: 'Critical',
        description: 'LockBit 3.0 Ransomware Primary Ingress Node',
        submissionType: 'Indicator',
        source: source._id,
      });
    expect(ipRes.status).toBe(201);
    expect(ipRes.body.data.status).toBe('Pending');
    const ipThreatId = ipRes.body.data._id;

    const domainRes = await request(app)
      .post('/api/threats')
      .set('Authorization', `Bearer ${analystToken}`)
      .send({
        indicatorValue: 'dark-nexus-payloads.org',
        indicatorType: 'Domain',
        category: 'Malware Dropper',
        severity: 'High',
        description: 'Secondary malware payload delivery domain',
        submissionType: 'Advisory',
        source: source._id,
      });
    expect(domainRes.status).toBe(201);
    expect(domainRes.body.data.status).toBe('Pending');
    const domainThreatId = domainRes.body.data._id;

    // -----------------------------------------------------------------
    // Step 4: Privacy & Isolation Enforcement
    // -----------------------------------------------------------------
    // Pending threats are hidden from the public/analyst explorer feed
    const explorerRes = await request(app)
      .get('/api/threats')
      .set('Authorization', `Bearer ${analystToken}`);
    expect(explorerRes.status).toBe(200);
    expect(explorerRes.body.data.length).toBe(0);

    // Analyst sees both pending items in their personal submissions history
    const mySubmissionsRes = await request(app)
      .get('/api/threats/my-submissions')
      .set('Authorization', `Bearer ${analystToken}`);
    expect(mySubmissionsRes.status).toBe(200);
    expect(mySubmissionsRes.body.data.length).toBe(2);

    // Analyst is denied access to admin moderation queue
    const forbiddenRes = await request(app)
      .get('/api/admin/pending')
      .set('Authorization', `Bearer ${analystToken}`);
    expect(forbiddenRes.status).toBe(403);

    // -----------------------------------------------------------------
    // Step 5: Administrator Login & Queue Triage
    // -----------------------------------------------------------------
    const adminLogin = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'admin@portal.local',
        password: 'AdminPassword123!',
      });
    expect(adminLogin.status).toBe(200);
    const adminToken = adminLogin.body.token;

    const queueRes = await request(app)
      .get('/api/admin/pending')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(queueRes.status).toBe(200);
    expect(queueRes.body.data.length).toBe(2);

    // -----------------------------------------------------------------
    // Step 6: Triage Decisions & Moderation
    // -----------------------------------------------------------------
    // Approve IP threat
    const approveRes = await request(app)
      .put(`/api/admin/threats/${ipThreatId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reviewComment: 'Verified active C2 beacon with sandbox telemetry' });
    expect(approveRes.status).toBe(200);
    expect(approveRes.body.data.status).toBe('Approved');

    // Reject Domain threat
    const rejectRes = await request(app)
      .put(`/api/admin/threats/${domainThreatId}/reject`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reviewComment: 'Domain expired and currently parked with zero threat activity' });
    expect(rejectRes.status).toBe(200);
    expect(rejectRes.body.data.status).toBe('Rejected');

    // Re-review guard prevents accidental double processing
    const duplicateApprove = await request(app)
      .put(`/api/admin/threats/${ipThreatId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reviewComment: 'Duplicate approval attempt' });
    expect(duplicateApprove.status).toBe(400);

    // -----------------------------------------------------------------
    // Step 7: Public Explorer Feed Verification
    // -----------------------------------------------------------------
    const updatedExplorer = await request(app)
      .get('/api/threats')
      .set('Authorization', `Bearer ${analystToken}`);
    expect(updatedExplorer.status).toBe(200);
    expect(updatedExplorer.body.data.length).toBe(1);
    expect(updatedExplorer.body.data[0]._id).toBe(ipThreatId);
    expect(updatedExplorer.body.data[0].status).toBe('Approved');

    // -----------------------------------------------------------------
    // Step 8: Dashboard Statistics Verification
    // -----------------------------------------------------------------
    const statsRes = await request(app)
      .get('/api/dashboard/stats')
      .set('Authorization', `Bearer ${analystToken}`);
    expect(statsRes.status).toBe(200);
    expect(statsRes.body.data.summary.totalSubmissions).toBe(2);
    expect(statsRes.body.data.summary.totalApproved).toBe(1);
    expect(statsRes.body.data.summary.totalPending).toBe(0);
    expect(statsRes.body.data.summary.totalRejected).toBe(1);

    // -----------------------------------------------------------------
    // Step 9: Mandatory Reports & CSV Downloads
    // -----------------------------------------------------------------
    const csvReport = await request(app)
      .get('/api/reports/submissions?format=csv')
      .set('Authorization', `Bearer ${analystToken}`);
    expect(csvReport.status).toBe(200);
    expect(csvReport.headers['content-type']).toMatch(/text\/csv/);
    expect(csvReport.text).toContain('198.51.100.99');

    // -----------------------------------------------------------------
    // Step 10: Credential Update & Re-login
    // -----------------------------------------------------------------
    const changePassRes = await request(app)
      .put('/api/auth/change-password')
      .set('Authorization', `Bearer ${analystToken}`)
      .send({
        currentPassword: 'AnalystPassword123!',
        newPassword: 'NewSecurePassword2026!',
      });
    expect(changePassRes.status).toBe(200);

    // Old password rejected
    const oldLoginFail = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'elena@intel.local',
        password: 'AnalystPassword123!',
      });
    expect(oldLoginFail.status).toBe(401);

    // New password succeeds
    const newLoginSuccess = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'elena@intel.local',
        password: 'NewSecurePassword2026!',
      });
    expect(newLoginSuccess.status).toBe(200);
    expect(newLoginSuccess.body.token).toBeDefined();
  });
});
