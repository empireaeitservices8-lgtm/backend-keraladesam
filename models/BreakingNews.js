const mongoose = require('mongoose');

const BreakingNewsSchema = new mongoose.Schema(
  {
    headline: {
      type: String,
      required: [true, 'Please provide breaking news headline'],
      trim: true,
    },
    category: {
      type: String,
      default: 'തത്സമയം',
    },
    active: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('BreakingNews', BreakingNewsSchema);
