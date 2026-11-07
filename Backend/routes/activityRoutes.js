const express = require('express');
const router = express.Router();
const { getActivities } = require('../controllers/activityController');
const { protect } = require('../middleware/auth');

// GET /api/activities
router.get('/', protect, getActivities);

module.exports = router;
