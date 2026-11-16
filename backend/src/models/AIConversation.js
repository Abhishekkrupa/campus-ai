const mongoose = require('mongoose');

const aiConversationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, default: 'New conversation' },
    noteId: { type: mongoose.Schema.Types.ObjectId, ref: 'Note', default: null },
    context: { type: String, enum: ['chat', 'document'], default: 'chat' },
    messages: [{ type: mongoose.Schema.Types.ObjectId, ref: 'AIMessage' }],
  },
  { timestamps: true }
);

module.exports = mongoose.model('AIConversation', aiConversationSchema);
