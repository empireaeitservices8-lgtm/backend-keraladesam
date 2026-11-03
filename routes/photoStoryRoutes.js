const express = require('express');
const router = express.Router();
const { getPhotoStory, updatePhotoStory } = require('../controllers/photoStoryController');
const { protect, authorize } = require('../middleware/auth');

router.get('/', getPhotoStory);
router.put('/', protect, authorize('admin', 'editor'), updatePhotoStory);

module.exports = router;
