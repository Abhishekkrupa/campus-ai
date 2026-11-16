const { User, Subject, Activity } = require('../models');

const publicUser = (user) => {
  const u = user.toObject ? user.toObject() : user;
  delete u.password;
  return u;
};

const getProfile = async (req, res) => {
  try {
    const instituteSubjectsCount = await Subject.countDocuments({ createdBy: req.user._id });
    res.json({ ...publicUser(req.user), instituteSubjectsCount });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const updateProfile = async (req, res) => {
  try {
    const { instituteName, department, bio } = req.body || {};
    const updates = {};
    if (instituteName !== undefined) updates.instituteName = String(instituteName).trim().slice(0, 120);
    if (department !== undefined) updates.department = String(department).trim().slice(0, 120);
    if (bio !== undefined) updates.bio = String(bio).trim().slice(0, 500);
    const user = await User.findByIdAndUpdate(req.user._id, updates, { new: true, runValidators: true });
    res.json(publicUser(user));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const listSubjects = async (req, res) => {
  try {
    const list = await Subject.find({ createdBy: req.user._id }).sort({ createdAt: -1 });
    res.json(list);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const createSubject = async (req, res) => {
  try {
    const { name, code = '', description = '' } = req.body || {};
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ message: 'Subject name is required' });
    }
    const s = await Subject.create({
      name: String(name).trim().slice(0, 120),
      code: String(code || '').trim().slice(0, 40),
      description: String(description || '').trim().slice(0, 500),
      institution: req.user.instituteName || req.user.college || '',
      createdBy: req.user._id,
    });
    await Activity.create({
      user: req.user._id,
      type: 'institute_subject',
      targetType: 'Subject',
      targetId: s._id,
      metadata: { name: s.name },
    });
    res.status(201).json(s);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const updateSubject = async (req, res) => {
  try {
    const { name, code = '', description = '' } = req.body || {};
    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ message: 'Subject name is required' });
    }
    const s = await Subject.findOneAndUpdate(
      { _id: req.params.id, createdBy: req.user._id },
      {
        name: String(name).trim().slice(0, 120),
        code: String(code || '').trim().slice(0, 40),
        description: String(description || '').trim().slice(0, 500),
      },
      { new: true, runValidators: true }
    );
    if (!s) return res.status(404).json({ message: 'Subject not found' });
    res.json(s);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const deleteSubject = async (req, res) => {
  try {
    const s = await Subject.findOneAndDelete({ _id: req.params.id, createdBy: req.user._id });
    if (!s) return res.status(404).json({ message: 'Subject not found' });
    await Activity.create({
      user: req.user._id,
      type: 'institute_subject',
      targetType: 'Subject',
      metadata: { name: s.name, removed: true },
    });
    res.json({ message: 'Subject deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { getProfile, updateProfile, listSubjects, createSubject, updateSubject, deleteSubject };