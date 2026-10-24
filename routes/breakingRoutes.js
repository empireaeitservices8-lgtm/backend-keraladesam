const express = require('express');
const router = express.Router();
const {
  getBreakingNews,
  addBreakingNews,
  deleteBreakingNews,
} = require('../controllers/breakingController');
const { protect } = require('../middleware/auth');

router.route('/')
  .get(getBreakingNews)
  .post(protect, addBreakingNews);

router.route('/:id')
  .delete(protect, deleteBreakingNews);

module.exports = router;
