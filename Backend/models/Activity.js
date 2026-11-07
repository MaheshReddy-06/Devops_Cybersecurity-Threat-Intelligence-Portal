const mongoose = require('mongoose');

const activitySchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User reference is required'],
      index: true,
    },
    threat: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Threat',
      default: null,
      index: true,
    },
    action: {
      type: String,
      required: [true, 'Action is required'],
      trim: true,
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

const Activity = mongoose.model('Activity', activitySchema);

module.exports = Activity;
