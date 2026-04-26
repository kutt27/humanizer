require('dotenv').config();
const express = require('express');
const path = require('path');

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'src')));

app.get('/', (req, res) => res.redirect('/panel.html'));

const SYSTEM_PROMPT = `You are a writing editor. Rewrite the provided paragraph to remove AI writing patterns and make it sound natural and human.

Rules:
- Remove AI vocabulary: delve, leverage, robust, navigate, seamless, pivotal, testament, landscape, underscore, tapestry, vibrant, foster, crucial, realm, Furthermore, Moreover, Additionally, groundbreaking
- Remove em dashes (—) — replace with commas or periods
- Remove inflated significance language: "marks a pivotal moment", "serves as a testament", "represents a paradigm shift"
- Replace copula avoidance: "serves as / stands as / represents / boasts" → use "is / are / has"
- Remove rule-of-three patterns and excessive parallelism
- Remove vague attributions: "experts say", "industry observers", "it is worth noting"
- Remove tacked-on -ing phrases that add fake depth (e.g. "underscoring its importance", "highlighting the need")
- Remove negative parallelisms: "It's not just X; it's Y"
- Vary sentence length naturally — mix short and long sentences
- Keep all technical accuracy, terminology, and meaning intact
- Keep approximately the same length

Return ONLY the rewritten paragraph. No explanation, no preamble.`;

const ENV_KEY = (process.env.GROQ_API_KEY || '').startsWith('gsk_')
  ? process.env.GROQ_API_KEY
  : null;

app.get('/api/config', (req, res) => {
  res.json({ hasServerKey: !!ENV_KEY });
});

app.post('/api/humanize', async (req, res) => {
  const { text, apiKey, format } = req.body;
  const resolvedKey = ENV_KEY || apiKey;

  if (!text || !resolvedKey) {
    return res.status(400).json({ error: 'Missing text or apiKey' });
  }

  let userPrompt = text;
  if (format === 'points') {
    userPrompt += '\n\nIMPORTANT: Return the humanized result as a clear bulleted list (bullet points).';
  }

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resolvedKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 1024,
        temperature: 0.7,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      const msg = data.error?.message || JSON.stringify(data.error) || 'Groq API error';
      return res.status(response.status).json({ error: msg });
    }

    const result = data.choices?.[0]?.message?.content?.trim();
    if (!result) {
      return res.status(500).json({ error: 'Empty response from Groq' });
    }

    res.json({ result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`\n✓ Humanizer running at http://localhost:${PORT}`);
  console.log('  Open the panel: http://localhost:' + PORT + '/panel.html');
  console.log('  Server-side API key:', ENV_KEY ? '✓ loaded from .env' : '✗ not set (enter key in browser panel)');
});