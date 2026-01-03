import Redis from 'ioredis';

class CacheService {
  constructor() {
    this.client = null;
    this.isConnected = false;
    this.defaultTTL = 60; // 1 minute default
  }

  async connect() {
    try {
      this.client = new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379,
        retryStrategy: (times) => {
          if (times > 3) {
            console.log('[CACHE] Redis connection failed, running without cache');
            return null;
          }
          return Math.min(times * 100, 3000);
        }
      });

      this.client.on('connect', () => {
        this.isConnected = true;
        console.log('[CACHE] Redis connected');
      });

      this.client.on('error', (err) => {
        console.error('[CACHE] Redis error:', err.message);
        this.isConnected = false;
      });

      this.client.on('close', () => {
        this.isConnected = false;
      });

      // Test connection
      await this.client.ping();
      this.isConnected = true;
    } catch (error) {
      console.log('[CACHE] Redis not available, running without cache');
      this.isConnected = false;
    }
  }

  async get(key) {
    if (!this.isConnected || !this.client) return null;
    try {
      const data = await this.client.get(key);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('[CACHE] Get error:', error.message);
      return null;
    }
  }

  async set(key, value, ttl = this.defaultTTL) {
    if (!this.isConnected || !this.client) return false;
    try {
      await this.client.setex(key, ttl, JSON.stringify(value));
      return true;
    } catch (error) {
      console.error('[CACHE] Set error:', error.message);
      return false;
    }
  }

  async del(key) {
    if (!this.isConnected || !this.client) return false;
    try {
      await this.client.del(key);
      return true;
    } catch (error) {
      console.error('[CACHE] Del error:', error.message);
      return false;
    }
  }

  async invalidatePattern(pattern) {
    if (!this.isConnected || !this.client) return false;
    try {
      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        await this.client.del(...keys);
      }
      return true;
    } catch (error) {
      console.error('[CACHE] Invalidate error:', error.message);
      return false;
    }
  }

  // Invalidate all stats-related cache (call when data changes)
  async invalidateStats() {
    console.log('[CACHE] Invalidating stats cache');
    await this.del(CacheService.KEYS.STATS);
    await this.del(CacheService.KEYS.EXPERTS);
    await this.del(CacheService.KEYS.SHARES);
    await this.invalidatePattern('recs:*');
  }

  // Invalidate specific recommendation cache
  async invalidateRecommendations() {
    console.log('[CACHE] Invalidating recommendations cache');
    await this.invalidatePattern('recs:*');
  }

  // Cache keys
  static KEYS = {
    STATS: 'stats:dashboard',
    EXPERTS: 'stats:experts',
    SHARES: 'stats:shares',
    RECOMMENDATIONS: (params) => `recs:${JSON.stringify(params)}`,
  };

  // TTLs in seconds
  // With explicit cache invalidation on data changes, we can use longer TTLs
  // Cache is invalidated when: new recommendations added, admin edits/approves/deletes
  static TTL = {
    STATS: 900,         // 15 minutes - invalidated on data changes
    EXPERTS: 1800,      // 30 minutes - rarely changes
    SHARES: 1800,       // 30 minutes - rarely changes
    RECOMMENDATIONS: 600 // 10 minutes - invalidated on changes
  };
}

const cacheService = new CacheService();
export default cacheService;
