const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const threatRoutes = require('./routes/threatRoutes');
const sourceRoutes = require('./routes/sourceRoutes');
const adminRoutes = require('./routes/adminRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const activityRoutes = require('./routes/activityRoutes');
const reportRoutes = require('./routes/reportRoutes');

// Load environment variables
dotenv.config();

// Initialize Express application
const app = express();

// Connect to MongoDB (skip auto-connection during test execution)
if (process.env.NODE_ENV !== 'test') {
  connectDB();
}

// Configure CORS for frontend access
const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
app.use(cors({
  origin: [clientUrl, 'http://localhost:5173', 'http://127.0.0.1:5173'],
  credentials: true,
}));

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health Check Endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    message: 'Cybersecurity Threat Intelligence Sharing Portal API is operational',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
  });
});

// Authentication Routes
app.use('/api/auth', authRoutes);

// Threat Intelligence Routes
app.use('/api/threats', threatRoutes);

// Intelligence Sources Routes
app.use('/api/sources', sourceRoutes);

// Admin Moderation Routes
app.use('/api/admin', adminRoutes);

// Dashboard Analytics Routes
app.use('/api/dashboard', dashboardRoutes);

// Activity Audit Log Routes
app.use('/api/activities', activityRoutes);

// Mandatory Reports Routes
app.use('/api/reports', reportRoutes);

// Root API Endpoint
app.get('/', (req, res) => {
  res.status(200).json({
    name: 'Cybersecurity Threat Intelligence API',
    status: 'active',
    healthCheck: '/api/health',
  });
});

// Server listener (only start TCP listener when not running under test suite)
const PORT = process.env.PORT || 5000;
let server;
if (process.env.NODE_ENV !== 'test') {
  server = app.listen(PORT, () => {
    console.log(`[Server] Running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
    console.log(`[Health Check] http://localhost:${PORT}/api/health`);
  });
}

module.exports = { app, server };
