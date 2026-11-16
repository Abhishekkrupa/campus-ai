const mongoose = require('mongoose');

const quizSchema = new mongoose.Schema(
  {
    creator: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true },
    description: { type: String, default: '' },
    subject: { type: String, default: '' },
    questions: [
      {
        question: { type: String, required: true },
        options: [String],
        answer: { type: String, default: '' },
        explanation: { type: String, default: '' },
      },
    ],
    attempts: { type: Number, default: 0 },
    status: { type: String, enum: ['draft', 'published'], default: 'published' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Quiz', quizSchema);
