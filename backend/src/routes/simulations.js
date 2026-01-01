/**
 * Simulation API Routes
 *
 * POST /api/simulations/run     - Run a new simulation
 * GET  /api/simulations/:id     - Get simulation by ID
 * GET  /api/simulations/user    - Get user's saved simulations (auth required)
 */

import express from 'express';
import simulationService from '../services/simulationService.js';
import logger from '../utils/logger.js';

const router = express.Router();

/**
 * Run a portfolio simulation
 *
 * POST /api/simulations/run
 * Body: {
 *   expertId: UUID,
 *   initialCapital: number (default 100000),
 *   startDate: string (YYYY-MM-DD),
 *   endDate: string (YYYY-MM-DD),
 *   positionSizingMethod: 'EQUAL_WEIGHT' | 'FIXED_AMOUNT' | 'PERCENTAGE',
 *   positionSizeValue: number,
 *   maxConcurrentPositions: number
 * }
 */
router.post('/run', async (req, res) => {
  try {
    const {
      expertId,
      initialCapital = 100000,
      startDate,
      endDate,
      positionSizingMethod = 'FIXED_AMOUNT',
      positionSizeValue = 10000,
      maxConcurrentPositions = 10
    } = req.body;

    // Validation
    if (!expertId) {
      return res.status(400).json({ error: 'Expert ID is required' });
    }
    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'Start date and end date are required' });
    }
    if (new Date(endDate) < new Date(startDate)) {
      return res.status(400).json({ error: 'End date must be after start date' });
    }
    if (initialCapital < 1000) {
      return res.status(400).json({ error: 'Initial capital must be at least 1000' });
    }

    // Get user ID if authenticated
    const userId = req.session?.user?.id || null;

    const results = await simulationService.runSimulation({
      expertId,
      initialCapital: parseFloat(initialCapital),
      startDate,
      endDate,
      positionSizingMethod,
      positionSizeValue: parseFloat(positionSizeValue),
      maxConcurrentPositions: parseInt(maxConcurrentPositions),
      userId
    });

    logger.info('Simulation completed', {
      expertId,
      totalTrades: results.totalTrades,
      xirr: results.xirr
    });

    res.json({ simulation: results });
  } catch (error) {
    logger.error('Simulation error', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get simulation by ID
 *
 * GET /api/simulations/:id
 */
router.get('/:id', async (req, res) => {
  try {
    const simulation = await simulationService.getSimulationById(req.params.id);

    if (!simulation) {
      return res.status(404).json({ error: 'Simulation not found' });
    }

    res.json({ simulation });
  } catch (error) {
    logger.error('Error fetching simulation', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * Get user's saved simulations
 *
 * GET /api/simulations/user
 * Query: limit (default 20)
 */
router.get('/user/history', async (req, res) => {
  try {
    const userId = req.session?.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const limit = parseInt(req.query.limit) || 20;
    const simulations = await simulationService.getUserSimulations(userId, limit);

    res.json({ simulations });
  } catch (error) {
    logger.error('Error fetching user simulations', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

/**
 * Quick simulation preview (lighter weight, doesn't save)
 *
 * GET /api/simulations/preview/:expertId
 * Query: startDate, endDate, capital
 */
router.get('/preview/:expertId', async (req, res) => {
  try {
    const { expertId } = req.params;
    const {
      startDate,
      endDate,
      capital = 100000
    } = req.query;

    if (!startDate || !endDate) {
      // Default to last 1 year
      const end = new Date();
      const start = new Date();
      start.setFullYear(start.getFullYear() - 1);

      const results = await simulationService.runSimulation({
        expertId,
        initialCapital: parseFloat(capital),
        startDate: start.toISOString().split('T')[0],
        endDate: end.toISOString().split('T')[0],
        userId: null // Don't save preview
      });

      return res.json({ simulation: results });
    }

    const results = await simulationService.runSimulation({
      expertId,
      initialCapital: parseFloat(capital),
      startDate,
      endDate,
      userId: null
    });

    res.json({ simulation: results });
  } catch (error) {
    logger.error('Simulation preview error', { error: error.message });
    res.status(500).json({ error: error.message });
  }
});

export default router;
