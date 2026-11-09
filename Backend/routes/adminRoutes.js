const express = require('express');
const router = express.Router();
const {
  getPendingThreats,
  getReviewedThreats,
  getAdminThreatById,
  approveThreat,
  rejectThreat,
  getAllUsers,
  updateUserRole,
} = require('../controllers/adminController');
const { protect, authorize } = require('../middleware/auth');

// All moderation routes are strictly restricted to administrators
router.use(protect, authorize('admin', 'moderator'));

// Retrieve pending queue
router.get('/pending', getPendingThreats);

// Retrieve reviewed history (Approved & Rejected)
router.get('/reviewed', getReviewedThreats);

// Individual submission inspection and moderation decisions
router.get('/threats/:id', getAdminThreatById);
router.put('/threats/:id/approve', approveThreat);
router.put('/threats/:id/reject', rejectThreat);
// Admin-only user management routes
router.get('/users', authorize('admin'), getAllUsers);
router.put('/users/:id/role', authorize('admin'), updateUserRole);

module.exports = router;
