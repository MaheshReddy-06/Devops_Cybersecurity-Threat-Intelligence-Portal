const mongoose = require('mongoose');
const Threat = require('../models/Threat');
const Activity = require('../models/Activity');
const User = require('../models/User');

/**
 * @desc    Retrieve all pending threat submissions awaiting administrator review
 * @route   GET /api/admin/pending
 * @access  Private (Admin only)
 */
const getPendingThreats = async (req, res) => {
  try {
    const { page = 1, limit = 10, indicatorType, severity } = req.query;

    const query = { status: 'Pending' };
    if (indicatorType) query.indicatorType = indicatorType;
    if (severity) query.severity = severity;

    const currentPage = Math.max(1, parseInt(page, 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));
    const skip = (currentPage - 1) * pageSize;

    const totalCount = await Threat.countDocuments(query);
    const totalPages = Math.ceil(totalCount / pageSize);

    const pendingThreats = await Threat.find(query)
      .populate('source', 'name description')
      .populate('submittedBy', 'name email role')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(pageSize);

    return res.status(200).json({
      status: 'success',
      page: currentPage,
      limit: pageSize,
      totalCount,
      totalPages,
      count: pendingThreats.length,
      data: pendingThreats,
    });
  } catch (error) {
    console.error('Get Pending Threats Error:', error.message);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve pending submissions',
    });
  }
};

/**
 * @desc    Retrieve all previously reviewed submissions (Approved or Rejected)
 * @route   GET /api/admin/reviewed
 * @access  Private (Admin only)
 */
const getReviewedThreats = async (req, res) => {
  try {
    const { page = 1, limit = 10, status, indicatorType } = req.query;

    const query = {};
    if (status && ['Approved', 'Rejected'].includes(status)) {
      query.status = status;
    } else {
      query.status = { $in: ['Approved', 'Rejected'] };
    }

    if (indicatorType) query.indicatorType = indicatorType;

    const currentPage = Math.max(1, parseInt(page, 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));
    const skip = (currentPage - 1) * pageSize;

    const totalCount = await Threat.countDocuments(query);
    const totalPages = Math.ceil(totalCount / pageSize);

    const reviewedThreats = await Threat.find(query)
      .populate('source', 'name description')
      .populate('submittedBy', 'name email role')
      .populate('reviewedBy', 'name email role')
      .sort({ updatedAt: -1 })
      .skip(skip)
      .limit(pageSize);

    return res.status(200).json({
      status: 'success',
      page: currentPage,
      limit: pageSize,
      totalCount,
      totalPages,
      count: reviewedThreats.length,
      data: reviewedThreats,
    });
  } catch (error) {
    console.error('Get Reviewed Threats Error:', error.message);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve reviewed submissions',
    });
  }
};

/**
 * @desc    View individual submission details with full metadata
 * @route   GET /api/admin/threats/:id
 * @access  Private (Admin only)
 */
const getAdminThreatById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid threat ID format',
      });
    }

    const threat = await Threat.findById(id)
      .populate('source', 'name description contact')
      .populate('submittedBy', 'name email role')
      .populate('reviewedBy', 'name email role');

    if (!threat) {
      return res.status(404).json({
        status: 'error',
        message: 'Threat submission not found',
      });
    }

    return res.status(200).json({
      status: 'success',
      data: threat,
    });
  } catch (error) {
    console.error('Get Admin Threat By ID Error:', error.message);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve threat submission details',
    });
  }
};

/**
 * @desc    Approve a pending threat submission
 * @route   PUT /api/admin/threats/:id/approve
 * @access  Private (Admin only)
 */
const approveThreat = async (req, res) => {
  try {
    const { id } = req.params;
    const { reviewComment, comment, reReview } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid threat ID format',
      });
    }

    const threat = await Threat.findById(id);

    if (!threat) {
      return res.status(404).json({
        status: 'error',
        message: 'Threat submission not found',
      });
    }

    // Guard: Prevent re-approving or altering already reviewed submission without explicit reReview flag
    if (threat.status !== 'Pending' && !reReview) {
      return res.status(400).json({
        status: 'error',
        message: `Cannot review an already processed submission. Current status is '${threat.status}'. Provide { reReview: true } to override.`,
      });
    }

    const finalComment = (reviewComment || comment || 'Approved by administrator').trim();

    // Update Threat status, reviewer, and moderation comment
    threat.status = 'Approved';
    threat.reviewedBy = req.user._id;
    threat.reviewComment = finalComment;
    await threat.save();

    // Create Audit Activity record
    await Activity.create({
      user: req.user._id,
      threat: threat._id,
      action: 'APPROVE_THREAT',
      description: `Administrator '${req.user.name}' approved ${threat.submissionType} for ${threat.indicatorType}: '${threat.indicatorValue}'`,
    });

    // Populate for response
    await threat.populate([
      { path: 'source', select: 'name description' },
      { path: 'submittedBy', select: 'name email role' },
      { path: 'reviewedBy', select: 'name email role' },
    ]);

    return res.status(200).json({
      status: 'success',
      message: 'Threat submission approved successfully and published to portal explorer',
      data: threat,
    });
  } catch (error) {
    console.error('Approve Threat Error:', error.message);
    return res.status(500).json({
      status: 'error',
      message: 'Server error while approving threat submission',
    });
  }
};

/**
 * @desc    Reject a pending threat submission
 * @route   PUT /api/admin/threats/:id/reject
 * @access  Private (Admin only)
 */
const rejectThreat = async (req, res) => {
  try {
    const { id } = req.params;
    const { reviewComment, comment, reReview } = req.body;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        status: 'error',
        message: 'Invalid threat ID format',
      });
    }

    const threat = await Threat.findById(id);

    if (!threat) {
      return res.status(404).json({
        status: 'error',
        message: 'Threat submission not found',
      });
    }

    // Guard: Prevent modifying already reviewed submission without explicit reReview flag
    if (threat.status !== 'Pending' && !reReview) {
      return res.status(400).json({
        status: 'error',
        message: `Cannot review an already processed submission. Current status is '${threat.status}'. Provide { reReview: true } to override.`,
      });
    }

    const finalComment = (reviewComment || comment || 'Rejected by administrator: insufficient evidence or false positive').trim();

    // Update Threat status, reviewer, and moderation comment
    threat.status = 'Rejected';
    threat.reviewedBy = req.user._id;
    threat.reviewComment = finalComment;
    await threat.save();

    // Create Audit Activity record
    await Activity.create({
      user: req.user._id,
      threat: threat._id,
      action: 'REJECT_THREAT',
      description: `Administrator '${req.user.name}' rejected ${threat.submissionType} for ${threat.indicatorType}: '${threat.indicatorValue}'. Comment: ${finalComment}`,
    });

    // Populate for response
    await threat.populate([
      { path: 'source', select: 'name description' },
      { path: 'submittedBy', select: 'name email role' },
      { path: 'reviewedBy', select: 'name email role' },
    ]);

    return res.status(200).json({
      status: 'success',
      message: 'Threat submission rejected successfully',
      data: threat,
    });
  } catch (error) {
    console.error('Reject Threat Error:', error.message);
    return res.status(500).json({
      status: 'error',
      message: 'Server error while rejecting threat submission',
    });
  }
};
/**
 * @desc    Get all registered users
 * @route   GET /api/admin/users
 * @access  Admin
 */
const getAllUsers = async (req, res) => {
  try {
    const users = await User.find()
      .select('-password')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: users.length,
      users,
    });
  } catch (error) {
    console.error('[Admin] Get users error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve users',
    });
  }
};
/**
 * @desc    Update a user's role
 * @route   PUT /api/admin/users/:id/role
 * @access  Admin
 */
const updateUserRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    const allowedRoles = [
      'admin',
      'analyst',
      'moderator',
      'organization_member',
    ];

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid user ID',
      });
    }

    if (!allowedRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid role selected',
      });
    }

    const targetUser = await User.findById(id);

    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found',
      });
    }

    if (targetUser.role === role) {
      return res.status(200).json({
        success: true,
        message: 'User already has this role',
        user: {
          _id: targetUser._id,
          name: targetUser.name,
          email: targetUser.email,
          role: targetUser.role,
        },
      });
    }

    // Prevent removal of the last administrator.
    if (targetUser.role === 'admin' && role !== 'admin') {
      const adminCount = await User.countDocuments({ role: 'admin' });

      if (adminCount <= 1) {
        return res.status(400).json({
          success: false,
          message: 'Cannot change the role of the last administrator',
        });
      }
    }

    const previousRole = targetUser.role;

    targetUser.role = role;
    await targetUser.save();

    await Activity.create({
      user: req.user._id,
      threat: null,
      action: 'UPDATE_USER_ROLE',
      description: `Changed ${targetUser.email} role from ${previousRole} to ${role}`,
    });

    res.status(200).json({
      success: true,
      message: 'User role updated successfully',
      user: {
        _id: targetUser._id,
        name: targetUser.name,
        email: targetUser.email,
        role: targetUser.role,
      },
    });
  } catch (error) {
    console.error('[Admin] Update user role error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update user role',
    });
  }
};

module.exports = {
  getPendingThreats,
  getReviewedThreats,
  getAdminThreatById,
  approveThreat,
  rejectThreat,
  getAllUsers,
  updateUserRole,
};
