const mongoose = require('mongoose');

const analyticsSchema = new mongoose.Schema(
  {
    date: { type: String, required: true },
    metric: { type: String, required: true },
    value: { type: Number, default: 0 },
  },
  { timestamps: true }
);

analyticsSchema.index({ date: 1, metric: 1 }, { unique: true });

module.exports = mongoose.model('Analytics', analyticsSchema);
