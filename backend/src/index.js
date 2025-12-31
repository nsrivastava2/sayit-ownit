import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import { config, ollama } from './config/index.js';

// Import routes
import videosRouter from './routes/videos.js';
import recommendationsRouter from './routes/recommendations.js';
import expertsRouter from './routes/experts.js';
import sharesRouter from './routes/shares.js';
import statsRouter from './routes/stats.js';
import authRouter from './routes/auth.js';

// Import admin routes
import adminExpertsRouter from './routes/admin/experts.js';
import adminChannelsRouter from './routes/admin/channels.js';

// Import middleware
import { adminAuth } from './middleware/adminAuth.js';

dotenv.config();

const app = express();

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true // Required for cookies
}));
app.use(express.json());
app.use(cookieParser());

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: config.nodeEnv
  });
});

// Auth Routes (public)
app.use('/api/auth', authRouter);

// Public API Routes
app.use('/api/videos', videosRouter);
app.use('/api/recommendations', recommendationsRouter);
app.use('/api/experts', expertsRouter);
app.use('/api/shares', sharesRouter);
app.use('/api/stats', statsRouter);

// Protected Admin Routes
app.use('/api/admin/experts', adminAuth, adminExpertsRouter);
app.use('/api/admin/channels', adminAuth, adminChannelsRouter);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: config.nodeEnv === 'development' ? err.message : undefined
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Start server
const PORT = config.port;

async function startServer() {
  // Test Ollama connection
  console.log('Testing Ollama connection...');
  const ollamaConnected = await ollama.testConnection();

  if (!ollamaConnected) {
    console.warn('Warning: Could not connect to Ollama. LLM analysis will fail.');
  }

  app.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════════════════════════╗
║     Stock Market TV Recommendation Tracker - Backend      ║
╠═══════════════════════════════════════════════════════════╣
║  Server running on http://localhost:${PORT}                  ║
║  Environment: ${config.nodeEnv.padEnd(42)}║
║  Ollama: ${ollamaConnected ? 'Connected'.padEnd(47) : 'Not connected (LLM features disabled)'.padEnd(47)}║
╚═══════════════════════════════════════════════════════════╝
    `);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
