const { Report, Notification } = require('../models');
const { reportCategories, reportTargetTypes } = require('../utils/constants');

const fileReport = async (req, res) => {
  try {
    const { targetType, targetId, category, description } = req.body;
    if (!reportTargetTypes.includes(targetType)) return res.status(400).json({ message: 'Invalid target type' });
    if (!reportCategories.includes(category)) return res.status(400).json({ message: 'Invalid category' });
    const report = await Report.create({
      reportedBy: req.user._id,
      targetType,
      targetId,
      category,
      description,
    });
    res.status(201).json(report);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

module.exports = { fileReport };
