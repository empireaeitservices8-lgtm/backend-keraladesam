const Subscriber = require('../models/Subscriber');
const mysqlService = require('../services/mysqlService');

exports.subscribe = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email || !email.trim()) {
      return res.status(400).json({
        success: false,
        error: 'ഇമെയിൽ വിലാസം ആവശ്യമാണ് (Email is required)',
      });
    }

    const cleanEmail = email.trim().toLowerCase();
    const emailRegex = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,})+$/;
    if (!emailRegex.test(cleanEmail)) {
      return res.status(400).json({
        success: false,
        error: 'സാധുവായ ഇമെയിൽ വിലാസം നൽകുക (Invalid email address)',
      });
    }

    if (process.env.DB_TYPE === 'mysql') {
      await mysqlService.createSubscriber(cleanEmail);
      return res.status(201).json({
        success: true,
        message: 'നന്ദി! നിങ്ങളുടെ ഇമെയിൽ വിജയകരമായി രജിസ്റ്റർ ചെയ്തു.',
        subscriber: { email: cleanEmail, active: true },
      });
    }

    const existing = await Subscriber.findOne({ email: cleanEmail });
    if (existing) {
      return res.status(200).json({
        success: true,
        alreadySubscribed: true,
        message: 'നിങ്ങൾ ഇതിനകം വിജയകരമായി സബ്‌സ്‌ക്രൈബ് ചെയ്തിട്ടുണ്ട്!',
        subscriber: existing,
      });
    }

    const subscriber = await Subscriber.create({
      email: cleanEmail,
      active: true,
    });

    res.status(201).json({
      success: true,
      message: 'നന്ദി! നിങ്ങളുടെ ഇമെയിൽ വിജയകരമായി രജിസ്റ്റർ ചെയ്തു.',
      subscriber,
    });
  } catch (error) {
    console.error('Subscription error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'സബ്‌സ്ക്രിപ്ഷൻ പരാജയപ്പെട്ടു',
    });
  }
};

exports.getSubscribers = async (req, res) => {
  try {
    if (process.env.DB_TYPE === 'mysql') {
      const subscribers = await mysqlService.getSubscribers();
      return res.status(200).json({
        success: true,
        count: subscribers.length,
        subscribers,
      });
    }

    const subscribers = await Subscriber.find().sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: subscribers.length,
      subscribers,
    });
  } catch (error) {
    console.error('Get subscribers error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch subscribers',
    });
  }
};

exports.deleteSubscriber = async (req, res) => {
  try {
    const { id } = req.params;

    if (process.env.DB_TYPE === 'mysql') {
      const deleted = await mysqlService.deleteSubscriber(id);
      if (!deleted) {
        return res.status(404).json({
          success: false,
          error: 'Subscriber not found',
        });
      }
      return res.status(200).json({
        success: true,
        message: 'Subscriber deleted successfully',
      });
    }

    const subscriber = await Subscriber.findByIdAndDelete(id);

    if (!subscriber) {
      return res.status(404).json({
        success: false,
        error: 'Subscriber not found',
      });
    }

    res.status(200).json({
      success: true,
      message: 'Subscriber deleted successfully',
    });
  } catch (error) {
    console.error('Delete subscriber error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete subscriber',
    });
  }
};

