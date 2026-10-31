const express = require('express');
const router = express.Router();
const multer = require('multer');

// Memory storage for file uploads (supports up to 10MB)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

const {
  getArticles,
  getArticleById,
  createArticle,
  updateArticle,
  deleteArticle,
  setHeadline,
  likeArticle,
} = require('../controllers/articleController');
const { protect } = require('../middleware/auth');

// Public read, Protected write (Supports both JSON and Multipart FormData)
router.route('/')
  .get(getArticles)
  .post(protect, upload.single('image'), createArticle);

router.patch('/:id/headline', protect, setHeadline);
router.post('/:id/like', likeArticle);

router.route('/:id')
  .get(getArticleById)
  .put(protect, upload.single('image'), updateArticle)
  .delete(protect, deleteArticle);

module.exports = router;
