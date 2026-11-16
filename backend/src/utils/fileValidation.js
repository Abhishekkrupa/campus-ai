function assertFileSignature(buffer, mimetype) {
  const b = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer || []);
  const ascii = (start, end) => b.subarray(start, end).toString('latin1');
  const hex = (start, end) => b.subarray(start, end).toString('hex').toLowerCase();

  const fail = () => {
    throw new Error('File content does not match its declared type');
  };

  switch (mimetype) {
    case 'image/jpeg':
      if (hex(0, 3) !== 'ffd8ff') fail();
      break;
    case 'image/png':
      if (hex(0, 8) !== '89504e470d0a1a0a') fail();
      break;
    case 'image/gif':
      if (!(ascii(0, 6) === 'GIF87a' || ascii(0, 6) === 'GIF89a')) fail();
      break;
    case 'image/webp':
      if (!(ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP')) fail();
      break;
    case 'application/pdf':
      if (ascii(0, 5) !== '%PDF-') fail();
      break;
    case 'application/msword':
    case 'application/vnd.ms-powerpoint':
      if (hex(0, 8) !== 'd0cf11e0a1b11ae1') fail();
      break;
    case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
    case 'application/vnd.openxmlformats-officedocument.presentationml.presentation':
      if (!(hex(0, 4) === '504b0304' || hex(0, 4) === '504b0506')) fail();
      break;
    case 'application/rtf':
      if (ascii(0, 5) !== '{\\rtf') fail();
      break;
    case 'video/mp4':
    case 'video/quicktime':
      if (ascii(4, 8) !== 'ftyp') fail();
      break;
    case 'video/webm':
      if (hex(0, 4) !== '1a45dfa3') fail();
      break;
    case 'video/x-msvideo':
      if (!(ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'AVI ')) fail();
      break;
    case 'text/plain':
    case 'text/markdown':
      if (b.subarray(0, 1024).includes(0)) fail();
      break;
    default:
      break;
  }
  return true;
}

module.exports = { assertFileSignature };