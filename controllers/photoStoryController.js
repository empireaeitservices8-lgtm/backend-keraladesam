const mysqlService = require('../services/mysqlService');
const storageService = require('../services/storageService');

// @desc    Get photo story
// @route   GET /api/photo-story
// @access  Public
exports.getPhotoStory = async (req, res) => {
  try {
    const photoStory = await mysqlService.getPhotoStory();
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    return res.status(200).json({
      success: true,
      photoStory: photoStory || null,
    });
  } catch (error) {
    console.warn('Get photo story warning:', error.message);
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    return res.status(200).json({
      success: true,
      photoStory: null,
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

    let processedImages = [];
    if (Array.isArray(images)) {
      for (let i = 0; i < images.length; i++) {
        const item = images[i];
        if (!item) continue;
        let url = typeof item.url === 'string' ? item.url.trim() : '';
        const caption = typeof item.caption === 'string' ? item.caption.trim() : '';

        // If the image is a base64 string, upload it to storageService
        if (url.startsWith('data:')) {
          try {
            const uploadRes = await storageService.uploadMedia(
              url,
              `story-${i}-${Date.now()}.jpg`,
              'image/jpeg',
              'keraladesam/photo-stories'
            );
            if (uploadRes && uploadRes.url) {
              url = uploadRes.url;
            }
          } catch (uploadErr) {
            console.warn('Photo story image upload warning:', uploadErr.message);
          }
        }

        if (url) {
          processedImages.push({ url, caption });
        }
      }
    }

    const storyData = {
      tagLabel: tagLabel || 'PHOTO STORY',
      subtitle: subtitle || 'KERALA IN FRAMES',
      title: titleVal,
      description: (description || '').trim(),
      images: processedImages,
    };

    let updated = null;
    try {
      updated = await mysqlService.updatePhotoStory(storyData);
    } catch (dbErr) {
      console.warn('MySQL updatePhotoStory warning:', dbErr.message);
    }

    return res.status(200).json({
      success: true,
      message: 'Photo Story updated successfully',
      photoStory: updated || storyData,
    });
  } catch (error) {
    console.error('Update photo story error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to update photo story',
    });
  }
};

// @desc    Delete photo story
// @route   DELETE /api/photo-story
// @access  Private/Admin
exports.deletePhotoStory = async (req, res) => {
  try {
    try {
      await mysqlService.deletePhotoStory();
    } catch (dbErr) {
      console.warn('MySQL deletePhotoStory warning:', dbErr.message);
    }
    return res.status(200).json({
      success: true,
      message: 'Photo Story deleted successfully',
    });
  } catch (error) {
    console.error('Delete photo story error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete photo story',
    });
  }
};
