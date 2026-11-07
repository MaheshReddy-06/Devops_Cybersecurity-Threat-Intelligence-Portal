const Activity = require('../models/Activity');

/**
 * @desc    Get system activity audit log
 *          - Administrators view all activities across all users.
 *          - Analysts view only their own activities.
 * @route   GET /api/activities
 * @access  Private (Analyst & Admin)
 */
const getActivities = async (req, res) => {
  try {
    const { page = 1, limit = 15, action } = req.query;

    const query = {};

    // Role-based visibility enforcement
    if (req.user.role !== 'admin') {
      // Ordinary analysts strictly view only their own activities
      query.user = req.user._id;
    }

    if (action) {
      query.action = action;
    }

    const currentPage = Math.max(1, parseInt(page, 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(limit, 10) || 15));
    const skip = (currentPage - 1) * pageSize;

    const totalCount = await Activity.countDocuments(query);
    const totalPages = Math.ceil(totalCount / pageSize);

    const activities = await Activity.find(query)
      .populate('user', 'name email role')
      .populate('threat', 'indicatorValue indicatorType severity status')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(pageSize);

    return res.status(200).json({
      status: 'success',
      page: currentPage,
      limit: pageSize,
      totalCount,
      totalPages,
      count: activities.length,
      data: activities,
    });
  } catch (error) {
    console.error('Get Activities Error:', error.message);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve activity audit trail',
    });
  }
};

module.exports = {
  getActivities,
};
