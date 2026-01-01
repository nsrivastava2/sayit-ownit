/**
 * Passport.js Configuration for Google OAuth 2.0
 */

import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { db } from './index.js';

const logger = {
  info: (msg, data) => console.log(`[PASSPORT:INFO] ${msg}`, JSON.stringify(data || {})),
  error: (msg, data) => console.error(`[PASSPORT:ERROR] ${msg}`, JSON.stringify(data || {}))
};

export function configurePassport() {
  // Check if Google OAuth is configured
  const googleClientId = process.env.GOOGLE_CLIENT_ID;
  const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!googleClientId || !googleClientSecret) {
    logger.info('Google OAuth not configured - user auth disabled');
    return passport;
  }

  logger.info('Configuring Google OAuth');

  // Serialize user to session (store user ID)
  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  // Deserialize user from session (fetch user by ID)
  passport.deserializeUser(async (id, done) => {
    try {
      const result = await db.query(
        'SELECT * FROM users WHERE id = $1 AND is_active = TRUE',
        [id]
      );
      done(null, result.rows[0] || null);
    } catch (error) {
      logger.error('Deserialize error', { error: error.message });
      done(error, null);
    }
  });

  // Google OAuth Strategy
  passport.use(new GoogleStrategy({
    clientID: googleClientId,
    clientSecret: googleClientSecret,
    callbackURL: process.env.GOOGLE_CALLBACK_URL || '/api/auth/google/callback',
    scope: ['profile', 'email']
  }, async (accessToken, refreshToken, profile, done) => {
    try {
      const googleId = profile.id;
      const email = profile.emails?.[0]?.value;
      const fullName = profile.displayName;
      const profilePicture = profile.photos?.[0]?.value;

      if (!email) {
        logger.error('No email from Google', { googleId });
        return done(new Error('Email not provided by Google'), null);
      }

      // Check if user exists
      let result = await db.query(
        'SELECT * FROM users WHERE google_id = $1',
        [googleId]
      );

      let user = result.rows[0];

      if (user) {
        // Update existing user (refresh profile data and last login)
        result = await db.query(
          `UPDATE users SET
            full_name = $1,
            profile_picture_url = $2,
            last_login_at = NOW()
          WHERE google_id = $3
          RETURNING *`,
          [fullName, profilePicture, googleId]
        );
        user = result.rows[0];
        logger.info('User logged in', { userId: user.id, email });
      } else {
        // Create new user
        result = await db.query(
          `INSERT INTO users (google_id, email, full_name, profile_picture_url, last_login_at)
          VALUES ($1, $2, $3, $4, NOW())
          RETURNING *`,
          [googleId, email, fullName, profilePicture]
        );
        user = result.rows[0];
        logger.info('New user created', { userId: user.id, email });

        // Create default watchlist for new users
        await db.query(
          `INSERT INTO user_watchlists (user_id, name, is_default)
          VALUES ($1, 'My Watchlist', TRUE)`,
          [user.id]
        );
      }

      return done(null, user);
    } catch (error) {
      logger.error('Google auth error', { error: error.message });
      return done(error, null);
    }
  }));

  return passport;
}

export default passport;
