process.env.NODE_ENV = 'test';
process.env.ADMIN_ONLY_MODE = 'true';
process.env.JWT_SECRET = 'private-mode-test-secret-key-1234567890';

const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const prisma = require('../src/config/prisma');
const { app } = require('../src/server');
const {
  isAdminOnlyMode,
  isVerifiedSuperAdmin,
  PRIVATE_MODE_DENIED_CODE,
  PRIVATE_MODE_REGISTRATION_CODE,
} = require('../src/utils/privateMode');

const password = 'TestPassword123!';
const hashedPassword = bcrypt.hashSync(password, 4);

const makeUser = (id, email, overrides = {}) => ({
  id,
  name: 'Test User',
  username: id,
  email,
  password: hashedPassword,
  role: 'STUDENT',
  accountType: 'STUDENT',
  status: 'active',
  isVerified: false,
  verificationStatus: 'none',
  ...overrides,
});

const admin = makeUser('admin-id', 'admin@example.test', {
  role: 'SUPER_ADMIN',
  isVerified: true,
  verificationStatus: 'approved',
});
const student = makeUser('student-id', 'student@example.test');
const unverifiedAdmin = makeUser('unverified-admin-id', 'unverified@example.test', {
  role: 'SUPER_ADMIN',
});
const users = [admin, student, unverifiedAdmin];

const tokenFor = (user, extraClaims = {}) =>
  jwt.sign({ id: user.id, ...extraClaims }, process.env.JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: '1h',
  });

const originals = {};

test.before(() => {
  originals.findUnique = prisma.user.findUnique;
  originals.findFirst = prisma.user.findFirst;
  originals.create = prisma.user.create;
  originals.userCount = prisma.user.count;
  originals.noteCount = prisma.note.count;
  originals.videoCount = prisma.video.count;
  originals.postCount = prisma.post.count;
  originals.activityCount = prisma.activity.count;
  originals.reportCount = prisma.report.count;
  originals.departmentCount = prisma.department.count;
  originals.subjectCount = prisma.subject.count;
  originals.noteAggregate = prisma.note.aggregate;
  originals.activityFindMany = prisma.activity.findMany;

  prisma.user.findUnique = async ({ where }) =>
    users.find(
      (user) =>
        (where.id && user.id === where.id) ||
        (where.email && user.email === where.email)
    ) || null;
  prisma.user.findFirst = async () => null;
  prisma.user.create = async () => {
    throw new Error('Registration must not create a user in private mode');
  };

  // Minimal stubs so the admin dashboard can complete without a live database.
  prisma.user.count = async () => users.length;
  prisma.note.count = async () => 0;
  prisma.video.count = async () => 0;
  prisma.post.count = async () => 0;
  prisma.activity.count = async () => 0;
  prisma.report.count = async () => 0;
  prisma.department.count = async () => 0;
  prisma.subject.count = async () => 0;
  prisma.note.aggregate = async () => ({ _sum: { downloads: 0 } });
  prisma.activity.findMany = async () => [];
});

test.after(() => {
  Object.assign(prisma.user, {
    findUnique: originals.findUnique,
    findFirst: originals.findFirst,
    create: originals.create,
    count: originals.userCount,
  });
  Object.assign(prisma.note, {
    count: originals.noteCount,
    aggregate: originals.noteAggregate,
  });
  Object.assign(prisma.video, { count: originals.videoCount });
  Object.assign(prisma.post, { count: originals.postCount });
  Object.assign(prisma.activity, {
    count: originals.activityCount,
    findMany: originals.activityFindMany,
  });
  Object.assign(prisma.report, { count: originals.reportCount });
  Object.assign(prisma.department, { count: originals.departmentCount });
  Object.assign(prisma.subject, { count: originals.subjectCount });
});

test('ADMIN_ONLY_MODE is parsed strictly and does not depend on frontend values', () => {
  assert.equal(isAdminOnlyMode('true'), true);
  assert.equal(isAdminOnlyMode(' TRUE '), true);
  assert.equal(isAdminOnlyMode('false'), false);
  assert.equal(isAdminOnlyMode('1'), false);
  assert.equal(isAdminOnlyMode(undefined), false);
});

test('verified super-admin status comes from database fields only', () => {
  assert.equal(isVerifiedSuperAdmin(admin), true);
  assert.equal(isVerifiedSuperAdmin(student), false);
  assert.equal(isVerifiedSuperAdmin(unverifiedAdmin), false);
  assert.equal(isVerifiedSuperAdmin({ role: 'SUPER_ADMIN' }), false);
});

test('health check and public config stay available', async () => {
  const health = await request(app).get('/api/health');
  assert.equal(health.status, 200);
  assert.equal(health.body.status, 'ok');

  const config = await request(app).get('/api/config');
  assert.equal(config.status, 200);
  assert.equal(config.body.privateMode, true);
});

test('public registration returns 403 and creates no user', async () => {
  const response = await request(app).post('/api/auth/register').send({
    name: 'New User',
    username: 'newuser',
    email: 'new@example.test',
    password,
  });

  assert.equal(response.status, 403);
  assert.equal(response.body.code, PRIVATE_MODE_REGISTRATION_CODE);
});

test('registration paths outside the auth router are blocked centrally', async () => {
  const response = await request(app)
    .post('/api/users/register')
    .send({ email: 'new@example.test' });

  assert.equal(response.status, 403);
  assert.equal(response.body.code, PRIVATE_MODE_REGISTRATION_CODE);
});

test('verified super-admin can log in and receives a token', async () => {
  const response = await request(app)
    .post('/api/auth/login')
    .send({ email: admin.email, password });

  assert.equal(response.status, 200);
  assert.ok(response.body.token);
  assert.equal(response.body.user.role, 'SUPER_ADMIN');
});

test('non-admin and unverified super-admin logins are denied', async () => {
  const studentLogin = await request(app)
    .post('/api/auth/login')
    .send({ email: student.email, password });
  assert.equal(studentLogin.status, 403);
  assert.equal(studentLogin.body.code, PRIVATE_MODE_DENIED_CODE);

  const unverifiedLogin = await request(app)
    .post('/api/auth/login')
    .send({ email: unverifiedAdmin.email, password });
  assert.equal(unverifiedLogin.status, 403);
  assert.equal(unverifiedLogin.body.code, PRIVATE_MODE_DENIED_CODE);
});

test('invalid credentials keep the normal 401 response', async () => {
  const response = await request(app)
    .post('/api/auth/login')
    .send({ email: admin.email, password: 'wrong-password' });

  assert.equal(response.status, 401);
  assert.equal(response.body.message, 'Invalid credentials');
});

test('protected endpoints reject requests without a token', async () => {
  const response = await request(app).get('/api/posts');

  assert.equal(response.status, 401);
  assert.equal(response.body.message, 'Not authorized, no token');
});

test('an existing non-admin session is rejected on every protected endpoint', async () => {
  const token = tokenFor(student);

  const posts = await request(app)
    .get('/api/posts')
    .set('Authorization', `Bearer ${token}`);
  assert.equal(posts.status, 403);
  assert.equal(posts.body.code, PRIVATE_MODE_DENIED_CODE);

  const me = await request(app)
    .get('/api/auth/me')
    .set('Authorization', `Bearer ${token}`);
  assert.equal(me.status, 403);
  assert.equal(me.body.code, PRIVATE_MODE_DENIED_CODE);

  const adminEndpoint = await request(app)
    .get('/api/admin/dashboard')
    .set('Authorization', `Bearer ${token}`);
  assert.equal(adminEndpoint.status, 403);
  assert.equal(adminEndpoint.body.code, PRIVATE_MODE_DENIED_CODE);
});

test('forged role claims, headers and body values do not grant admin access', async () => {
  const forgedToken = tokenFor(student, { role: 'SUPER_ADMIN', isVerified: true });

  const response = await request(app)
    .get('/api/posts')
    .set('Authorization', `Bearer ${forgedToken}`)
    .set('x-user-role', 'SUPER_ADMIN')
    .send({ role: 'SUPER_ADMIN', isVerified: true });

  assert.equal(response.status, 403);
  assert.equal(response.body.code, PRIVATE_MODE_DENIED_CODE);
});

test('an unverified super-admin session is still rejected', async () => {
  const response = await request(app)
    .get('/api/posts')
    .set('Authorization', `Bearer ${tokenFor(unverifiedAdmin)}`);

  assert.equal(response.status, 403);
  assert.equal(response.body.code, PRIVATE_MODE_DENIED_CODE);
});

test('a verified super-admin can use protected and admin endpoints', async () => {
  const token = tokenFor(admin);

  const me = await request(app)
    .get('/api/auth/me')
    .set('Authorization', `Bearer ${token}`);
  assert.equal(me.status, 200);
  assert.equal(me.body.role, 'SUPER_ADMIN');

  const dashboard = await request(app)
    .get('/api/admin/dashboard')
    .set('Authorization', `Bearer ${token}`);
  assert.equal(dashboard.status, 200);
  assert.equal(dashboard.body.totals.totalUsers, users.length);
});
