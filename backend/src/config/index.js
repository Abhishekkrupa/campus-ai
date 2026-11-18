require('dotenv').config();

const { isAdminOnlyMode } = require('../utils/privateMode');

const normalizeEnvUrl = (value) => {
  if (typeof value !== 'string') return '';
  let v = value.trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    v = v.slice(1, -1).trim();
  }
  return v;
};

// Normalize common deployment formatting issues (surrounding quotes/whitespace)
if (process.env.DATABASE_URL) process.env.DATABASE_URL = normalizeEnvUrl(process.env.DATABASE_URL);
if (process.env.MONGODB_URI) process.env.MONGODB_URI = normalizeEnvUrl(process.env.MONGODB_URI);

if (process.env.NODE_ENV === 'production') {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET must be set to a strong value (at least 32 characters) in production');
  }
}

module.exports = {
  port: process.env.PORT || 5000,
  mongoURI: process.env.MONGODB_URI || (process.env.NODE_ENV === 'production' ? '' : 'mongodb://127.0.0.1:27017/campusai'),
  databaseURL: process.env.DATABASE_URL || '',
  adminOnlyMode: isAdminOnlyMode(process.env.ADMIN_ONLY_MODE),
  jwtSecret: process.env.JWT_SECRET || 'campusai_dev_secret',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  mlServiceUrl: process.env.ML_SERVICE_URL || 'http://localhost:8000',
  llm: {
    provider: process.env.LLM_PROVIDER || 'ollama',
    openaiApiKey: process.env.OPENAI_API_KEY || '',
    openaiModel: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    ollamaUrl: process.env.OLLAMA_URL || 'http://localhost:11434/v1',
    ollamaModel: process.env.OLLAMA_MODEL || 'llama3.2',
  },
  upload: {
    maxImageSize: 8 * 1024 * 1024,
    maxVideoSize: 200 * 1024 * 1024,
    maxDocumentSize: 20 * 1024 * 1024,
    storageLimit: 500 * 1024 * 1024,
  },
};
