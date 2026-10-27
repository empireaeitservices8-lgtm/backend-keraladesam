const express = require('express');
const router = express.Router();
const multer = require('multer');

// Memory storage for thumbnail file uploads (supports up to 10MB)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

const {
  getVideos,
  getVideoById,
  createVideo,
  updateVideo,
  deleteVideo,
} = require('../controllers/videoController');
const { protect } = require('../middleware/auth');

// Public read, Protected write
router.route('/')
  .get(getVideos)
  .post(protect, upload.single('thumbnail'), createVideo);

router.route('/:id')
  .get(getVideoById)
  .put(protect, upload.single('thumbnail'), updateVideo)
  .delete(protect, deleteVideo);

module.exports = router;
