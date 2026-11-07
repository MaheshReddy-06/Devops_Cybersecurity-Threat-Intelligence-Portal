const express = require('express');
const router = express.Router();
const { register, login, getMe, changePassword } = require('../controllers/authController');
const { protect } = require('../middleware/auth');

// Public authentication routes
router.post('/register', register);
router.post('/login', login);

// Private authenticated routes
router.get('/me', protect, getMe);
router.put('/change-password', protect, changePassword);

module.exports = router;
