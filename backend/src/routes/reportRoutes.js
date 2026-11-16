const express = require('express');
const { fileReport } = require('../controllers/reportController');
const protect = require('../middleware/auth');
const router = express.Router();

router.post('/', protect, fileReport);

module.exports = router;
