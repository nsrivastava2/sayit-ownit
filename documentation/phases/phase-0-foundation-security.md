# Phase 0: Foundation & Security

## Overview
**Goal:** Secure admin routes, configure domain, production-ready deployment
**Priority:** IMMEDIATE
**Dependencies:** None
**Estimated Effort:** 1-2 days

---

## Requirements

### R0.1 Admin Authentication
- All admin routes must be password-protected
- Protected routes: `/add`, `/admin/*`
- Session-based authentication (httpOnly cookie)
- Admin password stored as bcrypt hash in environment
- Session timeout: 24 hours

### R0.2 Domain Configuration
- Site accessible at https://www.sayitownit.com
- SSL certificate via Let's Encrypt
- HTTP → HTTPS redirect
- API accessible at https://www.sayitownit.com/api

### R0.3 Environment Separation
- Separate `.env.development` and `.env.production`
- PM2 process management for backend
- Production build for frontend

---

## Database Changes

### New Table: admin_sessions
```sql
-- Migration: 002_admin_sessions.sql

CREATE TABLE IF NOT EXISTS admin_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_token VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    ip_address VARCHAR(50),
    user_agent TEXT
);

CREATE INDEX idx_admin_sessions_token ON admin_sessions(session_token);
CREATE INDEX idx_admin_sessions_expires ON admin_sessions(expires_at);

-- Cleanup job: Delete expired sessions
-- Run daily: DELETE FROM admin_sessions WHERE expires_at < NOW();
```

---

## Backend Implementation

### Environment Variables
```bash
# Add to .env
ADMIN_PASSWORD_HASH=<bcrypt hash of admin password>
SESSION_SECRET=<random 64-char string>
SESSION_EXPIRY_HOURS=24
```

### New Files

#### `backend/src/middleware/adminAuth.js`
```javascript
/**
 * Admin Authentication Middleware
 *
 * Validates admin session from cookie
 * Returns 401 if not authenticated
 */

import { db } from '../config/index.js';

const logger = {
  info: (msg, data) => console.log(`[AUTH:INFO] ${msg}`, data || ''),
  warn: (msg, data) => console.warn(`[AUTH:WARN] ${msg}`, data || ''),
  error: (msg, data) => console.error(`[AUTH:ERROR] ${msg}`, data || '')
};

export async function adminAuth(req, res, next) {
  const sessionToken = req.cookies?.admin_session;

  logger.info('Auth check', {
    path: req.path,
    hasToken: !!sessionToken,
    ip: req.ip
  });

  if (!sessionToken) {
    logger.warn('No session token', { path: req.path, ip: req.ip });
    return res.status(401).json({
      error: 'Authentication required',
      code: 'NO_SESSION'
    });
  }

  try {
    const session = await db.getAdminSession(sessionToken);

    if (!session) {
      logger.warn('Invalid session token', { ip: req.ip });
      res.clearCookie('admin_session');
      return res.status(401).json({
        error: 'Invalid session',
        code: 'INVALID_SESSION'
      });
    }

    if (new Date(session.expires_at) < new Date()) {
      logger.warn('Expired session', {
        sessionId: session.id,
        expiredAt: session.expires_at
      });
      await db.deleteAdminSession(sessionToken);
      res.clearCookie('admin_session');
      return res.status(401).json({
        error: 'Session expired',
        code: 'SESSION_EXPIRED'
      });
    }

    logger.info('Auth success', { sessionId: session.id });
    req.adminSession = session;
    next();
  } catch (error) {
    logger.error('Auth middleware error', { error: error.message });
    return res.status(500).json({
      error: 'Authentication error',
      code: 'AUTH_ERROR'
    });
  }
}

export default adminAuth;
```

#### `backend/src/routes/auth.js`
```javascript
/**
 * Admin Authentication Routes
 *
 * POST /api/auth/admin-login  - Authenticate with password
 * GET  /api/auth/admin-status - Check authentication status
 * POST /api/auth/admin-logout - Clear session
 */

import { Router } from 'express';
import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { db } from '../config/index.js';
import { adminAuth } from '../middleware/adminAuth.js';

const router = Router();

const logger = {
  info: (msg, data) => console.log(`[AUTH:INFO] ${msg}`, JSON.stringify(data || {})),
  warn: (msg, data) => console.warn(`[AUTH:WARN] ${msg}`, JSON.stringify(data || {})),
  error: (msg, data) => console.error(`[AUTH:ERROR] ${msg}`, JSON.stringify(data || {}))
};

/**
 * POST /api/auth/admin-login
 * Authenticate admin with password
 */
router.post('/admin-login', async (req, res) => {
  const { password } = req.body;
  const ip = req.ip;
  const userAgent = req.get('User-Agent');

  logger.info('Login attempt', { ip });

  if (!password) {
    logger.warn('Login without password', { ip });
    return res.status(400).json({
      error: 'Password required',
      code: 'MISSING_PASSWORD'
    });
  }

  try {
    const passwordHash = process.env.ADMIN_PASSWORD_HASH;

    if (!passwordHash) {
      logger.error('ADMIN_PASSWORD_HASH not configured');
      return res.status(500).json({
        error: 'Server configuration error',
        code: 'CONFIG_ERROR'
      });
    }

    const isValid = await bcrypt.compare(password, passwordHash);

    if (!isValid) {
      logger.warn('Invalid password attempt', { ip });
      return res.status(401).json({
        error: 'Invalid password',
        code: 'INVALID_PASSWORD'
      });
    }

    // Create session
    const sessionToken = crypto.randomBytes(32).toString('hex');
    const expiryHours = parseInt(process.env.SESSION_EXPIRY_HOURS) || 24;
    const expiresAt = new Date(Date.now() + expiryHours * 60 * 60 * 1000);

    await db.createAdminSession({
      session_token: sessionToken,
      expires_at: expiresAt.toISOString(),
      ip_address: ip,
      user_agent: userAgent
    });

    // Set httpOnly cookie
    res.cookie('admin_session', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: expiryHours * 60 * 60 * 1000
    });

    logger.info('Login successful', { ip });

    return res.json({
      success: true,
      expiresAt: expiresAt.toISOString()
    });

  } catch (error) {
    logger.error('Login error', { error: error.message, ip });
    return res.status(500).json({
      error: 'Login failed',
      code: 'LOGIN_ERROR'
    });
  }
});

/**
 * GET /api/auth/admin-status
 * Check if currently authenticated
 */
router.get('/admin-status', async (req, res) => {
  const sessionToken = req.cookies?.admin_session;

  if (!sessionToken) {
    return res.json({ authenticated: false });
  }

  try {
    const session = await db.getAdminSession(sessionToken);

    if (!session || new Date(session.expires_at) < new Date()) {
      return res.json({ authenticated: false });
    }

    return res.json({
      authenticated: true,
      expiresAt: session.expires_at
    });

  } catch (error) {
    logger.error('Status check error', { error: error.message });
    return res.json({ authenticated: false });
  }
});

/**
 * POST /api/auth/admin-logout
 * Clear admin session
 */
router.post('/admin-logout', adminAuth, async (req, res) => {
  const sessionToken = req.cookies?.admin_session;

  try {
    if (sessionToken) {
      await db.deleteAdminSession(sessionToken);
    }

    res.clearCookie('admin_session');
    logger.info('Logout successful', { sessionId: req.adminSession?.id });

    return res.json({ success: true });

  } catch (error) {
    logger.error('Logout error', { error: error.message });
    return res.status(500).json({
      error: 'Logout failed',
      code: 'LOGOUT_ERROR'
    });
  }
});

export default router;
```

### Database Functions (add to `backend/src/config/database.js`)
```javascript
// Add these methods to the db object

async createAdminSession(data) {
  const result = await pool.query(
    `INSERT INTO admin_sessions (session_token, expires_at, ip_address, user_agent)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [data.session_token, data.expires_at, data.ip_address, data.user_agent]
  );
  return result.rows[0];
}

async getAdminSession(token) {
  const result = await pool.query(
    'SELECT * FROM admin_sessions WHERE session_token = $1',
    [token]
  );
  return result.rows[0];
}

async deleteAdminSession(token) {
  await pool.query(
    'DELETE FROM admin_sessions WHERE session_token = $1',
    [token]
  );
}

async cleanupExpiredSessions() {
  const result = await pool.query(
    'DELETE FROM admin_sessions WHERE expires_at < NOW()'
  );
  return result.rowCount;
}
```

### Update `backend/src/index.js`
```javascript
// Add imports
import cookieParser from 'cookie-parser';
import authRoutes from './routes/auth.js';
import { adminAuth } from './middleware/adminAuth.js';

// Add middleware (before routes)
app.use(cookieParser());

// Add auth routes (public)
app.use('/api/auth', authRoutes);

// Protect admin routes
app.use('/api/admin', adminAuth);

// Protect video processing route
app.post('/api/videos/process', adminAuth, videosRouter);
```

---

## Frontend Implementation

### New Files

#### `frontend/src/contexts/AuthContext.jsx`
```jsx
import { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuthStatus();
  }, []);

  async function checkAuthStatus() {
    try {
      const response = await api.getAdminStatus();
      setIsAuthenticated(response.authenticated);
    } catch (error) {
      console.error('Auth check failed:', error);
      setIsAuthenticated(false);
    } finally {
      setLoading(false);
    }
  }

  async function login(password) {
    const response = await api.adminLogin(password);
    if (response.success) {
      setIsAuthenticated(true);
      return { success: true };
    }
    return { success: false, error: response.error };
  }

  async function logout() {
    await api.adminLogout();
    setIsAuthenticated(false);
  }

  return (
    <AuthContext.Provider value={{
      isAuthenticated,
      loading,
      login,
      logout,
      checkAuthStatus
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
```

#### `frontend/src/components/ProtectedRoute.jsx`
```jsx
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/admin/login" state={{ from: location }} replace />;
  }

  return children;
}
```

#### `frontend/src/pages/admin/AdminLogin.jsx`
```jsx
import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

export default function AdminLogin() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from?.pathname || '/';

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await login(password);
      if (result.success) {
        navigate(from, { replace: true });
      } else {
        setError(result.error || 'Invalid password');
      }
    } catch (err) {
      setError('Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-xl shadow-lg">
        <div>
          <h2 className="text-center text-3xl font-bold text-gray-900">
            Admin Login
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Enter password to access admin features
          </p>
        </div>

        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          <div>
            <label htmlFor="password" className="sr-only">
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              className="appearance-none relative block w-full px-3 py-3 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-lg focus:outline-none focus:ring-primary-500 focus:border-primary-500 focus:z-10 sm:text-sm"
              placeholder="Admin Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
            />
          </div>

          <div>
            <button
              type="submit"
              disabled={loading}
              className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-lg text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
```

### Update `frontend/src/services/api.js`
```javascript
// Add these methods

async adminLogin(password) {
  const response = await this.client.post('/auth/admin-login', { password });
  return response.data;
}

async getAdminStatus() {
  const response = await this.client.get('/auth/admin-status');
  return response.data;
}

async adminLogout() {
  const response = await this.client.post('/auth/admin-logout');
  return response.data;
}
```

### Update `frontend/src/App.jsx`
```jsx
import { Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout/Layout';
import Dashboard from './pages/Dashboard';
import AddVideo from './pages/AddVideo';
import Recommendations from './pages/Recommendations';
import ExpertView from './pages/ExpertView';
import ShareView from './pages/ShareView';
import VideoDetails from './pages/VideoDetails';
import AdminLogin from './pages/admin/AdminLogin';
import ExpertManagement from './pages/admin/ExpertManagement';
import ChannelManagement from './pages/admin/ChannelManagement';

function App() {
  return (
    <AuthProvider>
      <Layout>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<Dashboard />} />
          <Route path="/recommendations" element={<Recommendations />} />
          <Route path="/experts/:name" element={<ExpertView />} />
          <Route path="/shares/:symbol" element={<ShareView />} />
          <Route path="/videos/:id" element={<VideoDetails />} />

          {/* Admin Login (public) */}
          <Route path="/admin/login" element={<AdminLogin />} />

          {/* Protected Admin Routes */}
          <Route path="/add" element={
            <ProtectedRoute><AddVideo /></ProtectedRoute>
          } />
          <Route path="/admin/experts" element={
            <ProtectedRoute><ExpertManagement /></ProtectedRoute>
          } />
          <Route path="/admin/channels" element={
            <ProtectedRoute><ChannelManagement /></ProtectedRoute>
          } />
        </Routes>
      </Layout>
    </AuthProvider>
  );
}

export default App;
```

---

## Test Cases (TDD)

### Unit Tests: `backend/tests/auth.test.js`
```javascript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import bcrypt from 'bcrypt';
import request from 'supertest';
import app from '../src/index.js';

describe('Admin Authentication', () => {
  const testPassword = 'test-admin-password';
  let passwordHash;

  beforeAll(async () => {
    passwordHash = await bcrypt.hash(testPassword, 10);
    process.env.ADMIN_PASSWORD_HASH = passwordHash;
  });

  describe('POST /api/auth/admin-login', () => {
    it('should return 400 if password is missing', async () => {
      const res = await request(app)
        .post('/api/auth/admin-login')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('MISSING_PASSWORD');
    });

    it('should return 401 for invalid password', async () => {
      const res = await request(app)
        .post('/api/auth/admin-login')
        .send({ password: 'wrong-password' });

      expect(res.status).toBe(401);
      expect(res.body.code).toBe('INVALID_PASSWORD');
    });

    it('should return 200 and set cookie for valid password', async () => {
      const res = await request(app)
        .post('/api/auth/admin-login')
        .send({ password: testPassword });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.headers['set-cookie']).toBeDefined();
      expect(res.headers['set-cookie'][0]).toContain('admin_session');
    });
  });

  describe('GET /api/auth/admin-status', () => {
    it('should return authenticated: false without cookie', async () => {
      const res = await request(app)
        .get('/api/auth/admin-status');

      expect(res.status).toBe(200);
      expect(res.body.authenticated).toBe(false);
    });

    it('should return authenticated: true with valid cookie', async () => {
      // Login first
      const loginRes = await request(app)
        .post('/api/auth/admin-login')
        .send({ password: testPassword });

      const cookie = loginRes.headers['set-cookie'][0];

      // Check status
      const res = await request(app)
        .get('/api/auth/admin-status')
        .set('Cookie', cookie);

      expect(res.status).toBe(200);
      expect(res.body.authenticated).toBe(true);
    });
  });

  describe('Protected Routes', () => {
    it('should return 401 for /api/videos/process without auth', async () => {
      const res = await request(app)
        .post('/api/videos/process')
        .send({ youtubeUrl: 'https://youtube.com/watch?v=test' });

      expect(res.status).toBe(401);
    });

    it('should return 401 for /api/admin/* without auth', async () => {
      const res = await request(app)
        .get('/api/admin/experts');

      expect(res.status).toBe(401);
    });
  });
});
```

### Playwright E2E Tests: `e2e/auth.spec.js`
```javascript
import { test, expect } from '@playwright/test';

test.describe('Admin Authentication', () => {
  const ADMIN_PASSWORD = process.env.TEST_ADMIN_PASSWORD || 'test-password';

  test('should show login page when accessing protected route', async ({ page }) => {
    await page.goto('/add');

    // Should redirect to login
    await expect(page).toHaveURL('/admin/login');
    await expect(page.locator('h2')).toContainText('Admin Login');
  });

  test('should show error for invalid password', async ({ page }) => {
    await page.goto('/admin/login');

    await page.fill('input[type="password"]', 'wrong-password');
    await page.click('button[type="submit"]');

    await expect(page.locator('.bg-red-50')).toBeVisible();
    await expect(page.locator('.bg-red-50')).toContainText('Invalid password');
  });

  test('should login successfully with correct password', async ({ page }) => {
    await page.goto('/admin/login');

    await page.fill('input[type="password"]', ADMIN_PASSWORD);
    await page.click('button[type="submit"]');

    // Should redirect to home or requested page
    await expect(page).not.toHaveURL('/admin/login');
  });

  test('should access protected route after login', async ({ page }) => {
    // Login first
    await page.goto('/admin/login');
    await page.fill('input[type="password"]', ADMIN_PASSWORD);
    await page.click('button[type="submit"]');

    // Wait for redirect
    await page.waitForURL('/');

    // Now access protected route
    await page.goto('/add');

    // Should not redirect to login
    await expect(page).toHaveURL('/add');
    await expect(page.locator('h1')).toContainText('Add Video');
  });

  test('should logout and redirect to login', async ({ page }) => {
    // Login first
    await page.goto('/admin/login');
    await page.fill('input[type="password"]', ADMIN_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL('/');

    // Click logout (assuming there's a logout button in the UI)
    await page.click('[data-testid="logout-button"]');

    // Try to access protected route
    await page.goto('/add');

    // Should redirect to login
    await expect(page).toHaveURL('/admin/login');
  });

  test('should hide Add Video button for unauthenticated users', async ({ page }) => {
    await page.goto('/');

    // Add Video button should not be visible
    await expect(page.locator('a[href="/add"]')).not.toBeVisible();
  });

  test('should show Add Video button after login', async ({ page }) => {
    // Login first
    await page.goto('/admin/login');
    await page.fill('input[type="password"]', ADMIN_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL('/');

    // Add Video button should be visible
    await expect(page.locator('a[href="/add"]')).toBeVisible();
  });
});
```

---

## Logging Requirements

### Backend Logging Format
```
[SERVICE:LEVEL] Message {json_data}

Examples:
[AUTH:INFO] Login attempt {"ip":"192.168.1.1"}
[AUTH:WARN] Invalid password attempt {"ip":"192.168.1.1"}
[AUTH:ERROR] Login error {"error":"Database connection failed","ip":"192.168.1.1"}
```

### Log Levels
- `INFO`: Normal operations (login success, logout)
- `WARN`: Suspicious but not error (invalid password, expired session)
- `ERROR`: Failures that need attention (database errors, config errors)

### What to Log
- All login attempts (IP, success/failure)
- Session creation/deletion
- Authentication failures with reason
- Configuration errors

### What NOT to Log
- Passwords (even hashed)
- Full session tokens (log last 8 chars only for debugging)

---

## Deployment Steps

### 1. Generate Admin Password Hash
```bash
# Run in node REPL
node -e "const bcrypt = require('bcrypt'); bcrypt.hash('YOUR_SECURE_PASSWORD', 10).then(console.log)"
```

### 2. Update Environment
```bash
# Add to backend/.env.production
ADMIN_PASSWORD_HASH=$2b$10$...your...hash...here
SESSION_SECRET=$(openssl rand -hex 32)
SESSION_EXPIRY_HOURS=24
```

### 3. Run Migration
```bash
psql -h localhost -p 5433 -U sayitownit -d sayitownit \
  -f database/migrations/002_admin_sessions.sql
```

### 4. Install Dependencies
```bash
cd backend && npm install bcrypt cookie-parser
```

### 5. Configure Apache/Nginx
```apache
# Apache virtual host for sayitownit.com
<VirtualHost *:443>
    ServerName www.sayitownit.com

    SSLEngine on
    SSLCertificateFile /etc/letsencrypt/live/sayitownit.com/fullchain.pem
    SSLCertificateKeyFile /etc/letsencrypt/live/sayitownit.com/privkey.pem

    # Frontend (static files)
    DocumentRoot /var/www/sayitownit/frontend/dist

    # API proxy
    ProxyPass /api http://localhost:4001/api
    ProxyPassReverse /api http://localhost:4001/api

    # SPA routing
    <Directory /var/www/sayitownit/frontend/dist>
        RewriteEngine On
        RewriteBase /
        RewriteRule ^index\.html$ - [L]
        RewriteCond %{REQUEST_FILENAME} !-f
        RewriteCond %{REQUEST_FILENAME} !-d
        RewriteRule . /index.html [L]
    </Directory>
</VirtualHost>

# HTTP to HTTPS redirect
<VirtualHost *:80>
    ServerName www.sayitownit.com
    Redirect permanent / https://www.sayitownit.com/
</VirtualHost>
```

### 6. Build Frontend
```bash
cd frontend
npm run build
```

### 7. Start Backend with PM2
```bash
cd backend
pm2 start src/index.js --name sayitownit-api
pm2 save
```

---

## Acceptance Criteria

- [ ] Unauthenticated users cannot access `/add`
- [ ] Unauthenticated users cannot access `/admin/*`
- [ ] Login page shows error for invalid password
- [ ] Valid password creates session and redirects
- [ ] Session persists across page refreshes
- [ ] Logout clears session and redirects to login
- [ ] All auth events are logged with IP
- [ ] Site accessible at https://www.sayitownit.com
- [ ] HTTP redirects to HTTPS
- [ ] API works via /api proxy

---

## Rollback Plan

If issues occur:
1. Remove `adminAuth` middleware from protected routes
2. Remove auth-related cookies
3. Routes become public again (temporary)

No data migration needed - `admin_sessions` table is standalone.
