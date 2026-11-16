const mongoose = require('mongoose');

const playlistSchema = new mongoose.Schema(
  {
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true },
    description: { type: String, default: '' },
    type: { type: String, enum: ['collection', 'watch-later', 'playlist', 'history'], default: 'playlist' },
    items: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Video' }],
    notes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Note' }],
    isPublic: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Playlist', playlistSchema);
