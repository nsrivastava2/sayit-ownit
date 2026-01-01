/**
 * Admin Routes for Expert Management
 * Handles CRUD operations for experts, aliases, and pending expert review
 */
import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { expertService } from '../../services/expertService.js';
import { expertProfileService } from '../../services/expertProfileService.js';
import { db } from '../../config/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, '../../uploads/experts');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure multer for image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `expert-${req.params.id}-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed.'));
    }
  }
});

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

/**
 * POST /api/admin/experts/pending/:id/research
 * Research a pending expert using Gemini AI
 * Returns enriched profile data for admin review
 */
router.post('/pending/:id/research', async (req, res) => {
  try {
    const result = await expertProfileService.researchPendingExpert(req.params.id);
    res.json({
      success: true,
      pendingExpert: result
    });
  } catch (error) {
    console.error('Error researching pending expert:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/admin/experts/:id/enrich
 * Enrich an existing expert's profile with web research
 */
router.post('/:id/enrich', async (req, res) => {
  try {
    const expert = await expertProfileService.enrichExpertProfile(req.params.id);
    res.json({
      success: true,
      expert
    });
  } catch (error) {
    console.error('Error enriching expert profile:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/admin/experts/research
 * Research any expert name (ad-hoc research)
 * Body: { name: string }
 */
router.post('/research', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'name is required' });
    }

    const research = await expertProfileService.researchExpert(name.trim());
    res.json({
      success: true,
      name: name.trim(),
      research
    });
  } catch (error) {
    console.error('Error researching expert:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/admin/experts/:id/profile
 * Update expert's enriched profile fields
 * Body: { experience_summary?, education?, twitter_handle?, linkedin_url?, youtube_channel?, website_url?, current_associations?, certifications?, warnings? }
 */
router.put('/:id/profile', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      experience_summary,
      education,
      twitter_handle,
      linkedin_url,
      youtube_channel,
      website_url,
      current_associations,
      certifications,
      warnings
    } = req.body;

    // Build dynamic update query
    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (experience_summary !== undefined) {
      updates.push(`experience_summary = $${paramIndex++}`);
      values.push(experience_summary);
    }
    if (education !== undefined) {
      updates.push(`education = $${paramIndex++}`);
      values.push(education);
    }
    if (twitter_handle !== undefined) {
      updates.push(`twitter_handle = $${paramIndex++}`);
      values.push(twitter_handle);
    }
    if (linkedin_url !== undefined) {
      updates.push(`linkedin_url = $${paramIndex++}`);
      values.push(linkedin_url);
    }
    if (youtube_channel !== undefined) {
      updates.push(`youtube_channel = $${paramIndex++}`);
      values.push(youtube_channel);
    }
    if (website_url !== undefined) {
      updates.push(`website_url = $${paramIndex++}`);
      values.push(website_url);
    }
    if (current_associations !== undefined) {
      updates.push(`current_associations = $${paramIndex++}`);
      values.push(current_associations);
    }
    if (certifications !== undefined) {
      updates.push(`certifications = $${paramIndex++}`);
      values.push(certifications);
    }
    if (warnings !== undefined) {
      updates.push(`warnings = $${paramIndex++}`);
      values.push(warnings);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    // Mark as manually edited
    updates.push(`profile_source = $${paramIndex++}`);
    values.push('manual');

    // If not enriched before, set enriched timestamp
    updates.push(`profile_enriched_at = COALESCE(profile_enriched_at, NOW())`);

    values.push(id);

    const result = await db.query(
      `UPDATE experts SET ${updates.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Expert not found' });
    }

    res.json({
      success: true,
      expert: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating expert profile:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/admin/experts/:id/upload-image
 * Upload a profile image for an expert
 */
router.post('/:id/upload-image', upload.single('image'), async (req, res) => {
  try {
    const { id } = req.params;

    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    // Generate the URL path for the uploaded image
    const imageUrl = `/uploads/experts/${req.file.filename}`;

    // Update expert with new profile picture URL
    const result = await db.query(
      `UPDATE experts SET profile_picture_url = $1, profile_source = 'manual' WHERE id = $2 RETURNING *`,
      [imageUrl, id]
    );

    if (result.rows.length === 0) {
      // Clean up uploaded file if expert not found
      fs.unlinkSync(req.file.path);
      return res.status(404).json({ error: 'Expert not found' });
    }

    res.json({
      success: true,
      imageUrl,
      expert: result.rows[0]
    });
  } catch (error) {
    console.error('Error uploading expert image:', error);
    // Clean up uploaded file on error
    if (req.file) {
      try { fs.unlinkSync(req.file.path); } catch (e) {}
    }
    res.status(500).json({ error: error.message });
  }
});

export default router;
