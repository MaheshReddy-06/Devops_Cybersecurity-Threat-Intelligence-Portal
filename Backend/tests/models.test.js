/**
 * Mongoose Models and Schema Validation Test Suite
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const User = require('../models/User');
const Threat = require('../models/Threat');
const Source = require('../models/Source');
const Activity = require('../models/Activity');

describe('MongoDB Models & Schema Validation', () => {
  describe('User Model Schema', () => {
    it('should validate required fields for User', () => {
      const user = new User();
      const err = user.validateSync();
      expect(err.errors.name).toBeDefined();
      expect(err.errors.email).toBeDefined();
      expect(err.errors.password).toBeDefined();
    });

    it('should enforce role enum (analyst or admin)', () => {
      const user = new User({
        name: 'Hacker',
        email: 'hacker@test.local',
        password: 'Password123!',
        role: 'superadmin', // Invalid role
      });
      const err = user.validateSync();
      expect(err.errors.role).toBeDefined();
    });

    it('should default role to analyst', () => {
      const user = new User({
        name: 'Valid Analyst',
        email: 'analyst@test.local',
        password: 'Password123!',
      });
      expect(user.role).toBe('analyst');
    });
  });

  describe('Threat Model Schema', () => {
    it('should validate required fields for Threat', () => {
      const threat = new Threat();
      const err = threat.validateSync();
      expect(err.errors.indicatorValue).toBeDefined();
      expect(err.errors.indicatorType).toBeDefined();
      expect(err.errors.category).toBeDefined();
    });

    it('should enforce indicatorType enum (IP, Domain, URL, Hash)', () => {
      const threat = new Threat({
        indicatorValue: 'test',
        indicatorType: 'INVALID_TYPE',
        category: 'Malware',
      });
      const err = threat.validateSync();
      expect(err.errors.indicatorType).toBeDefined();
    });

    it('should enforce severity enum (Critical, High, Medium, Low)', () => {
      const threat = new Threat({
        indicatorValue: '192.168.1.1',
        indicatorType: 'IP',
        category: 'Scanner',
        severity: 'Catastrophic', // Invalid severity
      });
      const err = threat.validateSync();
      expect(err.errors.severity).toBeDefined();
    });

    it('should default status to Pending', () => {
      const threat = new Threat({
        indicatorValue: '198.51.100.1',
        indicatorType: 'IP',
        category: 'C2',
      });
      expect(threat.status).toBe('Pending');
    });
  });

  describe('Source Model Schema', () => {
    it('should validate required source name', () => {
      const source = new Source();
      const err = source.validateSync();
      expect(err.errors.name).toBeDefined();
    });
  });

  describe('Activity Model Schema', () => {
    it('should validate required activity fields', () => {
      const activity = new Activity();
      const err = activity.validateSync();
      expect(err.errors.user).toBeDefined();
      expect(err.errors.action).toBeDefined();
    });
  });
});
