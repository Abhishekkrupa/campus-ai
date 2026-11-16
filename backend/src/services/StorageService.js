const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const { assertFileSignature } = require('../utils/fileValidation');

// Object-storage style abstraction.
// Default backend: local disk storage under ./uploads.
// To swap providers (S3/GCS/Cloudinary) implement the same interface:
//   class ProviderStorage { async upload(buffer, opts) {} }
// and export it here.

const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads');

class LocalStorage {
  constructor() {
    if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  }

  async upload(buffer, { mimetype, originalname }) {
    assertFileSignature(buffer, mimetype);
    const ext = extFrom(originalname, mimetype);
    const id = crypto.randomBytes(16).toString('hex');
    const filename = id + ext;
    const filePath = path.join(UPLOAD_DIR, filename);
    fs.writeFileSync(filePath, buffer);
    return {
      url: `/uploads/${filename}`,
      filename,
      id,
      size: buffer.length,
      mimetype,
    };
  }

  // Returns the on-disk size of a stored file (0 if missing). `fileUrl` is a
  // URL or filename like `/uploads/<name>`.
  getSize(fileUrl) {
    const name = String(fileUrl || '').replace(/^\/uploads\//, '');
    if (!name || name.includes('/') || name.includes('..')) return 0;
    try {
      return fs.statSync(path.join(UPLOAD_DIR, name)).size;
    } catch {
      return 0;
    }
  }

  // Best-effort removal of a stored file. Accepts a filename or `/uploads/...` URL.
  deleteObject(filename) {
    const name = String(filename || '').replace(/^\/uploads\//, '');
    if (!name || name.includes('/') || name.includes('..')) return;
    try {
      const filePath = path.join(UPLOAD_DIR, name);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch {
      // ignore
    }
  }
}

function extFrom(originalname, mimetype) {
  if (originalname) {
    const p = String(originalname).split('.').pop();
    if (p && p.length <= 10) return `.${p.toLowerCase()}`;
  }
  const map = {
    'image/png': '.png',
    'image/jpeg': '.jpg',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'application/pdf': '.pdf',
    'video/mp4': '.mp4',
    'video/webm': '.webm',
    'text/plain': '.txt',
    'text/markdown': '.md',
  };
  return map[mimetype] || '.bin';
}

module.exports = { storage: new LocalStorage(), UPLOAD_DIR };
