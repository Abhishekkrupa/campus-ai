const mongoose = require('mongoose');

const commentSchema = new mongoose.Schema(
  {
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    targetType: { type: String, enum: ['Post', 'Video', 'Note', 'Article'], required: true },
    targetId: { type: mongoose.Schema.Types.ObjectId, required: true },
    content: { type: String, required: true, maxlength: 1000 },
    parent: { type: mongoose.Schema.Types.ObjectId, ref: 'Comment', default: null },
    likesCount: { type: Number, default: 0 },
    status: { type: String, enum: ['active', 'removed'], default: 'active' },
  },
  { timestamps: true }
);

commentSchema.index({ targetType: 1, targetId: 1, createdAt: -1 });

module.exports = mongoose.model('Comment', commentSchema);
