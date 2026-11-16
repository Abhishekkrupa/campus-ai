const mongoose = require('mongoose');

const departmentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    code: { type: String, required: true, unique: true },
    description: { type: String, default: '' },
    color: { type: String, default: '#7c5cff' },
    icon: { type: String, default: '' },
    resourcesCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Department', departmentSchema);
