/**
 * Automated Test Suite for User Authentication and Authorization
 * Tests:
 * 1. User registration (valid analyst)
 * 2. Role escalation protection (public cannot register as admin)
 * 3. Duplicate email detection
 * 4. Password validation (minimum length requirement)
 * 5. Login verification (successful login & token issue)
 * 6. Invalid password rejection
 * 7. Non-existent user rejection
 * 8. Protected route access (GET /api/auth/me without token -> 401)
 * 9. Protected route access (GET /api/auth/me with invalid token -> 401)
 * 10. Protected route access (GET /api/auth/me with valid Bearer token -> 200)
 * 11. Role-based authorization middleware (forbidden role -> 403, allowed role -> next)
 */

const express = require('express');
const http = require('http');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Set test environment variables
process.env.JWT_SECRET = 'test_jwt_secret_key_12345';
process.env.JWT_EXPIRES_IN = '1h';

const User = require('../models/User');
const authRoutes = require('../routes/authRoutes');
const { protect, authorize } = require('../middleware/auth');

// Create an isolated Express application for testing
const app = express();
app.use(express.json());
app.use('/api/auth', authRoutes);

// Add an admin-only test route to test the authorize middleware
app.get('/api/auth/admin-only', protect, authorize('admin'), (req, res) => {
  res.status(200).json({ status: 'success', message: 'Welcome Admin' });
});

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

// In-memory test store simulating MongoDB collection
const userStore = new Map();

// Mock Mongoose User methods
User.findOne = async function (filter) {
  if (filter.email) {
    for (const user of userStore.values()) {
      if (user.email === filter.email.toLowerCase()) {
        return user;
      }
    }
  }
  return null;
};

User.findById = function (id) {
  return {
    select: async function (fields) {
      const user = userStore.get(String(id));
      if (!user) return null;
      const copy = { ...user };
      if (fields && fields.includes('-password')) {
        delete copy.password;
      }
      return copy;
    },
  };
};

User.create = async function (data) {
  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(data.password, salt);

  const id = 'mock_id_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
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
  };

  userStore.set(id, created);
  return created;
};

async function runTests() {
  console.log('--- STARTING AUTHENTICATION & AUTHORIZATION TESTS ---');
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

  const server = app.listen(0); // bind to random available port

  try {
    // 1. Valid Registration
    const regRes = await makeRequest(server, 'POST', '/api/auth/register', {
      name: 'Cyber Analyst',
      email: 'analyst@threatintel.local',
      password: 'StrongPassword123!',
    });
    assert(regRes.status === 201, 'Registration returns 201 Created');
    assert(!!regRes.body.token, 'Registration returns a valid JWT token');
    assert(regRes.body.user.role === 'analyst', 'User is assigned role "analyst"');
    assert(regRes.body.user.password === undefined, 'Password is not leaked in response');

    const analystToken = regRes.body.token;

    // 2. Privilege Escalation Prevention
    const hackRes = await makeRequest(server, 'POST', '/api/auth/register', {
      name: 'Sneaky User',
      email: 'sneaky@threatintel.local',
      password: 'StrongPassword123!',
      role: 'admin', // Attempting to register as admin
    });
    assert(hackRes.status === 201, 'Registration processed');
    assert(hackRes.body.user.role === 'analyst', 'Public registration forces "analyst" role (admin prevented)');

    // 3. Duplicate Email Detection
    const dupRes = await makeRequest(server, 'POST', '/api/auth/register', {
      name: 'Duplicate Analyst',
      email: 'analyst@threatintel.local',
      password: 'StrongPassword123!',
    });
    assert(dupRes.status === 400, 'Duplicate email returns 400 Bad Request');
    assert(dupRes.body.message.includes('already exists'), 'Duplicate email error message verified');

    // 4. Password validation (short password)
    const shortPassRes = await makeRequest(server, 'POST', '/api/auth/register', {
      name: 'Short Pass',
      email: 'short@threatintel.local',
      password: '123',
    });
    assert(shortPassRes.status === 400, 'Short password returns 400 Bad Request');

    // 5. Valid Login
    const loginRes = await makeRequest(server, 'POST', '/api/auth/login', {
      email: 'analyst@threatintel.local',
      password: 'StrongPassword123!',
    });
    assert(loginRes.status === 200, 'Valid login returns 200 OK');
    assert(!!loginRes.body.token, 'Login returns JWT token');
    assert(loginRes.body.user.email === 'analyst@threatintel.local', 'Login returns user profile');

    // 6. Invalid Password
    const badPassRes = await makeRequest(server, 'POST', '/api/auth/login', {
      email: 'analyst@threatintel.local',
      password: 'WrongPassword!',
    });
    assert(badPassRes.status === 401, 'Invalid password returns 401 Unauthorized');

    // 7. Non-existent User Login
    const nonUserRes = await makeRequest(server, 'POST', '/api/auth/login', {
      email: 'nobody@threatintel.local',
      password: 'SomePassword123!',
    });
    assert(nonUserRes.status === 401, 'Non-existent user returns 401 Unauthorized');

    // 8. Protected Route Without Token
    const noTokenRes = await makeRequest(server, 'GET', '/api/auth/me');
    assert(noTokenRes.status === 401, 'GET /api/auth/me without token returns 401 Unauthorized');

    // 9. Protected Route With Invalid Token
    const badTokenRes = await makeRequest(server, 'GET', '/api/auth/me', null, {
      Authorization: 'Bearer invalid.token.signature',
    });
    assert(badTokenRes.status === 401, 'GET /api/auth/me with invalid token returns 401 Unauthorized');

    // 10. Protected Route With Valid Token
    const meRes = await makeRequest(server, 'GET', '/api/auth/me', null, {
      Authorization: `Bearer ${analystToken}`,
    });
    assert(meRes.status === 200, 'GET /api/auth/me with valid Bearer token returns 200 OK');
    assert(meRes.body.user.email === 'analyst@threatintel.local', 'GET /api/auth/me returns authenticated user details');

    // 11. Role Authorization (Analyst attempting Admin-only endpoint)
    const adminForbiddenRes = await makeRequest(server, 'GET', '/api/auth/admin-only', null, {
      Authorization: `Bearer ${analystToken}`,
    });
    assert(adminForbiddenRes.status === 403, 'Analyst accessing admin route returns 403 Forbidden');

    // 12. Admin accessing Admin-only endpoint
    // Create mock admin
    const adminUser = await User.create({
      name: 'Portal Admin',
      email: 'admin@portal.local',
      password: 'AdminPassword123!',
      role: 'admin',
    });
    const adminToken = jwt.sign({ id: adminUser._id, role: 'admin' }, process.env.JWT_SECRET);
    const adminAllowedRes = await makeRequest(server, 'GET', '/api/auth/admin-only', null, {
      Authorization: `Bearer ${adminToken}`,
    });
    assert(adminAllowedRes.status === 200, 'Admin accessing admin route returns 200 OK');
    assert(adminAllowedRes.body.message === 'Welcome Admin', 'Admin access message verified');

  } finally {
    server.close();
  }

  console.log('--- TEST SUMMARY ---');
  console.log(`Passed: ${passed}, Failed: ${failed}`);
  if (failed > 0) {
    process.exit(1);
  } else {
    console.log('ALL TESTS PASSED SUCCESSFULLY!');
  }
}

runTests();
