import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import pg from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { config, ollama } from './config/index.js';
import { configurePassport } from './config/passport.js';
import passport from 'passport';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Import routes
import videosRouter from './routes/videos.js';
import recommendationsRouter from './routes/recommendations.js';
import expertsRouter from './routes/experts.js';
import sharesRouter from './routes/shares.js';
import stocksRouter from './routes/stocks.js';
import statsRouter from './routes/stats.js';
import authRouter from './routes/auth.js';
import userAuthRouter from './routes/userAuth.js';
import userRouter from './routes/user.js';
import pricesRouter from './routes/prices.js';
import simulationsRouter from './routes/simulations.js';

// Import admin routes
import adminExpertsRouter from './routes/admin/experts.js';
import adminChannelsRouter from './routes/admin/channels.js';
import adminRecommendationsRouter from './routes/admin/recommendations.js';

// Import middleware
import { adminAuth } from './middleware/adminAuth.js';

// Import jobs
import { initPriceUpdateJob } from './jobs/priceUpdateJob.js';

// Import cache service
import cacheService from './services/cacheService.js';

dotenv.config();

const app = express();

// Trust proxy (required when behind Apache/Nginx reverse proxy)
app.set('trust proxy', 1);

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true // Required for cookies
}));
app.use(express.json());
app.use(cookieParser());

// PostgreSQL session store (persists sessions across restarts)
const PgStore = connectPgSimple(session);
const pgPool = new pg.Pool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: parseInt(process.env.DB_PORT || '5433'),
  user: process.env.DB_USER || 'sayitownit',
  password: process.env.DB_PASSWORD || 'sayitownit123',
  database: process.env.DB_NAME || 'sayitownit'
});

// Session middleware (for user auth)
app.use(session({
  store: new PgStore({
    pool: pgPool,
    tableName: 'session',
    createTableIfMissing: true
  }),
  name: 'sayitownit.sid', // Custom cookie name
  secret: process.env.SESSION_SECRET || 'sayitownit-session-secret-change-in-production',
  resave: false, // PG store handles this
  saveUninitialized: false, // Don't create session until something stored
  proxy: true, // Trust the reverse proxy
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    domain: process.env.NODE_ENV === 'production' ? '.sayitownit.com' : undefined,
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
  }
}));

// Initialize Passport for Google OAuth
configurePassport();
app.use(passport.initialize());
app.use(passport.session());

// Serve uploaded files (expert profile images)
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Request logging with cookie diagnostics for auth routes
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);

  // Log cookie details for auth routes to debug session issues
  if (req.path.includes('/auth')) {
    console.log('[COOKIE_DEBUG] Received cookies:', Object.keys(req.cookies || {}));
    console.log('[COOKIE_DEBUG] Session cookie present:', !!req.cookies?.['sayitownit.sid']);
    console.log('[COOKIE_DEBUG] Cookie header:', req.headers.cookie?.substring(0, 100) || 'none');

    // Intercept response to log Set-Cookie header
    const originalSend = res.send;
    res.send = function(body) {
      const setCookie = res.getHeader('Set-Cookie');
      if (setCookie) {
        console.log('[COOKIE_DEBUG] Set-Cookie response:',
          Array.isArray(setCookie) ? setCookie.map(c => c.substring(0, 80)) : setCookie.substring(0, 80));
      }
      return originalSend.call(this, body);
    };
  }
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
app.use('/api/auth', userAuthRouter);  // Google OAuth routes

// User Routes (protected - require login)
app.use('/api/user', userRouter);

// Public API Routes
app.use('/api/videos', videosRouter);
app.use('/api/recommendations', recommendationsRouter);
app.use('/api/experts', expertsRouter);
app.use('/api/shares', sharesRouter);
app.use('/api/stocks', stocksRouter);
app.use('/api/stats', statsRouter);
app.use('/api/prices', pricesRouter);
app.use('/api/simulations', simulationsRouter);

// Protected Admin Routes
app.use('/api/admin/experts', adminAuth, adminExpertsRouter);
app.use('/api/admin/channels', adminAuth, adminChannelsRouter);
app.use('/api/admin/recommendations', adminRecommendationsRouter);

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
  // Initialize Redis cache
  console.log('Connecting to Redis cache...');
  await cacheService.connect();

  // Test Ollama connection
  console.log('Testing Ollama connection...');
  const ollamaConnected = await ollama.testConnection();

  if (!ollamaConnected) {
    console.warn('Warning: Could not connect to Ollama. LLM analysis will fail.');
  }

  // Initialize scheduled jobs
  console.log('Initializing scheduled jobs...');
  initPriceUpdateJob();

  app.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════════════════════════╗
║     Stock Market TV Recommendation Tracker - Backend      ║
╠═══════════════════════════════════════════════════════════╣
║  Server running on http://localhost:${PORT}                  ║
║  Environment: ${config.nodeEnv.padEnd(42)}║
║  Ollama: ${ollamaConnected ? 'Connected'.padEnd(47) : 'Not connected (LLM features disabled)'.padEnd(47)}║
║  Price Job: Scheduled (Mon-Fri 6PM IST)                   ║
╚═══════════════════════════════════════════════════════════╝
    `);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
