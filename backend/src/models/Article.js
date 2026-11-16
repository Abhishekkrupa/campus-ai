const mongoose = require('mongoose');

const articleSchema = new mongoose.Schema(
  {
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, maxlength: 300 },
    subtitle: { type: String, default: '' },
    content: { type: String, default: '' },
    cover: { type: String, default: '' },
    tags: [{ type: String }],
    subject: { type: String, default: '' },
    views: { type: Number, default: 0 },
    likesCount: { type: Number, default: 0 },
    commentsCount: { type: Number, default: 0 },
    sharesCount: { type: Number, default: 0 },
    readingTime: { type: Number, default: 0 },
    status: { type: String, enum: ['draft', 'published', 'removed'], default: 'published' },
  },
  { timestamps: true }
);

articleSchema.index({ author: 1, createdAt: -1 });
articleSchema.index({ title: 'text' });

module.exports = mongoose.model('Article', articleSchema);
