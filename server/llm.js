'use strict';

/**
 * LightweightLLM client wrapper.
 * Calls the /v1/chat/completions endpoint of a LightweightLLM instance.
 */

const fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));

const LLM_URL = process.env.LIGHTWEIGHT_LLM_URL || 'http://localhost:8000';
const MODEL   = process.env.LIGHTWEIGHT_LLM_MODEL || 'mistral-7b-instruct';

/**
 * Build the system prompt for plan adaptation.
 */
function buildSystemPrompt() {
  return `You are a fitness and nutrition coach AI assistant integrated into REBYLD, a personal training app.
Your role is to adjust workout plans, diet targets, and weekly schedules based on the user's current metrics and profile.

Rules:
- Always respond with valid JSON only. No markdown, no prose.
- Be specific and actionable — give exact numbers where possible.
- Respect the user's equipment availability, dietary preferences, and intolerances.
- If a metric change is minor (< 2%), respond with minimal adjustments.
- Never recommend extreme caloric deficits below 1200 kcal for females or 1500 kcal for males.
- Always include a brief rationale for each change in the "rationale" field.`;
}

/**
 * Build the user prompt from the adapt request.
 */
function buildUserPrompt({ profile, metrics, changedField }) {
  const profileSummary = profile ? `
User Profile:
- Name: ${profile.name || 'User'}
- Age: ${profile.age || 'unknown'}, Sex: ${profile.sex || 'unknown'}
- Height: ${profile.heightCm || '?'} cm, Current weight: ${metrics.weight || profile.weightKg || '?'} kg
- Target weight: ${profile.targetWeightKg || metrics.targetWeight || '?'} kg
- Fitness goal: ${profile.fitnessGoal || 'general fitness'}
- Primary objective: ${profile.primaryObjective || 'general fitness'}
- Experience level: ${profile.experienceLevel || 'beginner'}
- Equipment: ${(profile.equipment || ['bodyweight']).join(', ')}
- Days per week: ${profile.daysPerWeek || 5}
- Dietary preference: ${profile.dietPreference || 'omnivore'}
- Intolerances: ${(profile.intolerances || []).join(', ') || 'none'}` : 'No profile provided.';

  const metricsSummary = `
Current Metrics:
- Weight: ${metrics.weight || '?'} kg
- Daily calories target: ${metrics.targetKcal || '?'} kcal
- Daily protein target: ${metrics.targetProtein || '?'} g
- Daily water target: ${metrics.targetWater || '?'} L`;

  return `${profileSummary}
${metricsSummary}

The user just changed: "${changedField}"

Based on this change, provide adapted recommendations. Respond ONLY with this JSON structure:
{
  "workoutAdjustment": {
    "intensityChange": "increase" | "decrease" | "maintain",
    "recommendation": "specific workout recommendation string",
    "daysPerWeekSuggested": <number 3-6>
  },
  "dietAdjustment": {
    "targetKcal": <number>,
    "targetProteinG": <number>,
    "targetWaterL": <number>,
    "mealTimingNote": "brief meal timing recommendation",
    "foodFocus": "specific foods or nutrients to prioritize"
  },
  "scheduleNote": "brief note about schedule adaptation",
  "rationale": "explanation of why these changes are recommended",
  "urgency": "low" | "medium" | "high"
}`;
}

/**
 * Call the LightweightLLM API and return parsed adaptation recommendations.
 * @param {object} requestData - { profile, metrics, changedField }
 * @returns {Promise<object>} - parsed JSON recommendations
 */
async function getAdaptation(requestData) {
  const response = await fetch(`${LLM_URL}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: buildSystemPrompt() },
        { role: 'user', content: buildUserPrompt(requestData) },
      ],
      temperature: 0.4,
      max_tokens: 512,
      response_format: { type: 'json_object' },
    }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`LLM API error ${response.status}: ${errText.slice(0, 200)}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;
  if (!content) throw new Error('Empty response from LLM');

  return JSON.parse(content);
}

module.exports = { getAdaptation };
