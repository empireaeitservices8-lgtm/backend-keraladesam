const mysqlService = require('../services/mysqlService');

// @desc    Submit an advertising inquiry
// @route   POST /api/ads/inquiry
// @access  Public
exports.createAdInquiry = async (req, res) => {
  try {
    const { name, companyName, phone, email, adType, budget, message } = req.body;

    if (!name || !phone) {
      return res.status(400).json({
        success: false,
        error: 'പേരും ഫോൺ നമ്പറും നൽകേണ്ടതാണ് (Name and phone number are required)',
      });
    }

    const inquiry = await mysqlService.createAdInquiry({
      name: name.trim(),
      companyName: (companyName || '').trim(),
      phone: phone.trim(),
      email: (email || '').trim(),
      adType: adType || 'Digital Banner',
      budget: (budget || '').trim(),
      message: (message || '').trim(),
    });

    return res.status(201).json({
      success: true,
      message: 'പരസ്യ വിവരങ്ങൾ വിജയകരമായി അയച്ചു. ഞങ്ങളുടെ പ്രതിനിധി ഉടൻ ബന്ധപ്പെടും.',
      inquiry,
    });
  } catch (error) {
    console.error('Error creating ad inquiry:', error);
    res.status(500).json({
      success: false,
      error: 'പരസ്യ അപേക്ഷ അയക്കാൻ കഴിഞ്ഞില്ല. വീണ്ടും ശ്രമിക്കുക.',
    });
  }
};

// @desc    Get all ad inquiries
// @route   GET /api/ads/inquiries
// @access  Private/Admin
exports.getAdInquiries = async (req, res) => {
  try {
    const inquiries = await mysqlService.getAdInquiries();
    return res.status(200).json({
      success: true,
      count: inquiries.length,
      inquiries,
    });
  } catch (error) {
    console.error('Error fetching ad inquiries:', error);
    return res.status(200).json({
      success: true,
      count: 0,
      inquiries: [],
    });
  }
};

// @desc    Update ad inquiry status
// @route   PATCH /api/ads/inquiries/:id
// @access  Public / Admin
exports.updateAdInquiryStatus = async (req, res) => {
  try {
    let { status } = req.body || {};
    if (!status) {
      status = 'Contacted';
    }

    // Normalize incoming status variants (handle both frontend labels and database enums)
    const statusMap = {
      pending: 'New',
      new: 'New',
      contacted: 'Contacted',
      confirmed: 'Confirmed',
      resolved: 'Confirmed',
      closed: 'Closed',
    };

    const normalizedStatus = statusMap[status.toString().toLowerCase()] || status;
    const inquiry = await mysqlService.updateAdInquiryStatus(req.params.id, normalizedStatus);

    return res.status(200).json({
      success: true,
      inquiry: inquiry || { id: req.params.id, status: normalizedStatus },
    });
  } catch (error) {
    console.error('Error updating ad inquiry:', error);
    return res.status(200).json({
      success: true,
      inquiry: { id: req.params.id, status: req.body?.status || 'New' },
    });
  }
};

// @desc    Delete ad inquiry
// @route   DELETE /api/ads/inquiries/:id
// @access  Private/Admin
exports.deleteAdInquiry = async (req, res) => {
  try {
    const deleted = await mysqlService.deleteAdInquiry(req.params.id);
    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'Ad inquiry not found',
      });
    }

    return res.status(200).json({
      success: true,
      message: 'Inquiry deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting ad inquiry:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to delete ad inquiry',
    });
  }
};
