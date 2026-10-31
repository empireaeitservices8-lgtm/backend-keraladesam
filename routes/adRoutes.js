const express = require('express');
const router = express.Router();
const {
  createAdInquiry,
  getAdInquiries,
  updateAdInquiryStatus,
  deleteAdInquiry,
} = require('../controllers/adController');

// Public route to submit ad booking or query
router.post('/inquiry', createAdInquiry);

// Admin routes to view, update and manage inquiries
router.get('/inquiries', getAdInquiries);
router.patch('/inquiries/:id', updateAdInquiryStatus);
router.delete('/inquiries/:id', deleteAdInquiry);

module.exports = router;
