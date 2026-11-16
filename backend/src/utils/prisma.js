const { randomBytes } = require('crypto');
const prisma = require('../config/prisma');

const createId = () => randomBytes(12).toString('hex');

const toPublicUser = (user) => {
  if (!user) return null;
  const { password, ...rest } = user;
  return { ...rest, _id: rest.id };
};

const userId = (req) => req.user?.id || req.user?._id?.toString() || null;

const selectPublicUser = {
  id: true,
  name: true,
  username: true,
  email: true,
  avatar: true,
  coverImage: true,
  phone: true,
  accountType: true,
  role: true,
  department: true,
  college: true,
  instituteName: true,
  course: true,
  semester: true,
  bio: true,
  skills: true,
  subjects: true,
  followersCount: true,
  followingCount: true,
  connectionsCount: true,
  isVerified: true,
  verificationStatus: true,
  status: true,
  education: true,
  experience: true,
  projects: true,
  certifications: true,
  achievements: true,
  creatorId: true,
  storage: true,
  gamification: true,
  createdAt: true,
  updatedAt: true,
};

module.exports = { prisma, createId, toPublicUser, userId, selectPublicUser };
