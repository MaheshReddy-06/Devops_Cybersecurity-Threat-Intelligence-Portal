const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Protect routes: verifies the Bearer JWT token from Authorization header.
 * Attaches the authenticated user document (without password) to req.user.
 */
const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer ')
  ) {
    try {
      // Extract token from 'Bearer <token>'
      token = req.headers.authorization.split(' ')[1];

      // Verify token
      const secret = process.env.JWT_SECRET || 'fallback_default_jwt_secret';
      const decoded = jwt.verify(token, secret);

      // Fetch user without password field
      const user = await User.findById(decoded.id).select('-password');
      if (!user) {
        return res.status(401).json({
          status: 'error',
          message: 'Not authorized: User account no longer exists',
        });
      }

      req.user = user;
      return next();
    } catch (error) {
      console.error('JWT Verification Error:', error.message);
      return res.status(401).json({
        status: 'error',
        message: 'Not authorized: Token is invalid or expired',
      });
    }
  }

  if (!token) {
    return res.status(401).json({
      status: 'error',
      message: 'Not authorized: No token provided in Authorization header',
    });
  }
};

/**
 * Role-based authorization middleware.
 * Restricts access to specified roles (e.g., 'admin', 'analyst').
 *
 * @param  {...string} roles - Allowed roles
 */
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        status: 'error',
        message: 'Not authorized: User not authenticated',
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        status: 'error',
        message: `Forbidden: Role '${req.user.role}' is not authorized to access this resource`,
      });
    }

    next();
  };
};

module.exports = {
  protect,
  authorize,
};
