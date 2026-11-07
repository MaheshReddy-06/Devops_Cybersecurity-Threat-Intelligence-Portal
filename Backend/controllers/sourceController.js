const Source = require('../models/Source');

/**
 * @desc    Get all intelligence sources
 * @route   GET /api/sources
 * @access  Private
 */
const getSources = async (req, res) => {
  try {
    const sources = await Source.find().sort({ name: 1 });
    return res.status(200).json({
      status: 'success',
      count: sources.length,
      data: sources,
    });
  } catch (error) {
    console.error('Get Sources Error:', error.message);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to retrieve intelligence sources',
    });
  }
};

/**
 * @desc    Create a new intelligence source
 * @route   POST /api/sources
 * @access  Private
 */
const createSource = async (req, res) => {
  try {
    const { name, description, contact } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({
        status: 'error',
        message: 'Source name is required',
      });
    }

    const trimmedName = name.trim();
    const existingSource = await Source.findOne({ name: trimmedName });
    if (existingSource) {
      return res.status(400).json({
        status: 'error',
        message: 'A threat intelligence source with this name already exists',
      });
    }

    const source = await Source.create({
      name: trimmedName,
      description: description ? description.trim() : '',
      contact: contact ? contact.trim() : '',
    });

    return res.status(201).json({
      status: 'success',
      message: 'Intelligence source created successfully',
      data: source,
    });
  } catch (error) {
    console.error('Create Source Error:', error.message);
    return res.status(500).json({
      status: 'error',
      message: 'Failed to create intelligence source',
    });
  }
};

module.exports = {
  getSources,
  createSource,
};
