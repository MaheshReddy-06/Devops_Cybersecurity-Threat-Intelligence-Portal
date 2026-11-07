/**
 * Dashboard Analytics, Activities & Reports Test Suite (Jest & Supertest)
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
const Activity = require('../models/Activity');

beforeAll(() => {
  initMockDb();
});

beforeEach(async () => {
  resetMockDb();
});

describe('Dashboard Analytics, Activities & Mandatory Reports', () => {
  let analystToken;
  let adminToken;
  let analystUser;
  let adminUser;
  let source;

  beforeEach(async () => {
    analystUser = await User.create({
      name: 'Alice Analyst',
      email: 'alice@intel.local',
      password: 'Password123!',
      role: 'analyst',
    });
    const aLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'alice@intel.local', password: 'Password123!' });
    analystToken = aLogin.body.token;

    adminUser = await User.create({
      name: 'Chief Admin',
      email: 'admin@intel.local',
      password: 'Password123!',
      role: 'admin',
    });
    const admLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@intel.local', password: 'Password123!' });
    adminToken = admLogin.body.token;

    source = await Source.create({
      name: 'CISA Alert Feed',
      description: 'Cybersecurity and Infrastructure Security Agency',
      contact: 'cisa@dhs.gov',
    });

    // Seed test threats
    const t1 = await Threat.create({
      indicatorValue: '198.51.100.10',
      indicatorType: 'IP',
      category: 'C2',
      severity: 'Critical',
      submissionType: 'Indicator',
      source: source._id,
      submittedBy: analystUser._id,
      status: 'Approved',
    });

    const t2 = await Threat.create({
      indicatorValue: 'malware-cdn.org',
      indicatorType: 'Domain',
      category: 'Phishing',
      severity: 'High',
      submissionType: 'Indicator',
      source: source._id,
      submittedBy: analystUser._id,
      status: 'Pending',
    });

    // Seed activities
    await Activity.create({
      user: analystUser._id,
      threat: t1._id,
      action: 'SUBMIT_THREAT',
      description: 'Submitted IP indicator',
    });
    await Activity.create({
      user: adminUser._id,
      threat: t1._id,
      action: 'APPROVE_THREAT',
      description: 'Approved IP indicator',
    });
  });

  describe('GET /api/dashboard/stats', () => {
    it('should aggregate and return dashboard metrics from MongoDB', async () => {
      const res = await request(app)
        .get('/api/dashboard/stats')
        .set('Authorization', `Bearer ${analystToken}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data.summary.totalSubmissions).toBe(2);
      expect(res.body.data.summary.totalApproved).toBe(1);
      expect(res.body.data.summary.totalPending).toBe(1);
      expect(res.body.data.severityBreakdown.criticalThreats).toBe(1);
      expect(res.body.data.severityBreakdown.highThreats).toBe(1);
      expect(res.body.data.indicatorTypeDistribution.IP).toBe(1);
    });
  });

  describe('GET /api/activities', () => {
    it('should show only own activities to analysts', async () => {
      const res = await request(app)
        .get('/api/activities')
        .set('Authorization', `Bearer ${analystToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].action).toBe('SUBMIT_THREAT');
    });

    it('should show all system activities to administrators', async () => {
      const res = await request(app)
        .get('/api/activities')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(2);
    });
  });

  describe('Mandatory Reports & CSV Exports', () => {
    it('Report 1: Threat Submission Report (JSON and CSV)', async () => {
      const jsonRes = await request(app)
        .get('/api/reports/submissions')
        .set('Authorization', `Bearer ${analystToken}`);
      expect(jsonRes.status).toBe(200);
      expect(jsonRes.body.status).toBe('success');
      expect(jsonRes.body.summary.totalSubmissions).toBe(2);
      expect(jsonRes.body.data.length).toBe(2);

      const csvRes = await request(app)
        .get('/api/reports/submissions?format=csv')
        .set('Authorization', `Bearer ${analystToken}`);
      expect(csvRes.status).toBe(200);
      expect(csvRes.headers['content-type']).toMatch(/text\/csv/);
      expect(csvRes.text).toContain('Indicator Value');
    });

    it('Report 2: Indicator Summary Report (JSON and CSV)', async () => {
      const jsonRes = await request(app)
        .get('/api/reports/indicators')
        .set('Authorization', `Bearer ${analystToken}`);
      expect(jsonRes.status).toBe(200);
      expect(jsonRes.body.status).toBe('success');
      expect(jsonRes.body.summary.grandTotalIndicators).toBe(2);
      expect(jsonRes.body.data.length).toBeGreaterThanOrEqual(1);

      const csvRes = await request(app)
        .get('/api/reports/indicators?format=csv')
        .set('Authorization', `Bearer ${analystToken}`);
      expect(csvRes.status).toBe(200);
      expect(csvRes.headers['content-type']).toMatch(/text\/csv/);
      expect(csvRes.text).toContain('Indicator Type');
    });

    it('Report 3: Source Reliability Report (JSON and CSV)', async () => {
      const jsonRes = await request(app)
        .get('/api/reports/sources')
        .set('Authorization', `Bearer ${analystToken}`);
      expect(jsonRes.status).toBe(200);
      expect(jsonRes.body.status).toBe('success');
      expect(jsonRes.body.data.length).toBe(1);
      expect(jsonRes.body.data[0].sourceName).toBe('CISA Alert Feed');

      const csvRes = await request(app)
        .get('/api/reports/sources?format=csv')
        .set('Authorization', `Bearer ${analystToken}`);
      expect(csvRes.status).toBe(200);
      expect(csvRes.headers['content-type']).toMatch(/text\/csv/);
      expect(csvRes.text).toContain('Reliability Rating');
    });

    it('Report 4: Analyst Activity Report (JSON and CSV)', async () => {
      const jsonRes = await request(app)
        .get('/api/reports/analysts')
        .set('Authorization', `Bearer ${analystToken}`);
      expect(jsonRes.status).toBe(200);
      expect(jsonRes.body.status).toBe('success');
      expect(jsonRes.body.summary.totalSystemActions).toBe(2);
      expect(jsonRes.body.data.length).toBeGreaterThanOrEqual(1);

      const csvRes = await request(app)
        .get('/api/reports/analysts?format=csv')
        .set('Authorization', `Bearer ${analystToken}`);
      expect(csvRes.status).toBe(200);
      expect(csvRes.headers['content-type']).toMatch(/text\/csv/);
      expect(csvRes.text).toContain('Analyst Name');
    });
  });
});
