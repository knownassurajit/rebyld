'use strict';

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });

const express = require('express');
const cors    = require('cors');
const adaptRouter = require('./routes/adapt');

const PORT         = parseInt(process.env.PORT || '3001', 10);
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://knownassurajit.github.io';

// Dry-run mode: validate config and exit cleanly (used in CI)
if (process.argv.includes('--dry-run')) {
  const llmUrl = process.env.LIGHTWEIGHT_LLM_URL || 'http://localhost:8000';
  console.log('[dry-run] Config OK');
  console.log(`[dry-run] PORT=${PORT}`);
  console.log(`[dry-run] LIGHTWEIGHT_LLM_URL=${llmUrl}`);
  console.log(`[dry-run] LIGHTWEIGHT_LLM_MODEL=${process.env.LIGHTWEIGHT_LLM_MODEL || 'mistral-7b-instruct'}`);
  console.log(`[dry-run] FRONTEND_URL=${FRONTEND_URL}`);
  process.exit(0);
}

const app = express();

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(express.json({ limit: '64kb' }));

app.use(cors({
  origin: (origin, callback) => {
    const allowed = [
      FRONTEND_URL,
      'http://localhost:8080',
      'http://127.0.0.1:8080',
    ];
    if (!origin || allowed.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS: origin ${origin} not allowed`));
    }
  },
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type'],
}));

// ── Routes ────────────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => res.json({ status: 'ok', ts: Date.now() }));
app.use('/api/adapt', adaptRouter);

// 404 fallback
app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

// Global error handler
app.use((err, _req, res, _next) => {
  console.error('[server] Unhandled error:', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`[rebyld-server] Listening on http://localhost:${PORT}`);
  console.log(`[rebyld-server] LLM: ${process.env.LIGHTWEIGHT_LLM_URL || 'http://localhost:8000'}`);
});

module.exports = app;
