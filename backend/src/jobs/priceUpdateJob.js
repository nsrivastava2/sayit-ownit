/**
 * Price Update Job
 * Scheduled job to fetch daily stock prices and detect outcomes
 *
 * Schedule: 6:00 PM IST (12:30 UTC) - After market close
 */

import cron from 'node-cron';
import priceService from '../services/priceService.js';
import outcomeService from '../services/outcomeService.js';
import metricsService from '../services/metricsService.js';

const logger = {
  info: (msg, data) => console.log(`[PRICE-JOB:INFO] ${msg}`, JSON.stringify(data || {})),
  error: (msg, data) => console.error(`[PRICE-JOB:ERROR] ${msg}`, JSON.stringify(data || {}))
};

// Cron schedule: 6:00 PM IST = 12:30 UTC (IST is UTC+5:30)
// "30 12 * * 1-5" = At 12:30 UTC, Monday through Friday
const CRON_SCHEDULE = '30 12 * * 1-5';

let isJobRunning = false;

/**
 * Main job function - fetches prices and detects outcomes
 */
async function runPriceUpdateJob() {
  if (isJobRunning) {
    logger.info('Job already running, skipping');
    return;
  }

  isJobRunning = true;
  const startTime = Date.now();

  logger.info('Starting price update job', { timestamp: new Date().toISOString() });

  try {
    // Step 1: Fetch prices for all recommended stocks
    logger.info('Fetching stock prices...');
    const priceResult = await priceService.fetchAllRecommendedStockPrices();
    logger.info('Price fetch complete', priceResult);

    // Step 2: Detect outcomes after prices are updated
    logger.info('Detecting outcomes...');
    const outcomeResult = await outcomeService.processAllActiveRecommendations();
    logger.info('Outcome detection complete', outcomeResult);

    // Step 3: Calculate and save expert metrics for trend analysis
    logger.info('Calculating expert metrics...');
    const metricsResult = await metricsService.calculateAllExpertMetrics();
    logger.info('Metrics calculation complete', { expertsProcessed: metricsResult.length });

    const duration = Date.now() - startTime;
    logger.info('Price update job complete', {
      durationMs: duration,
      prices: priceResult,
      outcomes: outcomeResult,
      metrics: { expertsProcessed: metricsResult.length }
    });

  } catch (error) {
    logger.error('Price update job failed', { error: error.message, stack: error.stack });
  } finally {
    isJobRunning = false;
  }
}

/**
 * Initialize the scheduled job
 */
export function initPriceUpdateJob() {
  logger.info('Initializing price update job', { schedule: CRON_SCHEDULE });

  const job = cron.schedule(CRON_SCHEDULE, runPriceUpdateJob, {
    scheduled: true,
    timezone: 'UTC'
  });

  logger.info('Price update job scheduled', {
    schedule: 'Mon-Fri at 6:00 PM IST (12:30 UTC)',
    nextRun: getNextRunTime()
  });

  return job;
}

/**
 * Get next scheduled run time
 */
function getNextRunTime() {
  const now = new Date();
  const next = new Date();

  // Set to 12:30 UTC
  next.setUTCHours(12, 30, 0, 0);

  // If already past today's time, move to next day
  if (now > next) {
    next.setDate(next.getDate() + 1);
  }

  // Skip weekends
  while (next.getDay() === 0 || next.getDay() === 6) {
    next.setDate(next.getDate() + 1);
  }

  return next.toISOString();
}

/**
 * Manual trigger for testing
 */
export async function triggerPriceUpdate() {
  logger.info('Manual price update triggered');
  return runPriceUpdateJob();
}

/**
 * Get job status
 */
export function getJobStatus() {
  return {
    isRunning: isJobRunning,
    schedule: CRON_SCHEDULE,
    nextRun: getNextRunTime()
  };
}

export default {
  initPriceUpdateJob,
  triggerPriceUpdate,
  getJobStatus
};
