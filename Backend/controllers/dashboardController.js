const Threat = require('../models/Threat');

/**
 * @desc    Get real-time dashboard analytics and threat intelligence statistics
 * @route   GET /api/dashboard/stats
 * @access  Private (Analyst & Admin)
 */
const getDashboardStats = async (req, res) => {
  try {
    // 1. Fetch counts across status and severity concurrently
    const [
      totalSubmissions,
      totalApproved,
      totalPending,
      totalRejected,
      criticalThreats,
      highThreats,
      mediumThreats,
      lowThreats,
      recentSubmissions,
    ] = await Promise.all([
      Threat.countDocuments(),
      Threat.countDocuments({ status: 'Approved' }),
      Threat.countDocuments({ status: 'Pending' }),
      Threat.countDocuments({ status: 'Rejected' }),
      Threat.countDocuments({ severity: 'Critical' }),
      Threat.countDocuments({ severity: 'High' }),
      Threat.countDocuments({ severity: 'Medium' }),
      Threat.countDocuments({ severity: 'Low' }),
      Threat.find()
        .populate('source', 'name')
        .populate('submittedBy', 'name email role')
        .sort({ createdAt: -1 })
        .limit(5),
    ]);

    // 2. Aggregate distribution by indicator type (IP, Domain, URL, Hash)
    const indicatorTypeAgg = await Threat.aggregate([
      {
        $group: {
          _id: '$indicatorType',
          count: { $sum: 1 },
          approvedCount: {
            $sum: { $cond: [{ $eq: ['$status', 'Approved'] }, 1, 0] },
          },
        },
      },
    ]);

    // Standardize indicator distribution structure
    const distributionMap = {
      IP: 0,
      Domain: 0,
      URL: 0,
      Hash: 0,
    };

    indicatorTypeAgg.forEach((item) => {
      if (item._id && distributionMap[item._id] !== undefined) {
        distributionMap[item._id] = item.count;
      }
    });

    return res.status(200).json({
      status: 'success',
      data: {
        summary: {
          totalSubmissions,
          totalApproved,
          totalPending,
          totalRejected,
        },
        severityBreakdown: {
          criticalThreats,
          highThreats,
          mediumThreats,
          lowThreats,
        },
        indicatorTypeDistribution: distributionMap,
        rawIndicatorAggregation: indicatorTypeAgg,
        recentSubmissions,
      },
    });
  } catch (error) {
    console.error('Dashboard Stats Error:', error.message);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve dashboard analytics',
    });
  }
};

module.exports = {
  getDashboardStats,
};
