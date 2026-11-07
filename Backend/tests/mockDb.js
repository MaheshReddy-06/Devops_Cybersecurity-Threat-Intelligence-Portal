/**
 * In-Memory Mock Database for Jest & Supertest Testing
 * Emulates Mongoose CRUD, Query Chains, and Aggregation Pipelines
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const User = require('../models/User');
const Threat = require('../models/Threat');
const Source = require('../models/Source');
const Activity = require('../models/Activity');

// In-memory data store
const store = {
  users: new Map(),
  sources: new Map(),
  threats: new Map(),
  activities: [],
};

function resetMockDb() {
  store.users.clear();
  store.sources.clear();
  store.threats.clear();
  store.activities = [];
}

function filterThreats(list, query) {
  return list.filter((t) => {
    if (query.status) {
      if (typeof query.status === 'object' && query.status.$in) {
        if (!query.status.$in.includes(t.status)) return false;
      } else if (t.status !== query.status) {
        return false;
      }
    }
    if (query.submittedBy && String(t.submittedBy) !== String(query.submittedBy)) return false;
    if (query.indicatorType && t.indicatorType !== query.indicatorType) return false;
    if (query.severity && t.severity !== query.severity) return false;
    if (query.submissionType && t.submissionType !== query.submissionType) return false;
    if (query.source && String(t.source) !== String(query.source)) return false;
    if (query.$or) {
      const match = query.$or.some((item) => {
        for (const [key, val] of Object.entries(item)) {
          if (val instanceof RegExp && val.test(t[key])) return true;
        }
        return false;
      });
      if (!match) return false;
    }
    return true;
  });
}

function initMockDb() {
  // Mock User methods
  User.findOne = async function (filter) {
    if (filter.email) {
      for (const u of store.users.values()) {
        if (u.email === filter.email.toLowerCase()) return u;
      }
    }
    return null;
  };

  User.findById = function (id) {
    const user = store.users.get(String(id));
    const chain = {
      select: function (fields) {
        if (!user) return Promise.resolve(null);
        const copy = { ...user };
        if (fields && fields.includes('-password')) delete copy.password;
        return Promise.resolve(copy);
      },
      then: function (resolve) {
        resolve(user || null);
      },
    };
    return chain;
  };

  User.create = async function (data) {
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(data.password, salt);
    const id = new mongoose.Types.ObjectId().toString();
    const created = {
      _id: id,
      name: data.name,
      email: data.email.toLowerCase(),
      password: hashedPassword,
      role: data.role || 'analyst',
      createdAt: new Date(),
      updatedAt: new Date(),
      matchPassword: async function (entered) {
        return await bcrypt.compare(entered, this.password);
      },
      save: async function () {
        this.updatedAt = new Date();
        if (this.password && !this.password.startsWith('$2')) {
          const salt = await bcrypt.genSalt(10);
          this.password = await bcrypt.hash(this.password, salt);
        }
        store.users.set(this._id, this);
        return this;
      },
    };
    store.users.set(id, created);
    return created;
  };

  // Mock Source methods
  Source.find = function () {
    return {
      sort: async function () {
        return Array.from(store.sources.values());
      },
    };
  };

  Source.findById = async function (id) {
    return store.sources.get(String(id)) || null;
  };

  Source.findOne = async function (filter) {
    if (filter.name) {
      for (const s of store.sources.values()) {
        if (s.name.toLowerCase() === filter.name.toLowerCase()) return s;
      }
    }
    return null;
  };

  Source.create = async function (data) {
    const id = new mongoose.Types.ObjectId().toString();
    const doc = {
      _id: id,
      name: data.name,
      description: data.description || '',
      contact: data.contact || '',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    store.sources.set(id, doc);
    return doc;
  };

  // Mock Activity methods
  Activity.create = async function (data) {
    const doc = {
      _id: new mongoose.Types.ObjectId().toString(),
      ...data,
      createdAt: new Date(),
    };
    store.activities.push(doc);
    return doc;
  };

  Activity.countDocuments = async function (query = {}) {
    let list = store.activities;
    if (query.user) list = list.filter((a) => String(a.user) === String(query.user));
    return list.length;
  };

  Activity.find = function (query = {}) {
    let list = [...store.activities];
    if (query.user) list = list.filter((a) => String(a.user) === String(query.user));
    const chain = {
      populate: function () {
        return chain;
      },
      sort: function () {
        list.sort((a, b) => b.createdAt - a.createdAt);
        return chain;
      },
      skip: function (num) {
        list = list.slice(num);
        return chain;
      },
      limit: async function (num) {
        return list.slice(0, num).map((act) => ({
          ...act,
          user: store.users.get(String(act.user)) || { name: 'User' },
          threat: store.threats.get(String(act.threat)) || null,
        }));
      },
    };
    return chain;
  };

  Activity.aggregate = async function (pipeline) {
    const userMap = new Map();
    for (const act of store.activities) {
      const uId = String(act.user);
      if (!userMap.has(uId)) {
        userMap.set(uId, {
          _id: uId,
          totalActions: 0,
          submissionsLogged: 0,
          approvalsLogged: 0,
          rejectionsLogged: 0,
        });
      }
      const entry = userMap.get(uId);
      entry.totalActions++;
      if (act.action === 'SUBMIT_THREAT') entry.submissionsLogged++;
      if (act.action === 'APPROVE_THREAT') entry.approvalsLogged++;
      if (act.action === 'REJECT_THREAT') entry.rejectionsLogged++;
    }
    return Array.from(userMap.values()).map((entry) => ({
      ...entry,
      userInfo: store.users.get(entry._id) || { name: 'Unknown', email: '', role: '' },
    }));
  };

  // Mock Threat methods
  Threat.countDocuments = async function (query = {}) {
    let list = Array.from(store.threats.values());
    list = filterThreats(list, query);
    return list.length;
  };

  Threat.find = function (query = {}) {
    let list = Array.from(store.threats.values());
    list = filterThreats(list, query);
    const chain = {
      populate: function () {
        return chain;
      },
      sort: function () {
        list.sort((a, b) => b.createdAt - a.createdAt);
        return chain;
      },
      skip: function (num) {
        list = list.slice(num);
        return chain;
      },
      limit: function (num) {
        const sliced = list.slice(0, num);
        return Promise.resolve(
          sliced.map((t) => ({
            ...t,
            source: store.sources.get(String(t.source)) || { name: 'Source' },
            submittedBy: store.users.get(String(t.submittedBy)) || { name: 'Analyst' },
            reviewedBy: t.reviewedBy ? store.users.get(String(t.reviewedBy)) : null,
          }))
        );
      },
      then: function (resolve) {
        resolve(
          list.map((t) => ({
            ...t,
            source: store.sources.get(String(t.source)) || { name: 'Source' },
            submittedBy: store.users.get(String(t.submittedBy)) || { name: 'Analyst' },
            reviewedBy: t.reviewedBy ? store.users.get(String(t.reviewedBy)) : null,
          }))
        );
      },
    };
    return chain;
  };

  Threat.findById = function (id) {
    const threat = store.threats.get(String(id));
    const chain = {
      populate: function () {
        return chain;
      },
      then: function (resolve) {
        if (!threat) return resolve(null);
        return resolve({
          ...threat,
          submittedBy: store.users.get(String(threat.submittedBy)) || { _id: threat.submittedBy },
          source: store.sources.get(String(threat.source)) || { _id: threat.source },
          reviewedBy: threat.reviewedBy ? store.users.get(String(threat.reviewedBy)) : null,
        });
      },
    };
    return chain;
  };

  Threat.create = async function (data) {
    const id = new mongoose.Types.ObjectId().toString();
    const doc = {
      _id: id,
      indicatorValue: data.indicatorValue,
      indicatorType: data.indicatorType,
      category: data.category,
      severity: data.severity || 'Medium',
      description: data.description,
      submissionType: data.submissionType || 'Indicator',
      source: data.source,
      submittedBy: data.submittedBy,
      status: data.status || 'Pending',
      reviewedBy: null,
      reviewComment: '',
      createdAt: new Date(),
      updatedAt: new Date(),
      populate: async function () {
        return this;
      },
      save: async function () {
        this.updatedAt = new Date();
        store.threats.set(this._id, this);
        return this;
      },
    };
    store.threats.set(id, doc);
    return doc;
  };

  Threat.aggregate = async function (pipeline) {
    const groupStage = pipeline.find((stage) => stage.$group);
    if (!groupStage) return [];
    const threats = Array.from(store.threats.values());

    if (groupStage.$group._id === '$indicatorType') {
      const typeMap = new Map();
      for (const t of threats) {
        if (!typeMap.has(t.indicatorType)) {
          typeMap.set(t.indicatorType, {
            _id: t.indicatorType,
            count: 0,
            total: 0,
            approved: 0,
            pending: 0,
            rejected: 0,
            critical: 0,
            high: 0,
            medium: 0,
            low: 0,
          });
        }
        const data = typeMap.get(t.indicatorType);
        data.count++;
        data.total++;
        if (t.status === 'Approved') data.approved++;
        if (t.status === 'Pending') data.pending++;
        if (t.status === 'Rejected') data.rejected++;
        if (t.severity === 'Critical') data.critical++;
        if (t.severity === 'High') data.high++;
        if (t.severity === 'Medium') data.medium++;
        if (t.severity === 'Low') data.low++;
      }
      return Array.from(typeMap.values());
    }

    if (groupStage.$group._id === '$source') {
      const sourceMap = new Map();
      for (const t of threats) {
        const sId = typeof t.source === 'object' && t.source?._id ? String(t.source._id) : String(t.source);
        if (!sourceMap.has(sId)) {
          sourceMap.set(sId, {
            _id: sId,
            totalSubmissions: 0,
            approvedCount: 0,
            rejectedCount: 0,
            pendingCount: 0,
          });
        }
        const data = sourceMap.get(sId);
        data.totalSubmissions++;
        if (t.status === 'Approved') data.approvedCount++;
        if (t.status === 'Rejected') data.rejectedCount++;
        if (t.status === 'Pending') data.pendingCount++;
      }

      return Array.from(sourceMap.values()).map((item) => ({
        ...item,
        sourceInfo: store.sources.get(item._id) || { name: 'Unknown' },
      }));
    }

    return [];
  };
}

module.exports = {
  store,
  initMockDb,
  resetMockDb,
};
