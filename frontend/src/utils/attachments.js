const IMAGES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
const VIDEOS = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo'];
const DOCS = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/markdown',
  'application/rtf',
];

export function attachmentKind(mime) {
  const t = String(mime || '');
  if (IMAGES.includes(t) || t.startsWith('image/')) return 'image';
  if (VIDEOS.includes(t) || t.startsWith('video/')) return 'video';
  return 'document';
}

export function isAllowedAttachment(mime) {
  const t = String(mime || '');
  return [...IMAGES, ...VIDEOS, ...DOCS].includes(t) || t.startsWith('image/') || t.startsWith('video/');
}

export const NOTE_FILE_MIMES = [...DOCS, 'image/jpeg', 'image/png', 'image/gif', 'image/webp']; 

export function isAllowedNoteFile(mime) {
  const t = String(mime || '');
  return NOTE_FILE_MIMES.includes(t) || t.startsWith('image/');
}

export function fileIcon(name) {
  const ext = String(name || '').split('.').pop().toLowerCase();
  if (ext === 'pdf') return '📄';
  if (ext === 'ppt' || ext === 'pptx') return '📊';
  if (ext === 'doc' || ext === 'docx' || ext === 'rtf') return '📝';
  if (ext === 'txt' || ext === 'md') return '📃';
  return '📁';
}