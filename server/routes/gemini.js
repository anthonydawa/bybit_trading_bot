import { Router } from 'express';
import { geminiService } from '../services/geminiService.js';

const router = Router();

// 1. Health check & model verification
router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    hasApiKey: Boolean(process.env.GEMINI_API_KEY),
    supportedModels: [
      'gemini-3.7-flash',
      'gemini-3.5-flash-lite',
      'gemini-3.1-pro-preview',
      'gemini-2.5-flash',
    ],
  });
});

// 2. Multimodal Chat & Vision Analysis
router.post('/chat', async (req, res) => {
  try {
    const { messages, prompt, image, marketContext, model, apiKey } = req.body;
    const response = await geminiService.chat({
      messages,
      prompt,
      image,
      marketContext,
      model,
      apiKey,
    });
    res.json({ success: true, data: response });
  } catch (err) {
    console.error('/api/gemini/chat error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// 3. Pre-Trade Setup Critique & Strategy Validator
router.post('/critique', async (req, res) => {
  try {
    const { order, marketContext, strategy, image, model, apiKey } = req.body;
    if (!order) {
      return res.status(400).json({ success: false, error: 'Order details required for critique' });
    }
    const critique = await geminiService.critiqueTrade({
      order,
      marketContext,
      strategy,
      image,
      model,
      apiKey,
    });
    res.json({ success: true, data: critique });
  } catch (err) {
    console.error('/api/gemini/critique error:', err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
