const mongoose = require('mongoose');
const config = require('./index');

const connectDB = async () => {
  if (!config.mongoURI) {
    console.warn('MONGODB_URI not set; skipping MongoDB connection (legacy Mongoose paths may fail until migrated/configured).');
    return null;
  }

  try {
    const conn = await mongoose.connect(config.mongoURI);
    console.log(`MongoDB connected: ${conn.connection.host}`);
    return conn;
  } catch (err) {
    console.error(`MongoDB connection error: ${err.message}`);
    if (process.env.NODE_ENV === 'production') {
      throw err;
    }
    process.exit(1);
  }
};

module.exports = connectDB;
