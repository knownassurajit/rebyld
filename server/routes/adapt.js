'use strict';

const express = require('express');
const { getAdaptation } = require('../llm');

const router = express.Router();

/**
 * POST /api/adapt
 *
 * Body: {
 *   profile: { name, age, sex, heightCm, weightKg, targetWeightKg, fitnessGoal,
 *              primaryObjective, experienceLevel, equipment[], daysPerWeek,
 *              dietPreference, intolerances[] }
 *   metrics: { weight, targetKcal, targetProtein, targetWater }
 *   changedField: string   — which metric the user just updated
 * }
 *
 * Response: {
 *   workoutAdjustment, dietAdjustment, scheduleNote, rationale, urgency
 * }
 */
router.post('/', async (req, res) => {
  const { profile, metrics, changedField } = req.body || {};

  if (!metrics || !changedField) {
    return res.status(400).json({
      error: 'Missing required fields: metrics and changedField are required.',
    });
  }

  // Validate metrics are numbers
  const numericFields = ['weight', 'targetKcal', 'targetProtein', 'targetWater'];
  for (const field of numericFields) {
    if (metrics[field] !== undefined && typeof metrics[field] !== 'number') {
      return res.status(400).json({ error: `metrics.${field} must be a number` });
    }
  }

  try {
    const adaptation = await getAdaptation({ profile, metrics, changedField });
    return res.json({ success: true, adaptation });
  } catch (err) {
    console.error('[/api/adapt] LLM error:', err.message);

    if (err.message.includes('ECONNREFUSED') || err.message.includes('fetch failed')) {
      return res.status(503).json({
        error: 'LLM service unavailable. Check LIGHTWEIGHT_LLM_URL configuration.',
        fallback: true,
      });
    }

    return res.status(500).json({
      error: 'Failed to get adaptation from LLM.',
      detail: err.message,
    });
  }
});

module.exports = router;
