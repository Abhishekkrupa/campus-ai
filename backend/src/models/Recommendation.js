const mongoose = require('mongoose');

const recommendationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    targetType: { type: String, enum: ['user', 'creator', 'note', 'video', 'post', 'subject'], required: true },
    targetId: { type: mongoose.Schema.Types.ObjectId, required: true },
    score: { type: Number, default: 0 },
    source: { type: String, enum: ['content-based', 'tf-idf', 'collaborative', 'trending', 'collaborative-filtering', 'embeddings'], default: 'tf-idf' },
  },
  { timestamps: true }
);

recommendationSchema.index({ user: 1, targetType: 1 });

module.exports = mongoose.model('Recommendation', recommendationSchema);
