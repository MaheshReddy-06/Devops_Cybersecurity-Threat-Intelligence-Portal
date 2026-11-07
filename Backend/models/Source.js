const mongoose = require('mongoose');

const sourceSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Source name is required'],
      unique: true,
      trim: true,
      index: true,
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    contact: {
      type: String,
      trim: true,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

const Source = mongoose.model('Source', sourceSchema);

module.exports = Source;
