require('dotenv').config();

const mongoose = require('mongoose');
const connectDB = require('../src/config/db');
const User = require('../src/models/User');
const prisma = require('../src/config/prisma');

const DRY_RUN = process.argv.includes('--dry-run');

async function main() {
  await connectDB();

  const users = await User.find({})
    .select('+password')
    .lean();

  console.log(`MongoDB users found: ${users.length}`);
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'MIGRATION'}`);

  const fields = [
    'name', 'username', 'email', 'password', 'avatar',
    'coverImage', 'phone', 'accountType', 'role',
    'department', 'college', 'instituteName', 'course',
    'semester', 'bio', 'skills', 'subjects',
    'followersCount', 'followingCount', 'connectionsCount',
    'isVerified', 'verificationStatus', 'status',
    'education', 'experience', 'projects',
    'certifications', 'achievements', 'creatorId',
    'storage', 'gamification', 'createdAt', 'updatedAt'
  ];

  const prepared = users.map(user => {
    const data = { id: user._id.toString() };

    for (const field of fields) {
      if (user[field] !== undefined && user[field] !== null) {
        data[field] = field === 'creatorId'
          ? user[field].toString()
          : user[field];
      }
    }

    data.username = data.username.toLowerCase();
    data.email = data.email.toLowerCase();

    if (!/^\$2[aby]\$\d{2}\$/.test(data.password || '')) {
      throw new Error('Invalid password hash detected');
    }

    if (data.storage) {
      data.storage = JSON.parse(JSON.stringify(data.storage));
    }

    if (data.gamification) {
      data.gamification = JSON.parse(JSON.stringify(data.gamification));
    }

    for (const field of [
      'education', 'experience', 'projects', 'certifications'
    ]) {
      if (data[field]) {
        data[field] = JSON.parse(JSON.stringify(data[field]));
      }
    }

    return data;
  });

  const existingCount = await prisma.user.count();

  console.log(`PostgreSQL users before migration: ${existingCount}`);

  if (existingCount !== 0) {
    throw new Error('PostgreSQL User table is not empty. Stopping.');
  }

  if (DRY_RUN) {
    console.log(`DRY RUN PASSED: ${prepared.length} users ready.`);
    return;
  }

  await prisma.$transaction(async tx => {
    for (const data of prepared) {
      await tx.user.create({ data });
    }
  });

  const finalCount = await prisma.user.count();

  console.log(`PostgreSQL users after migration: ${finalCount}`);

  if (finalCount !== prepared.length) {
    throw new Error('User count verification failed');
  }

  console.log('USER MIGRATION SUCCESSFUL');
}

main()
  .catch(err => {
    console.error('Migration failed:', err.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await mongoose.disconnect();
  });
