require('dotenv').config();

if (process.env.NODE_ENV === 'production') {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32) {
    throw new Error('JWT_SECRET must be set to a strong value (at least 32 characters) in production');
  }
}

module.exports = {
  port: process.env.PORT || 5000,
  mongoURI: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/campusai',
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
