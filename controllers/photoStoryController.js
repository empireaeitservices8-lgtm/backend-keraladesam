const mysqlService = require('../services/mysqlService');

const DEFAULT_PHOTO_STORY = {
  tagLabel: 'PHOTO STORY',
  subtitle: 'KERALA IN FRAMES',
  title: 'കുട്ടനാടൻ കായൽ ജീവിതം: വേനൽമഴയുടെ വരവറിയിച്ച് ഓളങ്ങൾ',
  description: "Visual captures of life, landscapes, and backwaters across God's Own Country.",
  images: [
    {
      url: 'https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?auto=format&fit=crop&w=800&q=80',
      caption: 'കുട്ടനാടൻ കായലിലെ പ്രഭാത കാഴ്ച',
    },
    {
      url: 'https://images.unsplash.com/photo-1512820790803-83ca734da794?auto=format&fit=crop&w=800&q=80',
      caption: 'തനിമയാർന്ന പുസ്തക ശേഖരം',
    },
    {
      url: 'https://images.unsplash.com/photo-1593693397690-362cb9666fc2?auto=format&fit=crop&w=800&q=80',
      caption: 'ആലപ്പുഴ ഹൗസ് ബോട്ട് യാത്ര',
    },
  ],
};

// @desc    Get photo story
// @route   GET /api/photo-story
// @access  Public
exports.getPhotoStory = async (req, res) => {
  try {
    const photoStory = await mysqlService.getPhotoStory();
    res.setHeader('Cache-Control', 's-maxage=10, stale-while-revalidate=60');
    return res.status(200).json({
      success: true,
      photoStory: photoStory || DEFAULT_PHOTO_STORY,
    });
  } catch (error) {
    console.error('Get photo story error handler:', error);
    res.setHeader('Cache-Control', 's-maxage=10, stale-while-revalidate=60');
    return res.status(200).json({
      success: true,
      photoStory: DEFAULT_PHOTO_STORY,
    });
  }
};

// @desc    Update photo story
// @route   PUT /api/photo-story
// @access  Private/Admin
exports.updatePhotoStory = async (req, res) => {
  try {
    const { tagLabel, subtitle, title, description, images } = req.body;

    if (!title || !title.trim()) {
      return res.status(400).json({
        success: false,
        error: 'Title is required',
      });
    }

    const storyData = {
      tagLabel: tagLabel || 'PHOTO STORY',
      subtitle: subtitle || 'KERALA IN FRAMES',
      title: title.trim(),
      description: (description || '').trim(),
      images: Array.isArray(images) ? images : [],
    };

    const updated = await mysqlService.updatePhotoStory(storyData);

    return res.status(200).json({
      success: true,
      message: 'Photo Story updated successfully',
      photoStory: updated || storyData,
    });
  } catch (error) {
    console.error('Update photo story error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update photo story',
    });
  }
};
