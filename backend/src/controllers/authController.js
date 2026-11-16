const jwt = require('jsonwebtoken');
const config = require('../config');
const { User } = require('../models');
const { roles, accountTypes } = require('../utils/constants');

const generateToken = (id) => jwt.sign({ id }, config.jwtSecret, { expiresIn: config.jwtExpiresIn, algorithm: 'HS256' });

const publicUser = (user) => {
  const u = user.toObject ? user.toObject() : user;
  delete u.password;
  return u;
};

const register = async (req, res) => {
  try {
    const { name, username, email, password, accountType = 'STUDENT', instituteName = '', department, college, course, semester, bio } = req.body;
    if (!name || !username || !email || !password) {
      return res.status(400).json({ message: 'Please provide name, username, email and password' });
    }
    const exists = await User.findOne({ $or: [{ email: email.toLowerCase() }, { username: username.toLowerCase() }] });
    if (exists) return res.status(400).json({ message: 'User already exists' });
    const safeAccountType = Object.values(accountTypes).includes(accountType) ? accountType : 'STUDENT';
    const role =
      safeAccountType === 'CREATOR' ? roles.CREATOR : safeAccountType === 'INSTITUTE' ? roles.INSTITUTE : roles.STUDENT;
    const user = await User.create({
      name,
      username,
      email,
      password,
      accountType: safeAccountType,
      role,
      instituteName,
      department,
      college,
      course,
      semester,
      bio,
    });
    const token = generateToken(user._id);
    res.status(201).json({ token, user: publicUser(user) });
  } catch (err) {
    console.error('Register failed', err);
    res.status(500).json({ message: 'Registration failed, please try again' });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ message: 'Please provide email and password' });
    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }
    if (user.status === 'suspended') return res.status(403).json({ message: 'Account suspended' });
    const token = generateToken(user._id);
    res.json({ token, user: publicUser(user) });
  } catch (err) {
    console.error('Login failed', err);
    res.status(500).json({ message: 'Login failed, please try again' });
  }
};

const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id)
      .populate('profileId')
      .populate({ path: 'creatorId', select: '-__v' });
    res.json(publicUser(user));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { register, login, getMe, generateToken };
