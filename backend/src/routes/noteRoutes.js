const express = require('express');
const config = require('../config');
const c = require('../controllers/noteController');
const protect = require('../middleware/auth');
const { makeUpload } = require('../middleware/upload');
const router = express.Router();

const noteUpload = makeUpload(config.upload.maxDocumentSize);

router.get('/', protect, c.listNotes);
router.post('/', protect, c.createNote);
router.get('/storage', protect, c.getMyStorage);
router.post('/upload', protect, noteUpload.single('file'), c.uploadNote);
router.get('/:id', protect, c.getNote);
router.delete('/:id', protect, c.deleteNote);
router.post('/:id/download', protect, c.downloadNote);
router.post('/:id/like', protect, c.toggleLike);
router.post('/:id/share', protect, c.shareNoteByPhone);

module.exports = router;