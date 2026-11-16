const multer = require('multer');
const path = require('path');
const config = require('../config');

const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const images = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  const documents = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation', 'text/plain', 'text/markdown', 'application/rtf'];
  const videos = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo'];

  const all = [...images, ...documents, ...videos];
  if (all.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Unsupported file type'), false);
  }
};

const upload = multer({
  storage,
  limits: { fileSize: config.upload.maxVideoSize },
  fileFilter,
});

const makeUpload = (fileSize) =>
  multer({
    storage,
    limits: { fileSize: fileSize || config.upload.maxVideoSize },
    fileFilter,
  });

module.exports = upload;
module.exports.makeUpload = makeUpload;
