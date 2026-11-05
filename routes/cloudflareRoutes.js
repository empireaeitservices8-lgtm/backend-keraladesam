const express = require('express');
const router = express.Router();
const multer = require('multer');
const { getCloudflareStatus, uploadMedia } = require('../services/cloudflareService');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 30 * 1024 * 1024 }, // 30MB limit
});

const uploadFields = upload.fields([
  { name: 'file', maxCount: 1 },
  { name: 'image', maxCount: 1 },
]);

// @desc    Get storage / Cloudflare integration status
// @route   GET /api/upload OR /api/cloudflare/status
router.get(['/', '/status'], (req, res) => {
  return res.status(200).json({
    success: true,
    cloudflare: getCloudflareStatus(),
  });
});

// @desc    Upload media to active storage provider (Cloudinary / Cloudflare R2 / Resilient Data-URL)
// @route   POST /api/upload OR /api/upload/upload OR /api/cloudflare/upload
router.post(['/', '/upload'], uploadFields, async (req, res) => {
  try {
    const file = req.file || req.files?.file?.[0] || req.files?.image?.[0];
    if (!file) {
      return res.status(400).json({
        success: false,
        error: 'No file provided for upload',
      });
    }

    const result = await uploadMedia(file.buffer, file.originalname, file.mimetype);
    return res.status(200).json({
      success: true,
      message: 'Media uploaded successfully',
      data: result,
      url: result.url,
    });
  } catch (error) {
    console.error('Upload error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to upload media',
    });
  }
});

module.exports = router;

