const mongoose = require('mongoose');

const noteSchema = new mongoose.Schema(
  {
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, maxlength: 200 },
    description: { type: String, default: '', maxlength: 1000 },
    subject: { type: String, default: '' },
    department: { type: String, default: '' },
    fileUrl: { type: String, default: '' },
    fileType: { type: String, enum: ['pdf', 'doc', 'docx', 'ppt', 'pptx', 'txt', 'md', 'image', 'other'], default: 'pdf' },
    fileSize: { type: Number, default: 0 },
    pageCount: { type: Number, default: 0 },
    tags: [{ type: String }],
    extractedText: { type: String, default: '', select: false },
    downloads: { type: Number, default: 0 },
    likesCount: { type: Number, default: 0 },
    savesCount: { type: Number, default: 0 },
    views: { type: Number, default: 0 },
    status: { type: String, enum: ['active', 'removed', 'hidden'], default: 'active' },
  },
  { timestamps: true }
);

noteSchema.index({ author: 1, createdAt: -1 });
noteSchema.index({ subject: 1 });
noteSchema.index({ title: 'text' });

module.exports = mongoose.model('Note', noteSchema);
