/**
 * Admin Routes for Expert Management
 * Handles CRUD operations for experts, aliases, and pending expert review
 */
import express from 'express';
import { expertService } from '../../services/expertService.js';

const router = express.Router();

/**
 * GET /api/admin/experts
 * List all experts with aliases and recommendation counts
 */
router.get('/', async (req, res) => {
  try {
    const experts = await expertService.getAllExperts();
    res.json({
      experts,
      total: experts.length
    });
  } catch (error) {
    console.error('Error fetching experts:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/admin/experts/pending
 * List all pending experts awaiting review
 */
router.get('/pending', async (req, res) => {
  try {
    const pending = await expertService.getPendingExperts();
    res.json({
      pending,
      total: pending.length
    });
  } catch (error) {
    console.error('Error fetching pending experts:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/admin/experts/:id
 * Get a single expert by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const expert = await expertService.getExpert(req.params.id);
    if (!expert) {
      return res.status(404).json({ error: 'Expert not found' });
    }
    res.json({ expert });
  } catch (error) {
    console.error('Error fetching expert:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/admin/experts
 * Create a new expert
 * Body: { canonical_name, bio?, specialization?, aliases?: string[] }
 */
router.post('/', async (req, res) => {
  try {
    const { canonical_name, bio, specialization, aliases } = req.body;

    if (!canonical_name || !canonical_name.trim()) {
      return res.status(400).json({ error: 'canonical_name is required' });
    }

    const expert = await expertService.createExpert({
      canonical_name: canonical_name.trim(),
      bio,
      specialization,
      aliases: aliases || []
    });

    res.status(201).json({ expert });
  } catch (error) {
    console.error('Error creating expert:', error);
    if (error.message.includes('duplicate key')) {
      return res.status(409).json({ error: 'Expert with this name already exists' });
    }
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/admin/experts/:id
 * Update an expert
 * Body: { canonical_name?, bio?, specialization?, is_active? }
 */
router.put('/:id', async (req, res) => {
  try {
    const expert = await expertService.updateExpert(req.params.id, req.body);
    if (!expert) {
      return res.status(404).json({ error: 'Expert not found' });
    }
    res.json({ expert });
  } catch (error) {
    console.error('Error updating expert:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/admin/experts/:id
 * Delete an expert (and their aliases)
 */
router.delete('/:id', async (req, res) => {
  try {
    await expertService.deleteExpert(req.params.id);
    res.json({ success: true, message: 'Expert deleted' });
  } catch (error) {
    console.error('Error deleting expert:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/admin/experts/:id/aliases
 * Add an alias to an expert
 * Body: { alias: string }
 */
router.post('/:id/aliases', async (req, res) => {
  try {
    const { alias } = req.body;

    if (!alias || !alias.trim()) {
      return res.status(400).json({ error: 'alias is required' });
    }

    const aliasRecord = await expertService.addAlias(req.params.id, alias);
    res.status(201).json({ alias: aliasRecord });
  } catch (error) {
    console.error('Error adding alias:', error);
    if (error.message.includes('duplicate key')) {
      return res.status(409).json({ error: 'This alias already exists' });
    }
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/admin/experts/aliases/:aliasId
 * Remove an alias
 */
router.delete('/aliases/:aliasId', async (req, res) => {
  try {
    await expertService.removeAlias(req.params.aliasId);
    res.json({ success: true, message: 'Alias removed' });
  } catch (error) {
    console.error('Error removing alias:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/admin/experts/pending/:id/resolve
 * Resolve a pending expert
 * Body: { action: 'create_new' | 'assign_existing' | 'reject', expertId?: string, canonicalName?: string }
 */
router.post('/pending/:id/resolve', async (req, res) => {
  try {
    const { action, expertId, canonicalName } = req.body;

    if (!action || !['create_new', 'assign_existing', 'reject'].includes(action)) {
      return res.status(400).json({
        error: 'action must be one of: create_new, assign_existing, reject'
      });
    }

    if (action === 'assign_existing' && !expertId) {
      return res.status(400).json({ error: 'expertId is required for assign_existing action' });
    }

    const result = await expertService.resolvePendingExpert(
      req.params.id,
      action,
      expertId,
      canonicalName
    );

    res.json(result);
  } catch (error) {
    console.error('Error resolving pending expert:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/admin/experts/cache/clear
 * Clear the expert alias cache
 */
router.post('/cache/clear', async (req, res) => {
  try {
    expertService.clearCache();
    res.json({ success: true, message: 'Expert cache cleared' });
  } catch (error) {
    console.error('Error clearing cache:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
