const express = require('express');
const router = express.Router();
const {
  getThreatSubmissionReport,
  getIndicatorSummaryReport,
  getSourceReliabilityReport,
  getAnalystActivityReport,
} = require('../controllers/reportController');
const { protect } = require('../middleware/auth');

// All report endpoints are protected
router.use(protect);

// 1. Threat Submission Report
router.get('/submissions', getThreatSubmissionReport);

// 2. Indicator Summary Report
router.get('/indicators', getIndicatorSummaryReport);

// 3. Source Reliability Report
router.get('/sources', getSourceReliabilityReport);

// 4. Analyst Activity Report
router.get('/analysts', getAnalystActivityReport);

module.exports = router;
