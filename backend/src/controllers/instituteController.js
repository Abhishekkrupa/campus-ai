const { prisma, toPublicUser, createId, userId: reqUserId } = require('../utils/prisma');

const getProfile = async (req, res) => {
  try {
    const uid = reqUserId(req);
    const instituteSubjectsCount = await prisma.subject.count({ where: { createdBy: uid } });
    const user = await prisma.user.findUnique({ where: { id: uid } });
    res.json({ ...toPublicUser(user), instituteSubjectsCount });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const updateProfile = async (req, res) => {
  try {
    const uid = reqUserId(req);
    const { instituteName, department, bio } = req.body || {};
    const updates = {};
    if (instituteName !== undefined) updates.instituteName = String(instituteName).trim().slice(0, 120);
    if (department !== undefined) updates.department = String(department).trim().slice(0, 120);
    if (bio !== undefined) updates.bio = String(bio).trim().slice(0, 500);
    const user = await prisma.user.update({ where: { id: uid }, data: updates });
    res.json(toPublicUser(user));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const listSubjects = async (req, res) => {
  try {
    const uid = reqUserId(req);
    const list = await prisma.subject.findMany({ where: { createdBy: uid }, orderBy: { createdAt: 'desc' } });
    res.json(list.map((s) => ({ ...s, _id: s.id })));
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const createSubject = async (req, res) => {
  try {
    const uid = reqUserId(req);
    const { name, code = '', description = '' } = req.body || {};
    if (!name || typeof name !== 'string' || !name.trim()) return res.status(400).json({ message: 'Subject name is required' });
    const user = await prisma.user.findUnique({ where: { id: uid } });
    const s = await prisma.subject.create({ data: { id: createId(), name: String(name).trim().slice(0, 120), code: String(code || '').trim().slice(0, 40), description: String(description || '').trim().slice(0, 500), institution: user?.instituteName || user?.college || '', createdBy: uid } });
    await prisma.activity.create({ data: { id: createId(), user: uid, type: 'institute_subject', targetType: 'Subject', targetId: s.id, metadata: { name: s.name } } }).catch(() => {});
    res.status(201).json({ ...s, _id: s.id });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const updateSubject = async (req, res) => {
  try {
    const uid = reqUserId(req);
    const { name, code = '', description = '' } = req.body || {};
    if (!name || typeof name !== 'string' || !name.trim()) return res.status(400).json({ message: 'Subject name is required' });
    const existing = await prisma.subject.findFirst({ where: { id: req.params.id, createdBy: uid } });
    if (!existing) return res.status(404).json({ message: 'Subject not found' });
    const s = await prisma.subject.update({ where: { id: existing.id }, data: { name: String(name).trim().slice(0, 120), code: String(code || '').trim().slice(0, 40), description: String(description || '').trim().slice(0, 500) } });
    res.json({ ...s, _id: s.id });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

const deleteSubject = async (req, res) => {
  try {
    const uid = reqUserId(req);
    const s = await prisma.subject.findFirst({ where: { id: req.params.id, createdBy: uid } });
    if (!s) return res.status(404).json({ message: 'Subject not found' });
    await prisma.subject.delete({ where: { id: s.id } });
    await prisma.activity.create({ data: { id: createId(), user: uid, type: 'institute_subject', targetType: 'Subject', metadata: { name: s.name, removed: true } } }).catch(() => {});
    res.json({ message: 'Subject deleted' });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { getProfile, updateProfile, listSubjects, createSubject, updateSubject, deleteSubject };
