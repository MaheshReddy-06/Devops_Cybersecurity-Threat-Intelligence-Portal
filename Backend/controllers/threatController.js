const mongoose = require('mongoose');
const Threat = require('../models/Threat');
const Source = require('../models/Source');
const Activity = require('../models/Activity');
const { validateIndicator } = require('../utils/indicatorValidator');

/**
 * @desc    Submit a new threat indicator, advisory, or observation
 * @route   POST /api/threats
 * @access  Private (Analyst & Admin)
 */
const createThreat = async (req, res) => {
  try {
    const {
      indicatorValue,
      indicatorType,
      category,
      severity,
      description,
      submissionType = 'Indicator',
      source,
    } = req.body;

    // 1. Validate required fields
    if (!indicatorValue || !indicatorType || !category || !description || !source) {
      return res.status(400).json({
        status: 'error',
        message: 'Missing required fields: indicatorValue, indicatorType, category, description, and source are required.',
      });
    }

    // 2. Validate Indicator Type enum
    const validTypes = ['IP', 'Domain', 'URL', 'Hash'];
    if (!validTypes.includes(indicatorType)) {
      return res.status(400).json({
        status: 'error',
        message: `Invalid indicatorType '${indicatorType}'. Allowed types: ${validTypes.join(', ')}`,
      });
    }

    // 3. Validate Submission Type enum
    const validSubmissionTypes = ['Indicator', 'Advisory', 'Observation'];
    if (!validSubmissionTypes.includes(submissionType)) {
      return res.status(400).json({
        status: 'error',
        message: `Invalid submissionType '${submissionType}'. Allowed types: ${validSubmissionTypes.join(', ')}`,
      });
    }

    // 4. Validate Severity if provided
    if (severity) {
      const validSeverities = ['Critical', 'High', 'Medium', 'Low'];
      if (!validSeverities.includes(severity)) {
        return res.status(400).json({
          status: 'error',
          message: `Invalid severity '${severity}'. Allowed: ${validSeverities.join(', ')}`,
        });
      }
    }

    // 5. Strict Indicator value format validation based on type (IP, Domain, URL, Hash)
    const validation = validateIndicator(indicatorType, indicatorValue);
    if (!validation.valid) {
      return res.status(400).json({
        status: 'error',
        message: validation.message,
      });
    }

    // 6. Resolve or create Source entity
    let sourceDoc;
    if (mongoose.Types.ObjectId.isValid(source)) {
      sourceDoc = await Source.findById(source);
    } else if (typeof source === 'string' && source.trim()) {
      sourceDoc = await Source.findOne({ name: source.trim() });
      if (!sourceDoc) {
        sourceDoc = await Source.create({
          name: source.trim(),
          description: `Auto-registered source: ${source.trim()}`,
        });
      }
    }

    if (!sourceDoc) {
      return res.status(400).json({
        status: 'error',
        message: 'Valid source ID or source name is required',
      });
    }

    // 7. Create Threat document (Status is strictly defaulted to 'Pending')
    const threat = await Threat.create({
      indicatorValue: indicatorValue.trim(),
      indicatorType,
      category: category.trim(),
      severity: severity || 'Medium',
      description: description.trim(),
      submissionType,
      source: sourceDoc._id,
      submittedBy: req.user._id,
      status: 'Pending', // Enforce Pending status on creation
    });

    // 8. Create an immutable Activity log entry
    await Activity.create({
      user: req.user._id,
      threat: threat._id,
      action: 'SUBMIT_THREAT',
      description: `Analyst '${req.user.name}' submitted new ${submissionType} for ${indicatorType}: ${indicatorValue.trim()}`,
    });

    // Populate source and submittedBy for client presentation
    await threat.populate([
      { path: 'source', select: 'name description' },
      { path: 'submittedBy', select: 'name email role' },
    ]);

    return res.status(201).json({
      status: 'success',
      message: `${submissionType} submitted successfully and queued for review`,
      data: threat,
    });
  } catch (error) {
    console.error('Create Threat Error:', error.message);
    return res.status(500).json({
      status: 'error',
      message: 'Server error while submitting threat intelligence',
    });
  }
};

/**
 * @desc    Get threat indicators with filtering and search
 *          - Ordinary analysts ONLY see Approved indicators.
 *          - Administrators can view all or filter by any status.
 * @route   GET /api/threats
 * @access  Private (Analyst & Admin)
 */
const getThreats = async (req, res) => {
  try {
    const {
      indicatorType,
      severity,
      submissionType,
      source,
      status,
      search,
      startDate,
      endDate,
      page = 1,
      limit = 10,
    } = req.query;

    const query = {};

    // 1. Role-based Visibility Control
    if (req.user.role === 'admin') {
      // Admins can see any status or filter by specific status
      if (status) {
        query.status = status;
      }
    } else {
      // Ordinary analysts: Strictly enforce visibility to Approved indicators only
      query.status = 'Approved';
    }

    // 2. Indicator Type filter
    if (indicatorType) {
      query.indicatorType = indicatorType;
    }

    // 3. Severity filter
    if (severity) {
      query.severity = severity;
    }

    // 4. Submission Type filter
    if (submissionType) {
      query.submissionType = submissionType;
    }

    // 5. Source filter
    if (source) {
      if (mongoose.Types.ObjectId.isValid(source)) {
        query.source = source;
      } else {
        const foundSource = await Source.findOne({ name: source });
        if (foundSource) {
          query.source = foundSource._id;
        } else {
          // No matching source, return empty dataset
          return res.status(200).json({
            status: 'success',
            page: Number(page),
            limit: Number(limit),
            totalCount: 0,
            totalPages: 0,
            count: 0,
            data: [],
          });
        }
      }
    }

    // 6. Date Range filter
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) {
        query.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        query.createdAt.$lte = new Date(endDate);
      }
    }

    // 7. Keyword search filter
    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i');
      query.$or = [
        { indicatorValue: searchRegex },
        { description: searchRegex },
        { category: searchRegex },
      ];
    }

    // 8. Pagination logic
    const currentPage = Math.max(1, parseInt(page, 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));
    const skip = (currentPage - 1) * pageSize;

    const totalCount = await Threat.countDocuments(query);
    const totalPages = Math.ceil(totalCount / pageSize);

    const threats = await Threat.find(query)
      .populate('source', 'name description')
      .populate('submittedBy', 'name email role')
      .populate('reviewedBy', 'name email role')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(pageSize);

    return res.status(200).json({
      status: 'success',
      page: currentPage,
      limit: pageSize,
      totalCount,
      totalPages,
      count: threats.length,
      data: threats,
    });
  } catch (error) {
    console.error('Get Threats Error:', error.message);
    return res.status(500).json({
      status: 'error',
      message: 'Server error retrieving threat indicators',
    });
  }
};

/**
 * @desc    Get an analyst's own submissions (includes their Pending, Approved, and Rejected)
 * @route   GET /api/threats/my-submissions
 * @access  Private (Analyst & Admin)
 */
const getMySubmissions = async (req, res) => {
  try {
    const {
      indicatorType,
      severity,
      status,
      submissionType,
      page = 1,
      limit = 10,
    } = req.query;

    // Filter restricted strictly to the logged-in analyst's user ID
    const query = { submittedBy: req.user._id };

    if (status) query.status = status;
    if (indicatorType) query.indicatorType = indicatorType;
    if (severity) query.severity = severity;
    if (submissionType) query.submissionType = submissionType;

    const currentPage = Math.max(1, parseInt(page, 10) || 1);
    const pageSize = Math.min(100, Math.max(1, parseInt(limit, 10) || 10));
    const skip = (currentPage - 1) * pageSize;

    const totalCount = await Threat.countDocuments(query);
    const totalPages = Math.ceil(totalCount / pageSize);

    const threats = await Threat.find(query)
      .populate('source', 'name description')
      .populate('reviewedBy', 'name email role')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(pageSize);

    return res.status(200).json({
      status: 'success',
      page: currentPage,
      limit: pageSize,
      totalCount,
      totalPages,
      count: threats.length,
      data: threats,
    });
  } catch (error) {
    console.error('Get My Submissions Error:', error.message);
    return res.status(500).json({
      status: 'error',
      message: 'Server error retrieving personal submissions',
    });
  }
};

/**
 * @desc    Get a single threat indicator by ID
 * @route   GET /api/threats/:id
 * @access  Private (Analyst & Admin)
 */
const getThreatById = async (req, res) => {
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
        message: 'Threat indicator not found',
      });
    }

    // Security check:
    // If threat is Approved: Any authenticated user can view it.
    // If threat is NOT Approved (Pending/Rejected):
    // Only the submitting analyst OR an administrator is authorized to view it.
    if (threat.status !== 'Approved') {
      const isAuthor = threat.submittedBy._id.toString() === req.user._id.toString();
      const isAdmin = req.user.role === 'admin';

      if (!isAuthor && !isAdmin) {
        return res.status(403).json({
          status: 'error',
          message: 'Access forbidden: This submission is currently pending review or has been rejected and is not public.',
        });
      }
    }

    return res.status(200).json({
      status: 'success',
      data: threat,
    });
  } catch (error) {
    console.error('Get Threat By ID Error:', error.message);
    return res.status(500).json({
      status: 'error',
      message: 'Server error retrieving threat indicator',
    });
  }
};

module.exports = {
  createThreat,
  getThreats,
  getMySubmissions,
  getThreatById,
};
