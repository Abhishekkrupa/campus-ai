const mongoose = require('mongoose');

const aiMessageSchema = new mongoose.Schema(
  {
    conversation: { type: mongoose.Schema.Types.ObjectId, ref: 'AIConversation', required: true },
    role: { type: String, enum: ['user', 'assistant'], required: true },
    content: { type: String, required: true },
    sources: [String],
  },
  { timestamps: true }
);

module.exports = mongoose.model('AIMessage', aiMessageSchema);
