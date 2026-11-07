const User = require('../models/User');
const generateToken = require('../utils/generateToken');

// Simple email regex for validation
const EMAIL_REGEX = /^\S+@\S+\.\S+$/;

/**
 * @desc    Register a new threat analyst account
 * @route   POST /api/auth/register
 * @access  Public
 */
const register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    // 1. Validate required inputs
    if (!name || !email || !password) {
      return res.status(400).json({
        status: 'error',
        message: 'Please provide name, email, and password',
      });
    }

    const trimmedName = name.trim();
    const trimmedEmail = email.trim().toLowerCase();

    if (!trimmedName) {
      return res.status(400).json({
        status: 'error',
        message: 'Name cannot be empty',
      });
    }

    if (!EMAIL_REGEX.test(trimmedEmail)) {
      return res.status(400).json({
        status: 'error',
        message: 'Please provide a valid email address',
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        status: 'error',
        message: 'Password must be at least 6 characters long',
      });
    }

    // 2. Check for duplicate email
    const existingUser = await User.findOne({ email: trimmedEmail });
    if (existingUser) {
      return res.status(400).json({
        status: 'error',
        message: 'An account with this email address already exists',
      });
    }

    // 3. Security enforcement: Public registration is strictly locked to 'analyst' role.
    // Public requests attempting to pass role: 'admin' are ignored and assigned 'analyst'.
    const user = await User.create({
      name: trimmedName,
      email: trimmedEmail,
      password,
      role: 'analyst',
    });

    // 4. Return token and sanitized user profile (password is never returned)
    return res.status(201).json({
      status: 'success',
      message: 'Account registered successfully',
      token: generateToken(user._id, user.role),
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    console.error('Registration Error:', error.message);
    return res.status(500).json({
      status: 'error',
      message: 'Server error occurred during registration',
    });
  }
};

/**
 * @desc    Authenticate user and get token
 * @route   POST /api/auth/login
 * @access  Public
 */
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // 1. Validate inputs
    if (!email || !password) {
      return res.status(400).json({
        status: 'error',
        message: 'Please provide both email and password',
      });
    }

    const trimmedEmail = email.trim().toLowerCase();

    // 2. Find user by email
    const user = await User.findOne({ email: trimmedEmail });
    if (!user) {
      return res.status(401).json({
        status: 'error',
        message: 'Invalid email or password',
      });
    }

    // 3. Compare password hash
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({
        status: 'error',
        message: 'Invalid email or password',
      });
    }

    // 4. Return token and user profile (never password)
    return res.status(200).json({
      status: 'success',
      message: 'Login successful',
      token: generateToken(user._id, user.role),
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    console.error('Login Error:', error.message);
    return res.status(500).json({
      status: 'error',
      message: 'Server error occurred during login',
    });
  }
};

/**
 * @desc    Get current authenticated user profile
 * @route   GET /api/auth/me
 * @access  Private (JWT protected)
 */
const getMe = async (req, res) => {
  try {
    // req.user is set by the protect middleware without password
    return res.status(200).json({
      status: 'success',
      user: {
        id: req.user._id,
        name: req.user.name,
        email: req.user.email,
        role: req.user.role,
        createdAt: req.user.createdAt,
        updatedAt: req.user.updatedAt,
      },
    });
  } catch (error) {
    console.error('Get Profile Error:', error.message);
    return res.status(500).json({
      status: 'error',
      message: 'Server error fetching user profile',
    });
  }
};

/**
 * @desc    Change user password
 * @route   PUT /api/auth/change-password
 * @access  Private (JWT protected)
 */
const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        status: 'error',
        message: 'Please provide both current and new password',
      });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({
        status: 'error',
        message: 'New password must be at least 6 characters long',
      });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({
        status: 'error',
        message: 'User account not found',
      });
    }

    const isMatch = await user.matchPassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({
        status: 'error',
        message: 'Current password does not match',
      });
    }

    user.password = newPassword;
    await user.save();

    return res.status(200).json({
      status: 'success',
      message: 'Password updated successfully',
    });
  } catch (error) {
    console.error('Change Password Error:', error.message);
    return res.status(500).json({
      status: 'error',
      message: 'Server error while updating password',
    });
  }
};

module.exports = {
  register,
  login,
  getMe,
  changePassword,
};
