const mongoose = require('mongoose');
const Threat = require('../models/Threat');
const Source = require('../models/Source');
const Activity = require('../models/Activity');
const User = require('../models/User');
const { convertToCsv } = require('../utils/csvExporter');

// Helper to construct dynamic date range match query
const buildDateFilter = (startDate, endDate, dateField = 'createdAt') => {
  const filter = {};
  if (startDate || endDate) {
    filter[dateField] = {};
    if (startDate) {
      filter[dateField].$gte = new Date(startDate);
    }
    if (endDate) {
      filter[dateField].$lte = new Date(endDate);
    }
  }
  return filter;
};

/**
 * @desc    Report 1: Threat Submission Report
 *          Provides end-to-end breakdown of submissions, triage status, and timeline.
 * @route   GET /api/reports/submissions
 * @access  Private (Analyst & Admin)
 */
const getThreatSubmissionReport = async (req, res) => {
  try {
    const { startDate, endDate, format } = req.query;
    const dateFilter = buildDateFilter(startDate, endDate);

    // Fetch matching submissions
    const submissions = await Threat.find(dateFilter)
      .populate('source', 'name')
      .populate('submittedBy', 'name email role')
      .populate('reviewedBy', 'name email')
      .sort({ createdAt: -1 });

    // Calculate dynamic aggregation statistics
    const total = submissions.length;
    let approved = 0;
    let pending = 0;
    let rejected = 0;
    let critical = 0;
    let high = 0;
    let medium = 0;
    let low = 0;

    submissions.forEach((item) => {
      if (item.status === 'Approved') approved++;
      if (item.status === 'Pending') pending++;
      if (item.status === 'Rejected') rejected++;

      if (item.severity === 'Critical') critical++;
      if (item.severity === 'High') high++;
      if (item.severity === 'Medium') medium++;
      if (item.severity === 'Low') low++;
    });

    // CSV Export option
    if (format === 'csv') {
      const columns = [
        { label: 'Threat ID', key: '_id' },
        { label: 'Indicator Value', key: 'indicatorValue' },
        { label: 'Indicator Type', key: 'indicatorType' },
        { label: 'Submission Type', key: 'submissionType' },
        { label: 'Category', key: 'category' },
        { label: 'Severity', key: 'severity' },
        { label: 'Status', key: 'status' },
        { label: 'Source', key: 'source.name' },
        { label: 'Submitted By', key: 'submittedBy.name' },
        { label: 'Created At', key: 'createdAt' },
      ];

      const csvData = convertToCsv(columns, submissions);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="Threat_Submission_Report_${new Date().toISOString().split('T')[0]}.csv"`
      );
      return res.status(200).send(csvData);
    }

    // Default JSON response
    return res.status(200).json({
      status: 'success',
      reportTitle: 'Threat Submission Report',
      generatedAt: new Date().toISOString(),
      filters: { startDate: startDate || null, endDate: endDate || null },
      summary: {
        totalSubmissions: total,
        statusBreakdown: { approved, pending, rejected },
        severityBreakdown: { critical, high, medium, low },
      },
      count: submissions.length,
      data: submissions,
    });
  } catch (error) {
    console.error('Threat Submission Report Error:', error.message);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to generate threat submission report',
    });
  }
};

/**
 * @desc    Report 2: Indicator Summary Report
 *          Aggregates indicators grouped by type (IP, Domain, URL, Hash) with metrics.
 * @route   GET /api/reports/indicators
 * @access  Private (Analyst & Admin)
 */
const getIndicatorSummaryReport = async (req, res) => {
  try {
    const { startDate, endDate, format } = req.query;
    const dateFilter = buildDateFilter(startDate, endDate);

    // Dynamic aggregation pipeline
    const pipeline = [];
    if (Object.keys(dateFilter).length > 0) {
      pipeline.push({ $match: dateFilter });
    }

    pipeline.push(
      {
        $group: {
          _id: '$indicatorType',
          total: { $sum: 1 },
          approved: {
            $sum: { $cond: [{ $eq: ['$status', 'Approved'] }, 1, 0] },
          },
          pending: {
            $sum: { $cond: [{ $eq: ['$status', 'Pending'] }, 1, 0] },
          },
          rejected: {
            $sum: { $cond: [{ $eq: ['$status', 'Rejected'] }, 1, 0] },
          },
          critical: {
            $sum: { $cond: [{ $eq: ['$severity', 'Critical'] }, 1, 0] },
          },
          high: {
            $sum: { $cond: [{ $eq: ['$severity', 'High'] }, 1, 0] },
          },
          medium: {
            $sum: { $cond: [{ $eq: ['$severity', 'Medium'] }, 1, 0] },
          },
          low: {
            $sum: { $cond: [{ $eq: ['$severity', 'Low'] }, 1, 0] },
          },
        },
      },
      { $sort: { total: -1 } }
    );

    const rawAgg = await Threat.aggregate(pipeline);

    // Structure report records
    const indicatorData = rawAgg.map((item) => {
      const decided = item.approved + item.rejected;
      const approvalRate = decided > 0 ? Number(((item.approved / decided) * 100).toFixed(1)) : 0;
      return {
        indicatorType: item._id,
        total: item.total,
        approved: item.approved,
        pending: item.pending,
        rejected: item.rejected,
        critical: item.critical,
        high: item.high,
        medium: item.medium,
        low: item.low,
        approvalRatePercent: approvalRate,
      };
    });

    const grandTotal = indicatorData.reduce((acc, curr) => acc + curr.total, 0);
    const grandApproved = indicatorData.reduce((acc, curr) => acc + curr.approved, 0);

    // CSV Export option
    if (format === 'csv') {
      const columns = [
        { label: 'Indicator Type', key: 'indicatorType' },
        { label: 'Total Count', key: 'total' },
        { label: 'Approved Count', key: 'approved' },
        { label: 'Pending Count', key: 'pending' },
        { label: 'Rejected Count', key: 'rejected' },
        { label: 'Critical Severity', key: 'critical' },
        { label: 'High Severity', key: 'high' },
        { label: 'Medium Severity', key: 'medium' },
        { label: 'Low Severity', key: 'low' },
        { label: 'Approval Rate (%)', key: 'approvalRatePercent' },
      ];

      const csvData = convertToCsv(columns, indicatorData);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="Indicator_Summary_Report_${new Date().toISOString().split('T')[0]}.csv"`
      );
      return res.status(200).send(csvData);
    }

    return res.status(200).json({
      status: 'success',
      reportTitle: 'Indicator Summary Report',
      generatedAt: new Date().toISOString(),
      filters: { startDate: startDate || null, endDate: endDate || null },
      summary: {
        totalUniqueIndicatorTypes: indicatorData.length,
        grandTotalIndicators: grandTotal,
        totalApprovedIndicators: grandApproved,
      },
      data: indicatorData,
    });
  } catch (error) {
    console.error('Indicator Summary Report Error:', error.message);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to generate indicator summary report',
    });
  }
};

/**
 * @desc    Report 3: Source Reliability Report
 *          Calculates true approval and rejection statistics from actual submission outcomes per source.
 * @route   GET /api/reports/sources
 * @access  Private (Analyst & Admin)
 */
const getSourceReliabilityReport = async (req, res) => {
  try {
    const { startDate, endDate, format } = req.query;
    const dateFilter = buildDateFilter(startDate, endDate);

    const pipeline = [];
    if (Object.keys(dateFilter).length > 0) {
      pipeline.push({ $match: dateFilter });
    }

    pipeline.push(
      {
        $group: {
          _id: '$source',
          totalSubmissions: { $sum: 1 },
          approvedCount: {
            $sum: { $cond: [{ $eq: ['$status', 'Approved'] }, 1, 0] },
          },
          rejectedCount: {
            $sum: { $cond: [{ $eq: ['$status', 'Rejected'] }, 1, 0] },
          },
          pendingCount: {
            $sum: { $cond: [{ $eq: ['$status', 'Pending'] }, 1, 0] },
          },
        },
      },
      {
        $lookup: {
          from: 'sources',
          localField: '_id',
          foreignField: '_id',
          as: 'sourceInfo',
        },
      },
      { $unwind: { path: '$sourceInfo', preserveNullAndEmptyArrays: true } },
      { $sort: { totalSubmissions: -1 } }
    );

    const sourceAgg = await Threat.aggregate(pipeline);

    // Compute mathematical reliability metrics based strictly on actual moderation decisions
    const sourceData = sourceAgg.map((item) => {
      const sourceName = item.sourceInfo ? item.sourceInfo.name : 'Unknown Source';
      const decidedCount = item.approvedCount + item.rejectedCount;

      let approvalRate = 0;
      let rejectionRate = 0;
      let reliabilityRating = 'Unverified (All Pending)';

      if (decidedCount > 0) {
        approvalRate = Number(((item.approvedCount / decidedCount) * 100).toFixed(1));
        rejectionRate = Number(((item.rejectedCount / decidedCount) * 100).toFixed(1));

        if (item.totalSubmissions >= 3 && approvalRate >= 80) {
          reliabilityRating = 'High Reliability';
        } else if (approvalRate >= 50) {
          reliabilityRating = 'Moderate Reliability';
        } else {
          reliabilityRating = 'Low Reliability';
        }
      }

      return {
        sourceId: item._id,
        sourceName,
        totalSubmissions: item.totalSubmissions,
        approvedCount: item.approvedCount,
        rejectedCount: item.rejectedCount,
        pendingCount: item.pendingCount,
        approvalRatePercent: approvalRate,
        rejectionRatePercent: rejectionRate,
        reliabilityRating,
      };
    });

    // CSV Export option
    if (format === 'csv') {
      const columns = [
        { label: 'Source Name', key: 'sourceName' },
        { label: 'Total Submissions', key: 'totalSubmissions' },
        { label: 'Approved Count', key: 'approvedCount' },
        { label: 'Rejected Count', key: 'rejectedCount' },
        { label: 'Pending Count', key: 'pendingCount' },
        { label: 'Approval Rate (%)', key: 'approvalRatePercent' },
        { label: 'Rejection Rate (%)', key: 'rejectionRatePercent' },
        { label: 'Reliability Rating', key: 'reliabilityRating' },
      ];

      const csvData = convertToCsv(columns, sourceData);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="Source_Reliability_Report_${new Date().toISOString().split('T')[0]}.csv"`
      );
      return res.status(200).send(csvData);
    }

    return res.status(200).json({
      status: 'success',
      reportTitle: 'Source Reliability Report',
      generatedAt: new Date().toISOString(),
      filters: { startDate: startDate || null, endDate: endDate || null },
      summary: {
        totalSourcesEvaluated: sourceData.length,
        totalSubmissionsEvaluated: sourceData.reduce((acc, curr) => acc + curr.totalSubmissions, 0),
        overallApproved: sourceData.reduce((acc, curr) => acc + curr.approvedCount, 0),
        overallRejected: sourceData.reduce((acc, curr) => acc + curr.rejectedCount, 0),
      },
      data: sourceData,
    });
  } catch (error) {
    console.error('Source Reliability Report Error:', error.message);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to generate source reliability report',
    });
  }
};

/**
 * @desc    Report 4: Analyst Activity Report
 *          Tracks analyst engagement, submissions, and auditing actions.
 * @route   GET /api/reports/analysts
 * @access  Private (Analyst & Admin)
 */
const getAnalystActivityReport = async (req, res) => {
  try {
    const { startDate, endDate, format } = req.query;
    const dateFilter = buildDateFilter(startDate, endDate);

    const pipeline = [];
    if (Object.keys(dateFilter).length > 0) {
      pipeline.push({ $match: dateFilter });
    }

    pipeline.push(
      {
        $group: {
          _id: '$user',
          totalActions: { $sum: 1 },
          submissionsLogged: {
            $sum: { $cond: [{ $eq: ['$action', 'SUBMIT_THREAT'] }, 1, 0] },
          },
          approvalsLogged: {
            $sum: { $cond: [{ $eq: ['$action', 'APPROVE_THREAT'] }, 1, 0] },
          },
          rejectionsLogged: {
            $sum: { $cond: [{ $eq: ['$action', 'REJECT_THREAT'] }, 1, 0] },
          },
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'userInfo',
        },
      },
      { $unwind: { path: '$userInfo', preserveNullAndEmptyArrays: true } },
      { $sort: { totalActions: -1 } }
    );

    const activityAgg = await Activity.aggregate(pipeline);

    const analystData = activityAgg.map((item) => {
      const name = item.userInfo ? item.userInfo.name : 'Unknown User';
      const email = item.userInfo ? item.userInfo.email : '';
      const role = item.userInfo ? item.userInfo.role : '';

      return {
        userId: item._id,
        name,
        email,
        role,
        totalActions: item.totalActions,
        submissionsLogged: item.submissionsLogged,
        approvalsLogged: item.approvalsLogged,
        rejectionsLogged: item.rejectionsLogged,
      };
    });

    // CSV Export option
    if (format === 'csv') {
      const columns = [
        { label: 'Analyst Name', key: 'name' },
        { label: 'Email', key: 'email' },
        { label: 'Role', key: 'role' },
        { label: 'Total Actions', key: 'totalActions' },
        { label: 'Submissions Logged', key: 'submissionsLogged' },
        { label: 'Approvals Logged', key: 'approvalsLogged' },
        { label: 'Rejections Logged', key: 'rejectionsLogged' },
      ];

      const csvData = convertToCsv(columns, analystData);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="Analyst_Activity_Report_${new Date().toISOString().split('T')[0]}.csv"`
      );
      return res.status(200).send(csvData);
    }

    return res.status(200).json({
      status: 'success',
      reportTitle: 'Analyst Activity Report',
      generatedAt: new Date().toISOString(),
      filters: { startDate: startDate || null, endDate: endDate || null },
      summary: {
        totalAnalystsTracked: analystData.length,
        totalSystemActions: analystData.reduce((acc, curr) => acc + curr.totalActions, 0),
        totalSubmissionsLogged: analystData.reduce((acc, curr) => acc + curr.submissionsLogged, 0),
      },
      data: analystData,
    });
  } catch (error) {
    console.error('Analyst Activity Report Error:', error.message);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to generate analyst activity report',
    });
  }
};

module.exports = {
  getThreatSubmissionReport,
  getIndicatorSummaryReport,
  getSourceReliabilityReport,
  getAnalystActivityReport,
};
