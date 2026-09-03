import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

import geminiRouter from './routes/gemini.js';
import bybitRouter from './routes/bybit.js';
import strategiesRouter from './routes/strategies.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
// 50mb limit to support high-res base64 chart canvas screenshots
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// API Routes
app.use('/api/gemini', geminiRouter);
app.use('/api/bybit', bybitRouter);
app.use('/api/strategies', strategiesRouter);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
  });
});

// Serve static frontend in production (Hostinger deployment support)
const distPath = path.join(__dirname, '..', 'dist');
app.use(express.static(distPath));

app.get('*', (req, res) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'API route not found' });
  }
  const indexPath = path.join(distPath, 'index.html');
  res.sendFile(indexPath, (err) => {
    if (err) {
      res.status(200).send(`
        <html>
          <body style="font-family: sans-serif; background: #090d16; color: #fff; padding: 40px; text-align: center;">
            <h2>AI Trading Bot API Server Running on Port ${PORT}</h2>
            <p>To view the frontend, run <code>npm run dev</code> or build the client with <code>npm run build</code>.</p>
          </body>
        </html>
      `);
    }
  });
});

app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🚀 AI Trading Platform Server running on port ${PORT}`);
  console.log(`🔗 API Base: http://localhost:${PORT}/api`);
  console.log(`🤖 Gemini API Key configured: ${Boolean(process.env.GEMINI_API_KEY)}`);
  console.log(`====================================================`);
});
