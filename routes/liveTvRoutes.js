const express = require('express');
const router = express.Router();
const { getLiveTv, updateLiveTv } = require('../services/mysqlService');
const { protect } = require('../middleware/auth');

// Public read: വെബ്‌സൈറ്റിലെ സന്ദർശകർക്ക് ലൈവ് വീഡിയോ ലഭിക്കാൻ
router.get('/', async (req, res) => {
  try {
    const data = await getLiveTv();
    res.json({ success: true, ...data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Protected write: അഡ്മിന് മാത്രം ലിങ്ക് അപ്‌ഡേറ്റ് ചെയ്യാൻ
router.put('/', protect, async (req, res) => {
  try {
    const { videoId, title } = req.body;
    const data = await updateLiveTv({ videoId, title });
    res.json({ success: true, ...data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;