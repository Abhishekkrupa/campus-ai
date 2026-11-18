const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const connectDB = require('./config/db');
const prisma = require('./config/prisma');
const config = require('./config');
const { notFound, errorHandler } = require('./middleware/error');
const { apiLimiter } = require('./middleware/rateLimiter');
const privateModeGuard = require('./middleware/privateMode');

const app = express();
const isTestEnv = process.env.NODE_ENV === 'test';

const initDatabases = async () => {
  if (config.databaseURL) {
    try {
      await prisma.$connect();
      console.log('Prisma/PostgreSQL connected');
    } catch (err) {
      console.error(`Prisma connection error: ${err.message}`);
      if (process.env.NODE_ENV === 'production') throw err;
    }
  }
  // Keep legacy Mongo connection optional during migration if configured.
  if (config.mongoURI) {
    try {
      await connectDB();
    } catch (err) {
      console.error(`MongoDB startup connection error: ${err.message}`);
      if (!config.databaseURL) throw err;
    }
  }
};

if (!isTestEnv) {
  initDatabases().catch((err) => {
    console.error('Database initialization failed:', err.message);
    if (process.env.NODE_ENV === 'production') process.exit(1);
  });
}

app.set('trust proxy', 1);
app.use(helmet());
app.use(
  cors({
    origin: process.env.FRONTEND_URL || ['http://localhost:5173', 'http://localhost:3000'],
    credentials: true,
  })
);
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));
app.use('/api', apiLimiter);

// Static uploads
app.use(
  '/uploads',
  express.static(path.join(__dirname, '..', 'uploads'), {
    setHeaders: (res, filePath) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Cache-Control', 'private, max-age=31536000, immutable');
    },
  })
);

// One gate for every API request (private mode is opt-in via ADMIN_ONLY_MODE)
app.use(privateModeGuard);

// Routes
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/posts', require('./routes/postRoutes'));
app.use('/api/videos', require('./routes/videoRoutes'));
app.use('/api/notes', require('./routes/noteRoutes'));
app.use('/api/comments', require('./routes/commentRoutes'));
app.use('/api/articles', require('./routes/articleRoutes'));
app.use('/api/ai', require('./routes/aiRoutes'));
app.use('/api/messages', require('./routes/messageRoutes'));
app.use('/api/notifications', require('./routes/notificationRoutes'));
app.use('/api/institute', require('./routes/instituteRoutes'));
app.use('/api/reports', require('./routes/reportRoutes'));
app.use('/api/creator', require('./routes/creatorRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));
app.use('/api/recommendations', require('./routes/recommendationRoutes'));
app.use('/api/upload', require('./routes/uploadRoutes'));

app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

// Public, read-only mode flag. This only drives UI copy; it is never used as
// proof of identity or to authorize any request.
app.get('/api/config', (req, res) => res.json({ privateMode: config.adminOnlyMode }));

app.use(notFound);
app.use(errorHandler);

let server = null;
if (!isTestEnv) {
  server = app.listen(config.port, () => {
    console.log(`CampusAI backend running on port ${config.port}`);
    const provider = config.llm && config.llm.provider;
    if (!provider || provider === 'ollama') {
      const model = (config.llm && config.llm.ollamaModel) || 'llama3.2';
      const url = (config.llm && config.llm.ollamaUrl) || 'http://localhost:11434/v1';
      fetch(`${String(url).replace(/\/+$/, '')}/models`)
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          const list = (data && (data.models || data.data)) || [];
          console.log(list.length
            ? `AI assistant uses free local Ollama model "${model}" (${list.length} models available)`
            : `Ollama is running but no models are pulled. Run: ollama pull ${model}`);
        })
        .catch(() => {
          console.warn(`Ollama is not reachable at ${url} - AI chat will fall back to built-in local responses until it's running.`);
        });
    } else if (!config.llm.openaiApiKey) {
      console.warn('OPENAI_API_KEY not set - AI chat will use the built-in local responses.');
    }
  });
}

module.exports = { app, server };
