const express = require('express');
const router = express.Router();
const { getSources, createSource } = require('../controllers/sourceController');
const { protect } = require('../middleware/auth');

router.route('/')
  .get(protect, getSources)
  .post(protect, createSource);

module.exports = router;
