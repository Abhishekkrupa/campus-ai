const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const AdmZip = require('adm-zip');

let tesseract = null;

const IMAGE_MIME = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp', 'image/tiff'];

const clean = (text) =>
  String(text || '')
    .replace(/\r\n/g, '\n')
    .replace(/\s+/g, ' ')
    .trim();

async function extractPdf(buffer) {
  const data = await pdfParse(buffer);
  return clean(data.text);
}

async function extractDocx(buffer) {
  const result = await mammoth.extractRawText({ buffer });
  return clean(result.value);
}

function extractPptx(buffer) {
  const zip = new AdmZip(buffer);
  const entries = zip.getEntries();
  const slides = entries
    .filter((e) => /^ppt\/slides\/slide\d+\.xml$/.test(e.entryName))
    .sort((a, b) => {
      const na = Number(a.entryName.match(/slide(\d+)\.xml/)[1]);
      const nb = Number(b.entryName.match(/slide(\d+)\.xml/)[1]);
      return na - nb;
    });
  const parts = [];
  for (const slide of slides) {
    const xml = slide.getData().toString('utf-8');
    const texts = [...xml.matchAll(/<a:t[^>]*>([\s\S]*?)<\/a:t>/g)].map((m) =>
      m[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/&quot;/g, '"')
    );
    const text = texts.join(' ').replace(/\s+/g, ' ').trim();
    if (text) parts.push(text);
  }
  return clean(parts.join('\n'));
}

async function extractImage(buffer) {
  if (!tesseract) tesseract = require('tesseract.js');
  try {
    const result = await tesseract.recognize(buffer, 'eng');
    const text = (result && result.data && result.data.text) || '';
    return clean(text);
  } catch (err) {
    console.warn('OCR failed for image:', err.message);
    return '';
  }
}

async function extractTextFromBuffer(buffer, mimetype, originalname = '') {
  if (!buffer || buffer.length === 0) return '';
  const mime = String(mimetype || '');
  const name = String(originalname || '').toLowerCase();
  try {
    if (mime === 'application/pdf' || name.endsWith('.pdf')) return await extractPdf(buffer);
    if (mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || name.endsWith('.docx')) return await extractDocx(buffer);
    if (mime === 'application/vnd.openxmlformats-officedocument.presentationml.presentation' || name.endsWith('.pptx')) return extractPptx(buffer);
    if (mime === 'text/plain' || name.endsWith('.txt') || mime === 'text/markdown' || name.endsWith('.md')) return clean(buffer.toString('utf-8'));
    if (IMAGE_MIME.includes(mime) || /\.(jpe?g|png|gif|webp|bmp|tiff?)$/i.test(name)) return await extractImage(buffer);
  } catch (err) {
    console.warn(`Text extraction failed for ${mime}:`, err.message);
  }
  return '';
}

module.exports = { extractTextFromBuffer, clean };