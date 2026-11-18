// Free AI providers with automatic fallback.
// 1. Google Gemini (free tier)  -> GEMINI_API_KEY
// 2. Groq (free tier)           -> GROQ_API_KEY
// If neither key is set, or both fail, this returns null and every caller
// uses its own rule-based logic instead, so the app always keeps working.

const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const GROQ_MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
const TIMEOUT_MS = 25000;

function isEnabled() {
  return Boolean(process.env.GEMINI_API_KEY || process.env.GROQ_API_KEY);
}

async function fetchWithTimeout(url, options) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// Pulls the first JSON object out of a model reply
function parseJson(text) {
  if (!text) return null;
  const cleaned = text.replace(/```json|```/g, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1) return null;
  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch {
    return null;
  }
}

async function callGemini(system, prompt) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
  const res = await fetchWithTimeout(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.2, responseMimeType: 'application/json' },
    }),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}`);
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') || '';
}

async function callGroq(system, prompt) {
  const res = await fetchWithTimeout('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
    body: JSON.stringify({
      model: GROQ_MODEL,
      temperature: 0.2,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: prompt },
      ],
    }),
  });
  if (!res.ok) throw new Error(`Groq ${res.status}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}

// Asks the AI for a JSON answer. Returns the parsed object, or null.
async function askJson(system, prompt) {
  const providers = [];
  if (process.env.GEMINI_API_KEY) providers.push(callGemini);
  if (process.env.GROQ_API_KEY) providers.push(callGroq);

  for (const provider of providers) {
    try {
      const json = parseJson(await provider(`${system}\nReply with JSON only.`, prompt));
      if (json) return json;
    } catch (err) {
      if (process.env.NODE_ENV !== 'test') console.warn(`AI provider failed: ${err.message}`);
    }
  }
  return null;
}

module.exports = { askJson, isEnabled, parseJson };
