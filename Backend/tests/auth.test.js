/**
 * Authentication and Authorization Test Suite (Jest & Supertest)
 */

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_jwt_secret_key_12345';
process.env.JWT_EXPIRES_IN = '1h';

const request = require('supertest');
const { app } = require('../server');
const { initMockDb, resetMockDb, store } = require('./mockDb');
const User = require('../models/User');

beforeAll(() => {
  initMockDb();
});

beforeEach(() => {
  resetMockDb();
});

describe('Authentication & Authorization APIs', () => {
  describe('POST /api/auth/register', () => {
    it('should register a new security analyst with valid data', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Alice Analyst',
          email: 'alice@intel.local',
          password: 'Password123!',
        });

      expect(res.status).toBe(201);
      expect(res.body.status).toBe('success');
      expect(res.body.token).toBeDefined();
      expect(res.body.user).toBeDefined();
      expect(res.body.user.role).toBe('analyst');
      expect(res.body.user.password).toBeUndefined();
    });

    it('should prevent public registration from assigning admin role', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Mallory Malicious',
          email: 'mallory@hack.local',
          password: 'Password123!',
          role: 'admin', // Attempt role escalation
        });

      expect(res.status).toBe(201);
      expect(res.body.user.role).toBe('analyst'); // Enforced analyst role
    });

    it('should reject registration if email is already in use', async () => {
      await User.create({
        name: 'Existing User',
        email: 'alice@intel.local',
        password: 'Password123!',
        role: 'analyst',
      });

      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Duplicate Alice',
          email: 'alice@intel.local',
          password: 'Password123!',
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/already exists/i);
    });

    it('should reject registration with password shorter than 6 characters', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          name: 'Short Pass',
          email: 'short@intel.local',
          password: '123',
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/at least 6 characters/i);
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      await User.create({
        name: 'Bob Analyst',
        email: 'bob@intel.local',
        password: 'Password123!',
        role: 'analyst',
      });
    });

    it('should authenticate user and return token with valid credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'bob@intel.local',
          password: 'Password123!',
        });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.token).toBeDefined();
      expect(res.body.user.email).toBe('bob@intel.local');
    });

    it('should reject login with incorrect password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'bob@intel.local',
          password: 'WrongPassword!',
        });

      expect(res.status).toBe(401);
      expect(res.body.message).toMatch(/invalid email or password/i);
    });

    it('should reject login with non-existent email', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'unknown@intel.local',
          password: 'Password123!',
        });

      expect(res.status).toBe(401);
      expect(res.body.message).toMatch(/invalid email or password/i);
    });
  });

  describe('GET /api/auth/me', () => {
    let token;
    let userId;

    beforeEach(async () => {
      const user = await User.create({
        name: 'Charlie Analyst',
        email: 'charlie@intel.local',
        password: 'Password123!',
        role: 'analyst',
      });
      userId = user._id;

      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'charlie@intel.local',
          password: 'Password123!',
        });
      token = loginRes.body.token;
    });

    it('should return authenticated user profile when valid Bearer token provided', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');
      expect(res.body.user.email).toBe('charlie@intel.local');
      expect(res.body.user.password).toBeUndefined();
    });

    it('should reject request without Authorization header', async () => {
      const res = await request(app).get('/api/auth/me');

      expect(res.status).toBe(401);
      expect(res.body.message).toMatch(/not authorized/i);
    });

    it('should reject request with an invalid Bearer token', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid.token.payload');

      expect(res.status).toBe(401);
      expect(res.body.message).toMatch(/not authorized/i);
    });
  });

  describe('PUT /api/auth/change-password', () => {
    let token;

    beforeEach(async () => {
      await User.create({
        name: 'David Analyst',
        email: 'david@intel.local',
        password: 'OldPassword123!',
        role: 'analyst',
      });

      const loginRes = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'david@intel.local',
          password: 'OldPassword123!',
        });
      token = loginRes.body.token;
    });

    it('should successfully update user password', async () => {
      const res = await request(app)
        .put('/api/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({
          currentPassword: 'OldPassword123!',
          newPassword: 'NewPassword2026!',
        });

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('success');

      // Verify old password fails
      const oldLogin = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'david@intel.local',
          password: 'OldPassword123!',
        });
      expect(oldLogin.status).toBe(401);

      // Verify new password succeeds
      const newLogin = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'david@intel.local',
          password: 'NewPassword2026!',
        });
      expect(newLogin.status).toBe(200);
      expect(newLogin.body.token).toBeDefined();
    });
  });
});
