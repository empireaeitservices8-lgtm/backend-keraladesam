const mongoose = require('mongoose');

const adInquirySchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please enter contact name'],
    trim: true,
  },
  companyName: {
    type: String,
    trim: true,
    default: '',
  },
  phone: {
    type: String,
    required: [true, 'Please enter phone number'],
    trim: true,
  },
  email: {
    type: String,
    trim: true,
    lowercase: true,
    default: '',
  },
  adType: {
    type: String,
    required: [true, 'Please select advertising type'],
    default: 'Digital Banner',
  },
  budget: {
    type: String,
    trim: true,
    default: '',
  },
  message: {
    type: String,
    trim: true,
    default: '',
  },
  status: {
    type: String,
    enum: ['New', 'Contacted', 'Confirmed', 'Closed'],
    default: 'New',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('AdInquiry', adInquirySchema);

