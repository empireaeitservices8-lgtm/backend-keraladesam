const mongoose = require('mongoose');

const ArticleSchema = new mongoose.Schema(
  {
    customId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    title: {
      type: String,
      required: [true, 'Please provide article title in Malayalam/English'],
      trim: true,
    },
    lead: {
      type: String,
      required: [true, 'Please provide article summary lead'],
      trim: true,
    },
    category: {
      type: String,
      required: [true, 'Please provide article category'],
      index: true,
    },
    categoryColor: {
      type: String,
      default: '#006b9a',
    },
    imageUrl: {
      type: String,
      required: true,
    },
    imageCaption: {
      type: String,
      default: '',
    },
    readTime: {
      type: String,
      default: '3 മിനിറ്റ് വായന',
    },
    audioDuration: {
      type: String,
      default: '03:00',
    },
    paragraphs: {
      type: [String],
      required: true,
    },
    highlights: {
      type: [String],
      default: [],
    },
    author: {
      name: { type: String, required: true },
      designation: { type: String, default: 'ലേഖകൻ' },
      location: { type: String, default: 'കേരളം' },
      avatar: {
        type: String,
        default:
          'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
      },
      verified: { type: Boolean, default: true },
    },
    district: {
      type: String,
      default: '',
    },
    country: {
      type: String,
      default: '',
    },
    views: {
      type: String,
      default: '1.2k',
    },
    tags: {
      type: [String],
      default: [],
    },
    trending: {
      type: Boolean,
      default: false,
    },
    breaking: {
      type: Boolean,
      default: false,
    },
    publishedAt: {
      type: String,
      default: () =>
        new Date().toLocaleString('ml-IN', {
          dateStyle: 'medium',
          timeStyle: 'short',
        }),
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Article', ArticleSchema);
