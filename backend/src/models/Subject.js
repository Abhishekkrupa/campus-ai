const mongoose = require('mongoose');

const subjectSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    code: { type: String, default: '' },
    department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', default: null },
    description: { type: String, default: '' },
    resourcesCount: { type: Number, default: 0 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    institution: { type: String, default: '' },
  },
  { timestamps: true }
);

subjectSchema.index({ name: 'text' });

module.exports = mongoose.model('Subject', subjectSchema);
