const mongoose = require('mongoose');
const connectDB = require('./config/db');
const {
  User,
  CreatorProfile,
  Department,
  Subject,
  Category,
  Post,
  Note,
  Follow,
  Connection,
} = require('./models');

const departments = [
  { name: 'Computer Science & Engineering', code: 'CSE', description: 'Algorithms, data structures, and software systems.', color: '#1e40af' },
  { name: 'Electronics & Communication', code: 'ECE', description: 'Signal processing, embedded systems and communications.', color: '#b45309' },
  { name: 'Mechanical Engineering', code: 'MECH', description: 'Thermodynamics, mechanics and manufacturing.', color: '#047857' },
  { name: 'Electrical Engineering', code: 'EE', description: 'Power systems, circuits and control theory.', color: '#be123c' },
  { name: 'Business Administration', code: 'MBA', description: 'Management, finance and entrepreneurship.', color: '#7c3aed' },
];

const subjectsByDept = {
  CSE: [
    { code: 'CS101', name: 'Data Structures & Algorithms' },
    { code: 'CS202', name: 'Operating Systems' },
    { code: 'CS303', name: 'Database Management Systems' },
    { code: 'CS404', name: 'Machine Learning' },
  ],
  ECE: [
    { code: 'EC101', name: 'Digital Logic Design' },
    { code: 'EC202', name: 'Signals & Systems' },
  ],
  MECH: [
    { code: 'ME101', name: 'Thermodynamics' },
    { code: 'ME202', name: 'Fluid Mechanics' },
  ],
  EE: [
    { code: 'EE101', name: 'Circuit Theory' },
    { code: 'EE202', name: 'Control Systems' },
  ],
  MBA: [
    { code: 'MB101', name: 'Financial Accounting' },
    { code: 'MB202', name: 'Marketing Management' },
  ],
};

const categories = [
  { name: 'Study Notes', type: 'content', description: 'Lecture notes and study material' },
  { name: 'Video Lectures', type: 'content', description: 'Recorded and live lectures' },
  { name: 'Articles', type: 'content', description: 'Long-form educational content' },
  { name: 'Quizzes', type: 'content', description: 'Self-assessment and practice tests' },
  { name: 'Placements', type: 'content', description: 'Interview prep and placement drives' },
  { name: 'Events', type: 'content', description: 'Campus events and workshops' },
];

const clean = async () => {
  await Promise.all(
    Object.values({
      User,
      CreatorProfile,
      Department,
      Subject,
      Category,
      Post,
      Note,
      Follow,
      Connection,
    }).map((m) => m.deleteMany({}))
  );
};

const createUser = async ({ name, username, email, password, role, accountType, overrides = {} }) => {
  return User.create({
    name,
    username,
    email,
    password,
    role,
    accountType,
    ...overrides,
  });
};

const seedDemo = async () => {
  const [
    admin,
    student,
    creator,
    student2,
    student3,
    creator2,
    creator3,
  ] = await Promise.all([
    createUser({
      name: process.env.ADMIN_NAME || 'CampusAI Super Admin',
      username: process.env.ADMIN_USERNAME || 'campusai_admin',
      email: process.env.ADMIN_EMAIL || 'admin@campusai.app',
      password: process.env.ADMIN_PASSWORD || 'CampusAI@2026admin',
      role: 'SUPER_ADMIN',
      accountType: 'STUDENT',
      overrides: {
        department: 'Computer Science & Engineering',
        college: 'CampusAI University',
        isVerified: true,
        verificationStatus: 'approved',
      },
    }),
    createUser({
      name: 'Rahul Sharma',
      username: 'rahulsharma',
      email: process.env.DEMO_STUDENT_EMAIL || 'student@campusai.app',
      password: process.env.DEMO_STUDENT_PASSWORD || 'Student@2026',
      role: 'STUDENT',
      accountType: 'STUDENT',
      overrides: {
        department: 'Computer Science & Engineering',
        college: 'CampusAI University',
        course: 'B.Tech',
        semester: '6',
        bio: 'Second year CS student, passionate about web development and DSA.',
        skills: ['JavaScript', 'React', 'Node.js'],
        subjects: ['Data Structures & Algorithms', 'DBMS'],
        gamification: { xp: 240, level: 4, streaks: 6, badges: ['early-bird', 'top-contributor'] },
      },
    }),
    createUser({
      name: 'Ananya Iyer',
      username: 'ananya.creates',
      email: process.env.DEMO_CREATOR_EMAIL || 'creator@campusai.app',
      password: process.env.DEMO_CREATOR_PASSWORD || 'Creator@2026',
      role: 'CREATOR',
      accountType: 'CREATOR',
      overrides: {
        department: 'Electronics & Communication',
        college: 'CampusAI University',
        course: 'B.Tech',
        semester: '8',
        bio: 'EC engineer and ed-tech creator. I make exam-prep videos and notes.',
        skills: ['Embedded Systems', 'Teaching'],
        subjects: ['Signals & Systems', 'Digital Logic Design'],
        isVerified: true,
        verificationStatus: 'approved',
      },
    }),
    createUser({
      name: 'Sneha Patel',
      username: 'snehapatel',
      email: 'sneha@campusai.app',
      password: 'Sneha@2026',
      role: 'STUDENT',
      accountType: 'STUDENT',
      overrides: {
        department: 'Mechanical Engineering',
        college: 'CampusAI University',
        course: 'B.Tech',
        semester: '4',
        bio: 'Mechanical student, loves CAD and robotics.',
        skills: ['AutoCAD', 'SolidWorks'],
        subjects: ['Thermodynamics'],
      },
    }),
    createUser({
      name: 'Vikram Singh',
      username: 'vikram.singh',
      email: 'vikram@campusai.app',
      password: 'Vikram@2026',
      role: 'STUDENT',
      accountType: 'STUDENT',
      overrides: {
        department: 'Business Administration',
        college: 'CampusAI University',
        course: 'MBA',
        semester: '2',
        bio: 'MBA student focused on marketing analytics.',
        skills: ['Excel', 'SQL'],
        subjects: ['Financial Accounting'],
      },
    }),
    createUser({
      name: 'Meera Nair',
      username: 'meera.math',
      email: 'meera@campusai.app',
      password: 'Meera@2026',
      role: 'CREATOR',
      accountType: 'CREATOR',
      overrides: {
        department: 'Computer Science & Engineering',
        college: 'CampusAI University',
        course: 'M.Tech',
        semester: '4',
        bio: 'Mathematics and CS educator. Weekly problem-solving sessions.',
        skills: ['Mathematics', 'Algorithms'],
        subjects: ['Data Structures & Algorithms', 'Machine Learning'],
        isVerified: true,
        verificationStatus: 'approved',
      },
    }),
    createUser({
      name: 'Arjun Kulkarni',
      username: 'arjun.ece',
      email: 'arjun@campusai.app',
      password: 'Arjun@2026',
      role: 'CREATOR',
      accountType: 'CREATOR',
      overrides: {
        department: 'Electronics & Communication',
        college: 'CampusAI University',
        course: 'B.Tech',
        semester: '6',
        bio: 'ECE creator making circuit design tutorials.',
        skills: ['Circuit Design', 'VLSI'],
        subjects: ['Circuit Theory'],
      },
    }),
  ]);

  await CreatorProfile.create([
    {
      user: creator._id,
      category: 'Video Lectures',
      expertise: ['Signal Processing', 'Embedded Systems'],
      subjects: ['Signals & Systems', 'Digital Logic Design'],
      bio: creator.bio,
      tagline: 'Making ECE simple, one video at a time.',
      isVerified: true,
      followersCount: 0,
      views: 0,
      resourcesCount: 0,
      socialLinks: { youtube: 'https://youtube.com/@ananya' },
    },
    {
      user: creator2._id,
      category: 'Study Notes',
      expertise: ['Mathematics', 'Machine Learning'],
      subjects: ['Data Structures & Algorithms', 'Machine Learning'],
      bio: creator2.bio,
      tagline: 'Math is the language of the universe.',
      isVerified: true,
      followersCount: 0,
      views: 0,
      resourcesCount: 0,
    },
    {
      user: creator3._id,
      category: 'Video Lectures',
      expertise: ['Circuit Design', 'VLSI'],
      subjects: ['Circuit Theory'],
      bio: creator3.bio,
      tagline: 'From breadboard to chip.',
      isVerified: false,
      followersCount: 0,
      views: 0,
      resourcesCount: 0,
    },
  ]);

  await Post.create([
    {
      author: student._id,
      type: 'text',
      content:
        'Just started a study group for Data Structures & Algorithms this weekend! Drop a comment if you want to join. 🚀',
      tags: ['DSA', 'StudyGroup', 'CSE'],
      subject: 'Data Structures & Algorithms',
      department: 'Computer Science & Engineering',
    },
    {
      author: student2._id,
      type: 'text',
      content:
        'Can anyone recommend good resources for Thermodynamics? Midterms are coming and I need all the help I can get.',
      tags: ['Thermo', 'Midterms'],
      subject: 'Thermodynamics',
      department: 'Mechanical Engineering',
    },
    {
      author: student3._id,
      type: 'announcement',
      content: 'Placement drive for top tech companies starts next week. Registration opens Monday!',
      tags: ['Placements', 'Announcement'],
      department: 'Business Administration',
    },
  ]);
};

const run = async () => {
  try {
    await connectDB();

    console.log('Clearing existing collections...');
    await clean();

    console.log('Seeding departments...');
    const deptDocs = await Department.insertMany(departments);
    const deptByCode = Object.fromEntries(deptDocs.map((d) => [d.code, d._id]));

    console.log('Seeding subjects...');
    const subjects = [];
    for (const [code, list] of Object.entries(subjectsByDept)) {
      for (const s of list) {
        subjects.push({ ...s, department: deptByCode[code] });
      }
    }
    await Subject.insertMany(subjects);

    console.log('Seeding categories...');
    await Category.insertMany(categories);

    console.log('Seeding users, creator profiles and demo posts...');
    await seedDemo();

    console.log('\n✅ Seed complete!');
    console.log('─────────────────────────────────────');
    console.log(`Super Admin : ${process.env.ADMIN_EMAIL || 'admin@campusai.app'} / ${process.env.ADMIN_PASSWORD || 'CampusAI@2026admin'}`);
    console.log(`Student     : ${process.env.DEMO_STUDENT_EMAIL || 'student@campusai.app'} / ${process.env.DEMO_STUDENT_PASSWORD || 'Student@2026'}`);
    console.log(`Creator     : ${process.env.DEMO_CREATOR_EMAIL || 'creator@campusai.app'} / ${process.env.DEMO_CREATOR_PASSWORD || 'Creator@2026'}`);
    console.log('─────────────────────────────────────');
  } catch (err) {
    console.error('Seed failed:', err.message);
    process.exit(1);
  } finally {
    mongoose.connection.close();
  }
};

run();
