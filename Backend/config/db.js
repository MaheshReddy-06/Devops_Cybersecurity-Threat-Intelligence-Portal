const mongoose = require('mongoose');

/**
 * Establishes connection to the MongoDB database using Mongoose.
 * Kept separate from server.js for modular architecture.
 */
const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/cyber_threat_intel';
    const conn = await mongoose.connect(mongoUri);
    console.log(`[Database] MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`[Database Error] MongoDB connection failed: ${error.message}`);
    // Log the error without killing the process immediately so health checks can still run if Mongo is offline
  }
};

module.exports = connectDB;
