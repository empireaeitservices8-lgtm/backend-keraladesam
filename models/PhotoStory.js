const mongoose = require('mongoose');

const PhotoStorySchema = new mongoose.Schema(
  {
    tagLabel: {
      type: String,
      default: 'PHOTO STORY',
    },
    subtitle: {
      type: String,
      default: 'KERALA IN FRAMES',
    },
    title: {
      type: String,
      required: true,
      default: 'കുട്ടനാടൻ കായൽ ജീവിതം: വേനൽമഴയുടെ വരവറിയിച്ച് ഓളങ്ങൾ',
    },
    description: {
      type: String,
      default: "Visual captures of life, landscapes, and backwaters across God's Own Country.",
    },
    images: [
      {
        url: { type: String, required: true },
        caption: { type: String, default: '' },
      },
    ],
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.models.PhotoStory || mongoose.model('PhotoStory', PhotoStorySchema);
