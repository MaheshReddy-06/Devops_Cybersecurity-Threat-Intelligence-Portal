/**
 * Administrator Moderation & Role Authorization Test Suite (Jest & Supertest)
 */

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_jwt_secret_key_12345';
process.env.JWT_EXPIRES_IN = '1h';

const request = require('supertest');
const { app } = require('../server');
const { initMockDb, resetMockDb, store } = require('./mockDb');
const User = require('../models/User');
const Threat = require('../models/Threat');
const Source = require('../models/Source');

beforeAll(() => {
  initMockDb();
});

beforeEach(async () => {
  resetMockDb();
});

describe('Admin Moderation & Role-Based Access Control', () => {
  let analystToken;
  let adminToken;
  let adminUser;
  let analystUser;
  let defaultSource;
  let pendingThreat;

  beforeEach(async () => {
    // Create Analyst
    analystUser = await User.create({
      name: 'Alice Analyst',
      email: 'alice@intel.local',
      password: 'Password123!',
      role: 'analyst',
    });
    const analystLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'alice@intel.local', password: 'Password123!' });
    analystToken = analystLogin.body.token;

    // Create Admin
    adminUser = await User.create({
      name: 'System Admin',
      email: 'admin@intel.local',
      password: 'AdminPassword123!',
      role: 'admin',
    });
    const adminLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@intel.local', password: 'AdminPassword123!' });
    adminToken = adminLogin.body.token;

    // Create Source & Pending Threat
    defaultSource = await Source.create({
      name: 'AlienVault OTX',
      description: 'OTX Feed',
      contact: 'feed@alienvault.com',
    });

    pendingThreat = await Threat.create({
      indicatorValue: '203.0.113.50',
      indicatorType: 'IP',
      category: 'Ransomware',
      severity: 'Critical',
      description: 'Active LockBit affiliate staging node',
      submissionType: 'Indicator',
      source: defaultSource._id,
      submittedBy: analystUser._id,
      status: 'Pending',
    });
  });

  describe('Role Authorization Guard (Analyst vs Admin)', () => {
    it('should deny ordinary analysts access to admin endpoints with 403 Forbidden', async () => {
      const resPending = await request(app)
        .get('/api/admin/pending')
        .set('Authorization', `Bearer ${analystToken}`);
      expect(resPending.status).toBe(403);
      expect(resPending.body.message).toMatch(/not authorized/i);

      const resApprove = await request(app)
        .put(`/api/admin/threats/${pendingThreat._id}/approve`)
        .set('Authorization', `Bearer ${analystToken}`)
        .send({ reviewComment: 'Unauthorized approval attempt' });
      expect(resApprove.status).toBe(403);

      const resReject = await request(app)
        .put(`/api/admin/threats/${pendingThreat._id}/reject`)
        .set('Authorization', `Bearer ${analystToken}`)
        .send({ reviewComment: 'Unauthorized rejection attempt' });
      expect(resReject.status).toBe(403);
    });

    it('should reject unauthenticated requests to admin endpoints with 401 Unauthorized', async () => {
      const res = await request(app).get('/api/admin/pending');
      expect(res.status).toBe(401);
    });
  });

  describe('Admin Moderation Workflow', () => {
    it('should allow admin to retrieve pending triage queue', async () => {
      const res = await request(app)
        .get('/api/admin/pending')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.count).toBe(1);
      expect(res.body.data[0]._id).toBe(pendingThreat._id);
    });

    it('should approve a pending threat submission and record review details', async () => {
      const res = await request(app)
        .put(`/api/admin/threats/${pendingThreat._id}/approve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reviewComment: 'Verified IOC with telemetry indicators' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data.status).toBe('Approved');
      expect(res.body.data.reviewedBy).toBe(adminUser._id);
      expect(res.body.data.reviewComment).toBe('Verified IOC with telemetry indicators');

      // Verify audit activity recorded
      expect(store.activities.some((a) => a.action === 'APPROVE_THREAT')).toBe(true);
    });

    it('should prevent accidental re-approval of an already processed threat without reReview flag', async () => {
      // First approval
      await request(app)
        .put(`/api/admin/threats/${pendingThreat._id}/approve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reviewComment: 'Initial review' });

      // Second approval attempt should be guarded
      const secondRes = await request(app)
        .put(`/api/admin/threats/${pendingThreat._id}/approve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reviewComment: 'Duplicate approval attempt' });

      expect(secondRes.status).toBe(400);
      expect(secondRes.body.message).toMatch(/already processed/i);
    });

    it('should reject a pending threat submission and record rejection reason', async () => {
      const res = await request(app)
        .put(`/api/admin/threats/${pendingThreat._id}/reject`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reviewComment: 'False positive IP belonging to a known CDN' });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data.status).toBe('Rejected');
      expect(res.body.data.reviewedBy).toBe(adminUser._id);

      // Verify audit activity recorded
      expect(store.activities.some((a) => a.action === 'REJECT_THREAT')).toBe(true);
    });

    it('should retrieve list of previously moderated threats in reviewed history', async () => {
      // Approve threat first
      await request(app)
        .put(`/api/admin/threats/${pendingThreat._id}/approve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reviewComment: 'Verified' });

      const res = await request(app)
        .get('/api/admin/reviewed')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].status).toBe('Approved');
    });
  });
});
