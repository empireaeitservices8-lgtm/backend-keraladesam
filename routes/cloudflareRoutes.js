const express = require('express');
const router = express.Router();
const multer = require('multer');
const { getCloudflareStatus, uploadMedia } = require('../services/cloudflareService');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 30 * 1024 * 1024 }, // 30MB limit
});

// @desc    Get Cloudflare R2 / CDN integration status
// @route   GET /api/cloudflare/status
// @access  Public
router.get('/status', (req, res) => {
  return res.status(200).json({
    success: true,
    cloudflare: getCloudflareStatus(),
  });
});

// @desc    Upload media to Cloudflare R2 / CDN
// @route   POST /api/cloudflare/upload
// @access  Public / Admin
router.post('/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file provided for upload',
      });
    }

    const result = await uploadMedia(req.file.buffer, req.file.originalname, req.file.mimetype);
    return res.status(200).json({
      success: true,
      message: 'Media uploaded successfully',
      data: result,
    });
  } catch (error) {
    console.error('Cloudflare upload error:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to upload media',
    });
  }
});

module.exports = router;
