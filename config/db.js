const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGODB_URL || process.env.MONGODB_URI;
    if (!mongoUri) {
      throw new Error('Neither MONGODB_URL nor MONGODB_URI is defined in .env');
    }
    const conn = await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 8000,
    });
    console.log(`✅ MongoDB Connected: ${conn.connection.host}/${conn.connection.name}`);
    return conn;
  } catch (error) {
    console.error(`❌ MongoDB Connection Error: ${error.message}`);
    console.log(`⚠️ Tip: Make sure MongoDB is running or configure MONGODB_URI in backend/.env`);
    return null;
  }
};

module.exports = connectDB;
