const mongoose = require('mongoose');

const threatSchema = new mongoose.Schema(
  {
    indicatorValue: {
      type: String,
      required: [true, 'Indicator value is required'],
      trim: true,
      index: true,
    },
    indicatorType: {
      type: String,
      required: [true, 'Indicator type is required'],
      enum: {
        values: ['IP', 'Domain', 'URL', 'Hash'],
        message: '{VALUE} is not a valid indicator type. Allowed types are: IP, Domain, URL, Hash',
      },
      index: true,
    },
    category: {
      type: String,
      required: [true, 'Threat category is required'],
      trim: true,
    },
    severity: {
      type: String,
      required: [true, 'Severity is required'],
      enum: {
        values: ['Critical', 'High', 'Medium', 'Low'],
        message: '{VALUE} is not a valid severity. Allowed: Critical, High, Medium, Low',
      },
      default: 'Medium',
      index: true,
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
    },
    submissionType: {
      type: String,
      required: [true, 'Submission type is required'],
      enum: {
        values: ['Indicator', 'Advisory', 'Observation'],
        message: '{VALUE} is not a valid submission type. Allowed: Indicator, Advisory, Observation',
      },
      default: 'Indicator',
    },
    source: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Source',
      required: [true, 'Source reference is required'],
      index: true,
    },
    submittedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Submitting user reference is required'],
      index: true,
    },
    status: {
      type: String,
      enum: {
        values: ['Pending', 'Approved', 'Rejected'],
        message: '{VALUE} is not a valid status. Allowed: Pending, Approved, Rejected',
      },
      default: 'Pending',
      index: true,
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    reviewComment: {
      type: String,
      trim: true,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

const Threat = mongoose.model('Threat', threatSchema);

module.exports = Threat;
