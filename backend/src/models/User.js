const mongoose = require('mongoose');
const config = require('../config');
const { roles, accountTypes } = require('../utils/constants');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    username: { type: String, required: true, unique: true, trim: true, lowercase: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, select: false },
    avatar: { type: String, default: '' },
    coverImage: { type: String, default: '' },
    phone: { type: String, default: '', trim: true },
    accountType: { type: String, enum: Object.values(accountTypes), default: 'STUDENT' },
    role: { type: String, enum: Object.values(roles), default: 'STUDENT' },
    department: { type: String, default: '' },
    college: { type: String, default: '' },
    instituteName: { type: String, default: '' },
    course: { type: String, default: '' },
    semester: { type: String, default: '' },
    bio: { type: String, default: '', maxlength: 500 },
    skills: [{ type: String }],
    subjects: [{ type: String }],
    followersCount: { type: Number, default: 0 },
    followingCount: { type: Number, default: 0 },
    connectionsCount: { type: Number, default: 0 },
    isVerified: { type: Boolean, default: false },
    verificationStatus: { type: String, enum: ['none', 'pending', 'approved', 'rejected'], default: 'none' },
    status: { type: String, enum: ['active', 'suspended'], default: 'active' },
    education: [
      {
        school: String,
        degree: String,
        field: String,
        startYear: String,
        endYear: String,
      },
    ],
    experience: [
      {
        company: String,
        title: String,
        start: String,
        end: String,
        description: String,
      },
    ],
    projects: [
      {
        title: String,
        description: String,
        link: String,
      },
    ],
    certifications: [
      {
        title: String,
        issuer: String,
        year: String,
      },
    ],
    achievements: [{ type: String }],
    creatorId: { type: mongoose.Schema.Types.ObjectId, ref: 'CreatorProfile', default: null },
    storage: {
      used: { type: Number, default: 0 },
      limit: { type: Number, default: config.upload.storageLimit },
    },
    gamification: {
      xp: { type: Number, default: 0 },
      level: { type: Number, default: 1 },
      streaks: { type: Number, default: 0 },
      badges: [{ type: String }],
    },
  },
  { timestamps: true }
);

userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

userSchema.index({ phone: 1 });

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

module.exports = mongoose.model('User', userSchema);
