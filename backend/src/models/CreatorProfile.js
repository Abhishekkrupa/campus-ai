const mongoose = require('mongoose');

const creatorProfileSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    category: { type: String, default: '' },
    expertise: [{ type: String }],
    subjects: [{ type: String }],
    bio: { type: String, default: '', maxlength: 800 },
    tagline: { type: String, default: '' },
    followersCount: { type: Number, default: 0 },
    views: { type: Number, default: 0 },
    totalWatchTime: { type: Number, default: 0 },
    totalDownloads: { type: Number, default: 0 },
    resourcesCount: { type: Number, default: 0 },
    isVerified: { type: Boolean, default: false },
    verificationRequest: {
      requested: { type: Boolean, default: false },
      reason: { type: String, default: '' },
    },
    socialLinks: {
      website: String,
      youtube: String,
      linkedin: String,
      github: String,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('CreatorProfile', creatorProfileSchema);
