const mongoose = require('mongoose');
const { reportCategories, reportTargetTypes } = require('../utils/constants');

const reportSchema = new mongoose.Schema(
  {
    reportedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    targetType: { type: String, enum: reportTargetTypes, required: true },
    targetId: { type: mongoose.Schema.Types.ObjectId, required: true },
    category: { type: String, enum: reportCategories, required: true },
    description: { type: String, default: '', maxlength: 1000 },
    status: { type: String, enum: ['pending', 'approved', 'dismissed'], default: 'pending' },
    adminNote: { type: String, default: '' },
    handledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

reportSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('Report', reportSchema);
