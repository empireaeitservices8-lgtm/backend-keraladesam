const mongoose = require('mongoose');

const videoSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Video title is required'],
      trim: true,
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      trim: true,
      default: 'KERALA',
    },
    duration: {
      type: String,
      default: '01:30',
      trim: true,
    },
    views: {
      type: String,
      default: '1.2K',
      trim: true,
    },
    viewsCount: {
      type: Number,
      default: 1,
    },
    thumbnail: {
      type: String,
      default: '',
    },
    videoUrl: {
      type: String,
      required: [true, 'Video URL is required'],
      trim: true,
    },
    youtubeId: {
      type: String,
      default: '',
      trim: true,
    },
    description: {
      type: String,
      default: '',
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Video', videoSchema);
