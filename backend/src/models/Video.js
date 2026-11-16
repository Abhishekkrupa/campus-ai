const mongoose = require('mongoose');

const videoSchema = new mongoose.Schema(
  {
    creator: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, maxlength: 200 },
    description: { type: String, default: '', maxlength: 3000 },
    videoUrl: { type: String, default: '' },
    thumbnail: { type: String, default: '' },
    duration: { type: Number, default: 0 },
    subject: { type: String, default: '' },
    department: { type: String, default: '' },
    tags: [{ type: String }],
    views: { type: Number, default: 0 },
    likesCount: { type: Number, default: 0 },
    commentsCount: { type: Number, default: 0 },
    sharesCount: { type: Number, default: 0 },
    savesCount: { type: Number, default: 0 },
    status: { type: String, enum: ['active', 'removed', 'hidden'], default: 'active' },
  },
  { timestamps: true }
);

videoSchema.index({ creator: 1, createdAt: -1 });
videoSchema.index({ title: 'text' });
videoSchema.index({ subject: 1 });

module.exports = mongoose.model('Video', videoSchema);
