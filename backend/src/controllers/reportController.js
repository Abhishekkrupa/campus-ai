const { prisma, createId, userId: reqUserId } = require('../utils/prisma');
const { reportCategories, reportTargetTypes } = require('../utils/constants');

const fileReport = async (req, res) => {
  try {
    const uid = reqUserId(req);
    const { targetType, targetId, category, description } = req.body;
    if (!reportTargetTypes.includes(targetType)) return res.status(400).json({ message: 'Invalid target type' });
    if (!reportCategories.includes(category)) return res.status(400).json({ message: 'Invalid category' });
    const report = await prisma.report.create({
      data: { id: createId(), reportedBy: uid, targetType, targetId, category, description: description || '' },
    });
    res.status(201).json({ ...report, _id: report.id });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { fileReport };
