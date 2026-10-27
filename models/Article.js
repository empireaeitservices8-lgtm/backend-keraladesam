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
      required: false,
      default: '',
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
      required: false,
      default: '',
    },
    imageData: {
      type: Buffer,
      select: false,
    },
    imageContentType: {
      type: String,
      enum: ['image/jpeg', 'image/png', 'image/webp'],
      select: false,
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
      required: false,
      default: [],
    },
    highlights: {
      type: [String],
      default: [],
    },
    author: {
      name: { type: String, default: 'കേരളദേശം ന്യൂസ് ഡെസ്ക്' },
      designation: { type: String, default: 'ഡെസ്ക് റിപ്പോർട്ടർ' },
      location: { type: String, default: 'കേരളം' },
      avatar: {
        type: String,
        default:
          'https://images.unsplash.com/photo-1585829365295-ab7cd400c167?auto=format&fit=crop&w=400&q=80',
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
      default: '1',
    },
    viewsCount: {
      type: Number,
      default: 1,
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
    isHeadline: {
      type: Boolean,
      default: false,
      index: true,
    },
    publishedAt: {
      type: String,
      default: () =>
        new Date().toLocaleString('ml-IN', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        }),
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Article', ArticleSchema);
