/**
 * Threat Intelligence Management Test Suite (Jest & Supertest)
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

describe('Threat Intelligence Management APIs', () => {
  let analystToken;
  let analystUser;
  let otherAnalystToken;
  let defaultSource;

  beforeEach(async () => {
    analystUser = await User.create({
      name: 'Alice Analyst',
      email: 'alice@intel.local',
      password: 'Password123!',
      role: 'analyst',
    });

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'alice@intel.local', password: 'Password123!' });
    analystToken = loginRes.body.token;

    const otherUser = await User.create({
      name: 'Bob Analyst',
      email: 'bob@intel.local',
      password: 'Password123!',
      role: 'analyst',
    });

    const otherLogin = await request(app)
      .post('/api/auth/login')
      .send({ email: 'bob@intel.local', password: 'Password123!' });
    otherAnalystToken = otherLogin.body.token;

    defaultSource = await Source.create({
      name: 'AlienVault OTX',
      description: 'Open Threat Exchange Community Feed',
      contact: 'otx@alienvault.com',
    });
  });

  describe('POST /api/threats - Threat Submissions & Validation', () => {
    it('should submit a valid IPv4 indicator and default status to Pending', async () => {
      const res = await request(app)
        .post('/api/threats')
        .set('Authorization', `Bearer ${analystToken}`)
        .send({
          indicatorValue: '198.51.100.45',
          indicatorType: 'IP',
          category: 'C2 Server',
          severity: 'Critical',
          description: 'Active Cobalt Strike Command and Control node',
          submissionType: 'Indicator',
          source: defaultSource._id,
        });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('success');
      expect(res.body.data.status).toBe('Pending');
      expect(res.body.data.indicatorValue).toBe('198.51.100.45');
      expect(res.body.data.submittedBy).toBe(analystUser._id);
    });

    it('should submit a valid Domain indicator', async () => {
      const res = await request(app)
        .post('/api/threats')
        .set('Authorization', `Bearer ${analystToken}`)
        .send({
          indicatorValue: 'malicious-c2-domain.com',
          indicatorType: 'Domain',
          category: 'Phishing',
          severity: 'High',
          description: 'Credential harvesting phishing domain',
          submissionType: 'Indicator',
          source: defaultSource._id,
        });

      expect(res.status).toBe(201);
      expect(res.body.data.indicatorValue).toBe('malicious-c2-domain.com');
    });

    it('should submit an Advisory and an Observation submission type', async () => {
      const advRes = await request(app)
        .post('/api/threats')
        .set('Authorization', `Bearer ${analystToken}`)
        .send({
          indicatorValue: 'https://security.intel/advisory-001',
          indicatorType: 'URL',
          category: 'Ransomware',
          severity: 'High',
          description: 'Advisory on Akira ransomware campaign',
          submissionType: 'Advisory',
          source: defaultSource._id,
        });
      expect(advRes.status).toBe(201);
      expect(advRes.body.data.submissionType).toBe('Advisory');

      const obsRes = await request(app)
        .post('/api/threats')
        .set('Authorization', `Bearer ${analystToken}`)
        .send({
          indicatorValue: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
          indicatorType: 'Hash',
          category: 'Trojan',
          severity: 'Medium',
          description: 'Zero-byte SHA256 observation test',
          submissionType: 'Observation',
          source: defaultSource._id,
        });
      expect(obsRes.status).toBe(201);
      expect(obsRes.body.data.submissionType).toBe('Observation');
    });

    it('should reject invalid indicator values with 400 Bad Request', async () => {
      // Invalid IP format
      const ipRes = await request(app)
        .post('/api/threats')
        .set('Authorization', `Bearer ${analystToken}`)
        .send({
          indicatorValue: '999.999.999.999',
          indicatorType: 'IP',
          category: 'C2',
          severity: 'High',
          description: 'Invalid octets test',
          source: defaultSource._id,
        });
      expect(ipRes.status).toBe(400);
      expect(ipRes.body.message).toMatch(/invalid IP address/i);

      // Invalid Domain format
      const domainRes = await request(app)
        .post('/api/threats')
        .set('Authorization', `Bearer ${analystToken}`)
        .send({
          indicatorValue: '-invalid-domain-.',
          indicatorType: 'Domain',
          category: 'Phishing',
          severity: 'Medium',
          description: 'Malformed domain test',
          source: defaultSource._id,
        });
      expect(domainRes.status).toBe(400);

      // Invalid Hash format
      const hashRes = await request(app)
        .post('/api/threats')
        .set('Authorization', `Bearer ${analystToken}`)
        .send({
          indicatorValue: 'not-a-valid-hex-hash',
          indicatorType: 'Hash',
          category: 'Malware',
          severity: 'Low',
          description: 'Malformed hash test',
          source: defaultSource._id,
        });
      expect(hashRes.status).toBe(400);
    });
  });

  describe('GET /api/threats - Threat Intelligence Explorer Visibility', () => {
    beforeEach(async () => {
      // Create one Approved threat
      const approved = await Threat.create({
        indicatorValue: '198.51.100.10',
        indicatorType: 'IP',
        category: 'C2',
        severity: 'Critical',
        description: 'Verified active C2 host',
        submissionType: 'Indicator',
        source: defaultSource._id,
        submittedBy: analystUser._id,
        status: 'Approved',
      });

      // Create one Pending threat
      const pending = await Threat.create({
        indicatorValue: '198.51.100.20',
        indicatorType: 'IP',
        category: 'Scanner',
        severity: 'Low',
        description: 'Unmoderated port scanner',
        submissionType: 'Indicator',
        source: defaultSource._id,
        submittedBy: analystUser._id,
        status: 'Pending',
      });
    });

    it('should strictly return ONLY Approved threats to analysts in general explorer feed', async () => {
      const res = await request(app)
        .get('/api/threats')
        .set('Authorization', `Bearer ${analystToken}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].status).toBe('Approved');
      expect(res.body.data[0].indicatorValue).toBe('198.51.100.10');
    });

    it('should filter threats by indicatorType and severity', async () => {
      const res = await request(app)
        .get('/api/threats?indicatorType=IP&severity=Critical')
        .set('Authorization', `Bearer ${analystToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].severity).toBe('Critical');
    });
  });

  describe('GET /api/threats/my-submissions', () => {
    it('should return all submissions belonging to the logged-in analyst', async () => {
      await Threat.create({
        indicatorValue: '198.51.100.33',
        indicatorType: 'IP',
        category: 'C2',
        severity: 'High',
        description: 'Alice first submission',
        submissionType: 'Indicator',
        source: defaultSource._id,
        submittedBy: analystUser._id,
        status: 'Pending',
      });

      const res = await request(app)
        .get('/api/threats/my-submissions')
        .set('Authorization', `Bearer ${analystToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].indicatorValue).toBe('198.51.100.33');

      // Other analyst sees zero submissions
      const otherRes = await request(app)
        .get('/api/threats/my-submissions')
        .set('Authorization', `Bearer ${otherAnalystToken}`);

      expect(otherRes.status).toBe(200);
      expect(otherRes.body.data.length).toBe(0);
    });
  });

  describe('GET /api/sources', () => {
    it('should list all available intelligence sources', async () => {
      const res = await request(app)
        .get('/api/sources')
        .set('Authorization', `Bearer ${analystToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data[0].name).toBe('AlienVault OTX');
    });
  });
});
