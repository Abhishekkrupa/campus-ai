const mongoose = require('mongoose');

const postSchema = new mongoose.Schema(
  {
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: ['text', 'image', 'video', 'note', 'article', 'quiz', 'announcement'], default: 'text' },
    content: { type: String, default: '', maxlength: 5000 },
    media: [{ type: String }],
    tags: [{ type: String }],
    subject: { type: String, default: '' },
    department: { type: String, default: '' },
    likesCount: { type: Number, default: 0 },
    commentsCount: { type: Number, default: 0 },
    sharesCount: { type: Number, default: 0 },
    savesCount: { type: Number, default: 0 },
    views: { type: Number, default: 0 },
    status: { type: String, enum: ['active', 'removed', 'hidden'], default: 'active' },
    isPinned: { type: Boolean, default: false },
  },
  { timestamps: true }
);

postSchema.index({ author: 1, createdAt: -1 });
postSchema.index({ tags: 1 });
postSchema.index({ content: 'text' });

module.exports = mongoose.model('Post', postSchema);
