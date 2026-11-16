const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { randomBytes } = require('crypto');

const config = require('../config');
const prisma = require('../config/prisma');
const { roles, accountTypes } = require('../utils/constants');

const generateToken = (id) =>
  jwt.sign(
    { id },
    config.jwtSecret,
    {
      expiresIn: config.jwtExpiresIn,
      algorithm: 'HS256'
    }
  );

const publicUser = (user) => {
  if (!user) return null;

  const { password, ...safeUser } = user;

  return {
    ...safeUser,
    _id: safeUser.id
  };
};

const register = async (req, res) => {
  try {
    const {
      name,
      username,
      email,
      password,
      accountType = 'STUDENT',
      instituteName = '',
      department,
      college,
      course,
      semester,
      bio
    } = req.body || {};

    if (
      typeof name !== 'string' ||
      typeof username !== 'string' ||
      typeof email !== 'string' ||
      typeof password !== 'string' ||
      !name.trim() ||
      !username.trim() ||
      !email.trim() ||
      !password
    ) {
      return res.status(400).json({
        message: 'Please provide name, username, email and password'
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const normalizedUsername = username.trim().toLowerCase();

    const exists = await prisma.user.findFirst({
      where: {
        OR: [
          { email: normalizedEmail },
          { username: normalizedUsername }
        ]
      }
    });

    if (exists) {
      return res.status(400).json({
        message: 'User already exists'
      });
    }

    const safeAccountType =
      Object.values(accountTypes).includes(accountType)
        ? accountType
        : 'STUDENT';

    const role =
      safeAccountType === 'CREATOR'
        ? roles.CREATOR
        : safeAccountType === 'INSTITUTE'
          ? roles.INSTITUTE
          : roles.STUDENT;

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        id: randomBytes(12).toString('hex'),
        name: name.trim(),
        username: normalizedUsername,
        email: normalizedEmail,
        password: hashedPassword,
        accountType: safeAccountType,
        role,
        instituteName,
        ...(department !== undefined ? { department } : {}),
        ...(college !== undefined ? { college } : {}),
        ...(course !== undefined ? { course } : {}),
        ...(semester !== undefined ? { semester } : {}),
        ...(bio !== undefined ? { bio } : {})
      }
    });

    return res.status(201).json({
      token: generateToken(user.id),
      user: publicUser(user)
    });
  } catch (err) {
    if (err.code === 'P2002') {
      return res.status(400).json({
        message: 'User already exists'
      });
    }

    console.error('Prisma registration failed:', err);
    return res.status(500).json({
      message: 'Registration failed, please try again'
    });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body || {};

    if (
      typeof email !== 'string' ||
      typeof password !== 'string' ||
      !email.trim() ||
      !password
    ) {
      return res.status(400).json({
        message: 'Please provide email and password'
      });
    }

    const user = await prisma.user.findUnique({
      where: {
        email: email.trim().toLowerCase()
      }
    });

    if (
      !user ||
      !(await bcrypt.compare(password, user.password))
    ) {
      return res.status(401).json({
        message: 'Invalid credentials'
      });
    }

    if (user.status === 'suspended') {
      return res.status(403).json({
        message: 'Account suspended'
      });
    }

    return res.json({
      token: generateToken(user.id),
      user: publicUser(user)
    });
  } catch (err) {
    console.error('Prisma login failed:', err);
    return res.status(500).json({
      message: 'Login failed, please try again'
    });
  }
};

const getMe = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?._id?.toString();

    if (!userId) {
      return res.status(401).json({
        message: 'Not authorized'
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      return res.status(401).json({
        message: 'Not authorized, user not found'
      });
    }

    return res.json(publicUser(user));
  } catch (err) {
    console.error('Prisma getMe failed:', err);
    return res.status(500).json({
      message: 'Failed to fetch user'
    });
  }
};

module.exports = {
  register,
  login,
  getMe,
  generateToken
};
