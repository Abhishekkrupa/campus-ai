const mongoose = require('mongoose');

const flashcardSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, default: '' },
    subject: { type: String, default: '' },
    cards: [
      {
        front: { type: String, required: true },
        back: { type: String, required: true },
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model('Flashcard', flashcardSchema);
