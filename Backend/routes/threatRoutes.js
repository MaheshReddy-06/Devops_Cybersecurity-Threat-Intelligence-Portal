const express = require('express');
const router = express.Router();
const {
  createThreat,
  getThreats,
  getMySubmissions,
  getThreatById,
} = require('../controllers/threatController');
const { protect } = require('../middleware/auth');

// All threat routes require JWT authentication
router.use(protect);

// Base threat routes
router.route('/')
  .post(createThreat)
  .get(getThreats);

// Personal analyst submissions route (must be defined before /:id)
router.get('/my-submissions', getMySubmissions);

// Single threat by ID
router.get('/:id', getThreatById);

module.exports = router;
