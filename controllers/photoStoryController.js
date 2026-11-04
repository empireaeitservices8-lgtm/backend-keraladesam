const mysqlService = require('../services/mysqlService');

// @desc    Get photo story
// @route   GET /api/photo-story
// @access  Public
exports.getPhotoStory = async (req, res) => {
  try {
    const photoStory = await mysqlService.getPhotoStory();
    res.setHeader('Cache-Control', 's-maxage=5, stale-while-revalidate=30');
    return res.status(200).json({
      success: true,
      photoStory: photoStory || null,
    });
  } catch (error) {
    console.error('Get photo story error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch photo story',
    });
  }
};

// @desc    Update photo story
// @route   PUT /api/photo-story
// @access  Private/Admin
exports.updatePhotoStory = async (req, res) => {
  try {
    const { tagLabel, subtitle, title, description, images } = req.body || {};

    const titleVal = title && title.trim() ? title.trim() : 'കേരളദേശം ഫോട്ടോ സ്റ്റോറി';

    const storyData = {
      tagLabel: tagLabel || 'PHOTO STORY',
      subtitle: subtitle || 'KERALA IN FRAMES',
      title: titleVal,
      description: (description || '').trim(),
      images: Array.isArray(images) ? images : [],
    };

    const updated = await mysqlService.updatePhotoStory(storyData);

    return res.status(200).json({
      success: true,
      message: 'Photo Story updated successfully',
      photoStory: updated,
    });
  } catch (error) {
    console.error('Update photo story error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to update photo story',
    });
  }
};
