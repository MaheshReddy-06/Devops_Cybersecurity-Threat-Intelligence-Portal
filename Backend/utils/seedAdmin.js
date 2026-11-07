const path = require('path');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

// Ensure environment variables from Backend/.env are loaded
dotenv.config({ path: path.join(__dirname, '../.env') });

const User = require('../models/User');

const seedAdmin = async () => {
  const adminName = process.env.ADMIN_NAME || 'System Administrator';
  const adminEmail = (process.env.ADMIN_EMAIL || 'admin@portal.local').trim().toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminPassword) {
    console.error('Error: ADMIN_PASSWORD environment variable is required to seed an administrator.');
    process.exit(1);
  }

  const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/cyber_threat_intel';

  try {
    console.log(`[Seed Admin] Connecting to database at ${mongoUri}...`);
    await mongoose.connect(mongoUri);
    console.log('[Seed Admin] Database connected successfully.');

    // Check if an account already exists with the admin email
    const existingAdmin = await User.findOne({ email: adminEmail });

    if (existingAdmin) {
      if (existingAdmin.role === 'admin') {
        console.log(`[Seed Admin] Administrator account already exists: ${adminEmail}`);
      } else {
        existingAdmin.role = 'admin';
        await existingAdmin.save();
        console.log(`[Seed Admin] Existing user ${adminEmail} updated to 'admin' role.`);
      }
    } else {
      // Create new administrator account (pre-save hook in User model will hash password)
      const newAdmin = await User.create({
        name: adminName,
        email: adminEmail,
        password: adminPassword,
        role: 'admin',
      });

      console.log(`[Seed Admin] New administrator created successfully!`);
      console.log(` - ID: ${newAdmin._id}`);
      console.log(` - Name: ${newAdmin.name}`);
      console.log(` - Email: ${newAdmin.email}`);
      console.log(` - Role: ${newAdmin.role}`);
    }

    await mongoose.disconnect();
    console.log('[Seed Admin] Process finished cleanly.');
    process.exit(0);
  } catch (error) {
    console.error('[Seed Admin Error]:', error.message);
    try {
      await mongoose.disconnect();
    } catch (_) {}
    process.exit(1);
  }
};

// Execute if run directly via CLI
if (require.main === module) {
  seedAdmin();
}

module.exports = seedAdmin;
