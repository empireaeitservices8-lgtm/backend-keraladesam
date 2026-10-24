const express = require('express');
const router = express.Router();
const {
  getArticles,
  getArticleById,
  createArticle,
  updateArticle,
  deleteArticle,
} = require('../controllers/articleController');
const { protect } = require('../middleware/auth');

// Public read, Protected write (Only logged-in Admin/Editor can create/edit/delete)
router.route('/')
  .get(getArticles)
  .post(protect, createArticle);

router.route('/:id')
  .get(getArticleById)
  .put(protect, updateArticle)
  .delete(protect, deleteArticle);

module.exports = router;
