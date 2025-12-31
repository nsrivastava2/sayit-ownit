/**
 * Admin Routes for Channel Management
 * Handles CRUD operations for channels and prompt file assignments
 */
import express from 'express';
import { promptService } from '../../services/promptService.js';

const router = express.Router();

/**
 * GET /api/admin/channels
 * List all channels with prompt assignments
 */
router.get('/', async (req, res) => {
  try {
    const channels = await promptService.getAllChannels();
    const promptFiles = await promptService.listPromptFiles();

    res.json({
      channels,
      total: channels.length,
      availablePromptFiles: promptFiles
    });
  } catch (error) {
    console.error('Error fetching channels:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/admin/channels/prompts
 * List available prompt files
 */
router.get('/prompts', async (req, res) => {
  try {
    const promptFiles = await promptService.listPromptFiles();
    res.json({ promptFiles });
  } catch (error) {
    console.error('Error listing prompt files:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/admin/channels
 * Create a new channel
 * Body: { name: string, prompt_file?: string }
 */
router.post('/', async (req, res) => {
  try {
    const { name, prompt_file } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: 'name is required' });
    }

    const channel = await promptService.createChannel({
      name: name.trim(),
      prompt_file: prompt_file || null
    });

    res.status(201).json({ channel });
  } catch (error) {
    console.error('Error creating channel:', error);
    if (error.message.includes('duplicate key')) {
      return res.status(409).json({ error: 'Channel with this name already exists' });
    }
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/admin/channels/:id
 * Update a channel
 * Body: { name?: string, prompt_file?: string, is_active?: boolean }
 */
router.put('/:id', async (req, res) => {
  try {
    const channel = await promptService.updateChannel(req.params.id, req.body);
    if (!channel) {
      return res.status(404).json({ error: 'Channel not found' });
    }
    res.json({ channel });
  } catch (error) {
    console.error('Error updating channel:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/admin/channels/cache/clear
 * Clear the prompt cache
 */
router.post('/cache/clear', async (req, res) => {
  try {
    promptService.clearCache();
    res.json({ success: true, message: 'Prompt cache cleared' });
  } catch (error) {
    console.error('Error clearing cache:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/admin/channels/test/:channelName
 * Test channel matching for a given channel name
 */
router.get('/test/:channelName', async (req, res) => {
  try {
    const channelName = decodeURIComponent(req.params.channelName);
    const matchedChannel = await promptService.matchChannel(channelName);

    res.json({
      input: channelName,
      normalized: promptService.normalizeChannelName(channelName),
      matchedChannel: matchedChannel || null,
      promptFile: matchedChannel?.prompt_file || 'default.md'
    });
  } catch (error) {
    console.error('Error testing channel match:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
