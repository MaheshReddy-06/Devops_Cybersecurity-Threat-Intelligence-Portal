const jwt = require('jsonwebtoken');

/**
 * Generate a signed JSON Web Token (JWT) with user ID and role payload.
 *
 * @param {string} userId - MongoDB _id of the user
 * @param {string} role - User role (analyst or admin)
 * @returns {string} Signed JWT token
 */
const generateToken = (userId, role) => {
  const secret = process.env.JWT_SECRET || 'fallback_default_jwt_secret';
  const expiresIn = process.env.JWT_EXPIRES_IN || '7d';

  return jwt.sign({ id: userId, role }, secret, {
    expiresIn,
  });
};

module.exports = generateToken;
